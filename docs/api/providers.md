# AionUi 模型配置接口文档

> 模型配置(LLM provider / 模型列表 / 健康状态 / 渠道默认模型)通过 **本地后端** `BadouWorkCore` 持久化,基址 `http://127.0.0.1:<backendPort>`(默认 `13400`,取自 `window.__backendPort`),由前端 `ipcBridge.mode.*` / `ipcBridge.channel.*` 通过 `fetch` 调用。WebUI 浏览器模式下走同源 `/api/*`。
>
> - 传输:`packages/desktop/src/common/adapter/httpBridge.ts`
> - Base URL:同文件 `:35-59`
> - 响应包装:后端统一 `{ success, data, ... }`,bridge 自动解 `data`(同文件 `:247-249`)
> - 失败:抛 `BackendHttpError`(`status`, `code`, `backendMessage`, `details`, `body`)

## 目录

1. `POST /api/providers` — 创建模型配置
2. `PUT /api/providers/:id` — 更新模型配置
3. `DELETE /api/providers/:id` — 删除模型配置
4. `GET /api/providers` — 列出所有 provider
5. `POST /api/providers/:id/models` — 拉取某 provider 可用模型
6. `POST /api/providers/fetch-models` — 匿名探测模型列表
7. `POST /api/providers/detect-protocol` — 协议识别
8. `PUT /api/channel/settings/:platform/default-model` — 设置渠道默认模型

附录:`IProvider` 完整字段、错误响应形态、关键文件索引

---

## 1. 创建模型配置 `POST /api/providers`

### 基本信息

| 项       | 值                                                                                                                                                                                                                                            |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Method   | `POST`                                                                                                                                                                                                                                        |
| URL      | `/api/providers`                                                                                                                                                                                                                              |
| 完整 URL | `http://127.0.0.1:<backendPort>/api/providers`                                                                                                                                                                                                |
| 前端调用 | `ipcBridge.mode.createProvider.invoke(provider)`                                                                                                                                                                                              |
| 声明位置 | `packages/desktop/src/common/adapter/ipcBridge.ts:1064-1087`                                                                                                                                                                                  |
| 触发入口 | 设置 → 模型 → 顶部"添加模型"按钮 → `AddPlatformModal.handleSubmit`(`pages/settings/components/AddPlatformModal.tsx:350-412`)→ `ModelModalContent.persistPlatform`(`components/settings/SettingsModal/contents/ModelModalContent.tsx:121-129`) |

### Headers

| Header         | 值                 | 说明                                                  |
| -------------- | ------------------ | ----------------------------------------------------- |
| `Content-Type` | `application/json` | 有 body 时由 bridge 自动设置(`httpBridge.ts:186-188`) |

### Body — `CreateProviderRequest`(`packages/desktop/src/common/types/provider/providerApi.ts:17-38`)

| 字段              | 必填 | 类型                                                                    | 说明                                                                          |
| ----------------- | ---- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `id`              | 否   | `string`                                                                | 可选。省略时由服务端生成。允许非空字符串,接受前端 `uuid()` 生成的 8 字符 id   |
| `platform`        | 是   | `string`                                                                | 平台枚举:`openai` / `gemini` / `anthropic` / `new-api` / `bedrock` / `custom` |
| `name`            | 是   | `string`                                                                | 展示名                                                                        |
| `base_url`        | 是   | `string`                                                                | OpenAI 兼容端点                                                               |
| `api_key`         | 是   | `string`                                                                | 平台 API 密钥                                                                 |
| `models`          | 否   | `string[]`                                                              | 模型名列表                                                                    |
| `enabled`         | 否   | `boolean`                                                               | 默认 `true`                                                                   |
| `capabilities`    | 否   | `ModelCapability[]`                                                     | 模型能力标签                                                                  |
| `context_limit`   | 否   | `number`                                                                | 上下文 token 限制                                                             |
| `model_protocols` | 否   | `Record<string, string>`                                                | 每模型协议,仅 `new-api` 平台使用                                              |
| `model_enabled`   | 否   | `Record<string, boolean>`                                               | 每模型启用状态                                                                |
| `model_health`    | 否   | `Record<string, { status, last_check?, latency?, error? }>`             | 每模型健康检测结果                                                            |
| `model_settings`  | 否   | `Record<string, ModelSettings>`                                         | 每模型显式覆盖                                                                |
| `bedrock_config`  | 否   | `{ auth_method, region, access_key_id?, secret_access_key?, profile? }` | 仅 `bedrock` 平台使用                                                         |
| `is_full_url`     | 否   | `boolean`                                                               | `base_url` 是否完整 URL                                                       |

### 请求示例

```json
{
  "id": "a1b2c3d4",
  "platform": "openai",
  "name": "OpenAI",
  "base_url": "https://api.openai.com/v1",
  "api_key": "sk-...",
  "models": ["gpt-4o", "gpt-4o-mini"],
  "enabled": true,
  "is_full_url": true,
  "model_enabled": { "gpt-4o": true, "gpt-4o-mini": true },
  "model_settings": {
    "gpt-4o": { "image_input": "supported", "openai_api_mode": "chat_completions" }
  }
}
```

### 成功响应

`200 OK`,`Content-Type: application/json`,后端包装 `{ success, data, ... }`,bridge 解出 `data` 后 resolve。响应形态:

```ts
IProvider; // 字段含义同请求,且 id 一定存在
```

### 失败响应

抛 `BackendHttpError`,前端 toast `settings.saveModelConfigFailed`,HTTP 409 视为 id 冲突。

---

## 2. 更新模型配置 `PUT /api/providers/:id`

### 基本信息

| 项       | 值                                                                                    |
| -------- | ------------------------------------------------------------------------------------- |
| Method   | `PUT`                                                                                 |
| URL      | `/api/providers/:id`                                                                  |
| 前端调用 | `ipcBridge.mode.updateProvider.invoke({ id, ...body })`                               |
| 声明位置 | `packages/desktop/src/common/adapter/ipcBridge.ts:1068-1072`                          |
| 触发入口 | `ModelModalContent.persistPlatform / updatePlatform`(`ModelModalContent.tsx:121-156`) |

### Headers

| Header         | 值                 |
| -------------- | ------------------ |
| `Content-Type` | `application/json` |

### Body — `UpdateProviderRequest`(`providerApi.ts:44-59`)

bridge 的 `mapBody` 会把 `id` 从 body 中剥除,路径中已携带。**所有字段均为可选,只更新传入字段**。

| 字段              | 类型                                                                    |
| ----------------- | ----------------------------------------------------------------------- |
| `platform`        | `string`                                                                |
| `name`            | `string`                                                                |
| `base_url`        | `string`                                                                |
| `api_key`         | `string`                                                                |
| `models`          | `string[]`                                                              |
| `enabled`         | `boolean`                                                               |
| `capabilities`    | `ModelCapability[]`                                                     |
| `context_limit`   | `number`                                                                |
| `model_protocols` | `Record<string, string>`                                                |
| `model_enabled`   | `Record<string, boolean>`                                               |
| `model_health`    | `Record<string, { status, last_check?, latency?, error? }>`             |
| `model_settings`  | `Record<string, ModelSettings>`                                         |
| `bedrock_config`  | `{ auth_method, region, access_key_id?, secret_access_key?, profile? }` |
| `is_full_url`     | `boolean`                                                               |

> **注意**:虽然类型上 `{ id: string } & UpdateProviderRequest`,bridge 会自动从 body 中移除 `id`,不会与服务端的 id 冲突。

### 请求示例

```json
{
  "name": "OpenAI Production",
  "enabled": true,
  "models": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"]
}
```

### 成功响应

`200 OK`,resolve 为更新后的 `IProvider`。

### 触发场景

- 编辑 provider(✏️ 按钮)→ `EditModeModal.onOk`(`pages/settings/components/EditModeModal.tsx:150-182`)
- 增删模型(每 provider 的 + 按钮)→ `AddModelModal.handleConfirm`(`AddModelModal.tsx:83-112`)
- 切换 provider enable Switch(`ModelModalContent.tsx:480-484`)→ 自动保存
- 切换每模型 enable Switch(`ModelModalContent.tsx:611-616`)→ 自动保存
- New-API 协议标签切换(`ModelModalContent.tsx:567-571`)→ 自动保存
- 模型删除(`ModelModalContent.tsx:640-674`)→ 自动保存
- 健康检查结果回写(`ModelModalContent.tsx:232, 272, 291`)

---

## 3. 删除模型配置 `DELETE /api/providers/:id`

### 基本信息

| 项       | 值                                                                  |
| -------- | ------------------------------------------------------------------- |
| Method   | `DELETE`                                                            |
| URL      | `/api/providers/:id`                                                |
| 前端调用 | `ipcBridge.mode.deleteProvider.invoke({ id })`                      |
| 触发入口 | `ModelModalContent.removePlatform`(`ModelModalContent.tsx:158-171`) |

### Headers

无需 `Content-Type`(无 body)。

### Body

无。

### 成功响应

`200 OK`,resolve 为 `void`。

---

## 4. 列出所有 provider `GET /api/providers`

### 基本信息

| 项       | 值                                      |
| -------- | --------------------------------------- |
| Method   | `GET`                                   |
| URL      | `/api/providers`                        |
| 前端调用 | `ipcBridge.mode.listProviders.invoke()` |
| 触发入口 | `ModelModalContent` 初始化加载          |

### Headers

无。

### Body

无。

### 成功响应

`200 OK`,resolve 为 `IProvider[]`。

---

## 5. 拉取某 provider 可用模型 `POST /api/providers/:id/models`

### 基本信息

| 项       | 值                                                            |
| -------- | ------------------------------------------------------------- |
| Method   | `POST`                                                        |
| URL      | `/api/providers/:id/models`                                   |
| 前端调用 | `ipcBridge.mode.fetchProviderModels.invoke({ id, try_fix? })` |
| 触发入口 | `useModeModeList`(`renderer/hooks/agent/useModeModeList.ts`)  |

### Body

```ts
{ id: string; try_fix?: boolean }
```

bridge 的 `mapBody` 去掉 `id` 后只发 `{ try_fix }`。

### 成功响应

```ts
{
  models: Array<string | { id: string; name: string }>;
  fixed_base_url?: string;  // 后端自动修正后的 base_url(若修正过)
}
```

---

## 6. 匿名探测模型列表 `POST /api/providers/fetch-models`

### 基本信息

| 项       | 值                                                                          |
| -------- | --------------------------------------------------------------------------- |
| Method   | `POST`                                                                      |
| URL      | `/api/providers/fetch-models`                                               |
| 前端调用 | `ipcBridge.mode.fetchModelList.invoke(payload)`                             |
| 触发入口 | "添加模型"表单中"探测模型列表"按钮(凭据直接传入 body,不需要先创建 provider) |

### Body — `FetchModelsAnonymousRequest`(`providerApi.ts:76-82`)

```ts
{
  platform: string;
  base_url?: string;
  api_key: string;
  bedrock_config?: IProvider['bedrock_config'];
  try_fix?: boolean;
}
```

### 成功响应

同 §5 响应形态。

---

## 7. 协议识别 `POST /api/providers/detect-protocol`

### 基本信息

| 项       | 值                                              |
| -------- | ----------------------------------------------- |
| Method   | `POST`                                          |
| URL      | `/api/providers/detect-protocol`                |
| 前端调用 | `ipcBridge.mode.detectProtocol.invoke(payload)` |

### Body

```ts
ProtocolDetectionRequest;
```

### 成功响应

```ts
ProtocolDetectionResponse;
```

---

## 8. 设置渠道默认模型 `PUT /api/channel/settings/:platform/default-model`

### 基本信息

| 项       | 值                                                                                                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Method   | `PUT`                                                                                                                                                                                                              |
| URL      | `/api/channel/settings/:platform/default-model`                                                                                                                                                                    |
| 前端调用 | `ipcBridge.channel.setDefaultModelSetting.invoke({ platform, default_model })`                                                                                                                                     |
| 声明位置 | `packages/desktop/src/common/adapter/ipcBridge.ts:2343-2346`                                                                                                                                                       |
| 触发入口 | 渠道模型选择器选定模型(Telegram / Slack / Lark / 钉钉 / 企微)→ `ChannelModalContent.useChannelModelSelection.onSelectModel`(`components/settings/SettingsModal/contents/channels/ChannelModalContent.tsx:115-130`) |
| 失败提示 | `settings.assistant.modelSaveFailed`                                                                                                                                                                               |

### Headers

| Header         | 值                 |
| -------------- | ------------------ |
| `Content-Type` | `application/json` |

### Body

```ts
{
  default_model: IChannelDefaultModelSetting; // 例: { id: <providerId>, use_model: <modelName>, ... }
}
```

bridge 的 `mapBody` 提取 `default_model` 作为 body。

### 成功响应

`200 OK`,resolve 为 `void`。

---

## 附录 A:`IProvider` 完整字段(`packages/desktop/src/common/config/storage.ts:502-567`)

```ts
interface IProvider {
  id: string;
  platform: string;
  name: string;
  base_url: string;
  api_key: string;
  models: string[];
  capabilities?: ModelCapability[];
  context_limit?: number;
  model_protocols?: Record<string, string>;
  bedrock_config?: {
    auth_method: 'accessKey' | 'profile';
    region: string;
    access_key_id?: string;
    secret_access_key?: string;
    profile?: string;
  };
  enabled?: boolean;
  model_enabled?: Record<string, boolean>;
  model_health?: Record<
    string,
    {
      status: 'unknown' | 'healthy' | 'unhealthy';
      last_check?: number;
      latency?: number;
      error?: string;
    }
  >;
  model_settings?: Record<string, ModelSettings>;
  is_full_url?: boolean;
}

type ModelCapability = { type: ModelType; isUserSelected?: boolean };
//   ModelType: 'default' | 'image' | 'imageGeneration' | 'webSearch' |
//              'thinking' | 'reasoning' | 'functionCall' | 'embedding' |
//              'rerank' | 'excludeFromPrimary'

type ModelSettings = {
  image_input?: 'supported' | 'unsupported';
  openai_api_mode?: 'chat_completions' | 'responses';
  context_window_size?: number;
  max_content_length?: number;
  max_response_length?: number;
};
```

---

## 附录 B:错误响应形态

抛 `BackendHttpError`(`packages/desktop/src/common/adapter/httpBridge.ts:217-232`):

```ts
class BackendHttpError extends Error {
  status: number; // HTTP 状态码
  code?: string; // 后端业务码
  backendMessage?: string;
  details?: unknown;
  body?: unknown; // 原始响应体
}
```

错误体通常形如:

```json
{
  "code": "...",
  "error": "...",
  "details": {
    /* ... */
  }
}
```

`isBackendHttpError(error)` 可用 duck typing 判断。

---

## 附录 C:关键文件索引

| 角色                   | 路径                                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| Endpoint 声明(mode)    | `packages/desktop/src/common/adapter/ipcBridge.ts:1064-1087`                                                |
| Endpoint 声明(channel) | `packages/desktop/src/common/adapter/ipcBridge.ts:2343-2346`                                                |
| HTTP 传输与响应解包    | `packages/desktop/src/common/adapter/httpBridge.ts:177-251`                                                 |
| Base URL 解析          | `packages/desktop/src/common/adapter/httpBridge.ts:35-59`                                                   |
| 请求/响应类型          | `packages/desktop/src/common/types/provider/providerApi.ts`                                                 |
| `IProvider` 全字段     | `packages/desktop/src/common/config/storage.ts:502-567`                                                     |
| 模型设置保存派发       | `packages/desktop/src/renderer/components/settings/SettingsModal/contents/ModelModalContent.tsx`            |
| 添加 provider 表单     | `packages/desktop/src/renderer/pages/settings/components/AddPlatformModal.tsx`                              |
| 添加模型表单           | `packages/desktop/src/renderer/pages/settings/components/AddModelModal.tsx`                                 |
| 编辑 provider 表单     | `packages/desktop/src/renderer/pages/settings/components/EditModeModal.tsx`                                 |
| 渠道默认模型保存       | `packages/desktop/src/renderer/components/settings/SettingsModal/contents/channels/ChannelModalContent.tsx` |
| 设计说明               | `docs/superpowers/specs/2026-09-18-builtin-provider-frontend-design.md`                                     |
