# knowledge-server MCP Schema 审查与修改建议

> 审查对象：`http://devops.badousoft.com/mcp-client/mcp/knowledge-server/sse`
>
> 审查方式：通过 MCP 协议调用 `tools/list` 获取真实 schema，并用 `tools/call` 对关键参数类型做了实测。
>
> 审查日期：2026-10-29

## 1. 结论摘要

`knowledge-server` 暴露了 3 个工具：`search_knowledge`、`list_knowledge`、`chat`。整体可用，但 schema 存在三类问题，会直接导致模型调用失败或反复重试：

1. **类型与描述自相矛盾**（P0）：`enableRerank` 是 `integer`，描述却写“默认 false”；`rerankModel` 是 `boolean`，描述却是“重排模型 code”；`usingReRank` 是 `string`，实际语义是布尔值。
2. **工具描述被截断**（P0）：`search_knowledge` 的 `description` 在 `tools/list` 返回时停在 `开启 datasetSearchUsingEx`，模型看不到后面的调用建议。
3. **失败与空结果缺少结构化反馈**（P1）：参数错误返回 Java Whitelabel HTML 400 页面；检索无结果只返回空数组。模型无法区分“参数错”和“确实没有内容”，容易换关键词反复调用。

> 注意：本文件只覆盖 MCP schema 层。模型侧 tools 格式（`tool_wire_shape`）不匹配是另一个问题，无法通过修改 MCP schema 解决。

## 2. 当前 schema（`tools/list` 原始返回）

### 2.1 `search_knowledge`

| 字段                               | 类型        | 必填                        | 描述                                               |
| ---------------------------------- | ----------- | --------------------------- | -------------------------------------------------- |
| `retrieveText`                     | string      | 是                          | 检索文本（用户问题）                               |
| `searchMode`                       | string      | 否                          | 检索模式：embedding / fullTextRecall / mixedRecall |
| `similarity`                       | number      | 否                          | 最小相似度阈值                                     |
| `limit`                            | integer     | 否                          | 最大返回条数                                       |
| `embeddingWeight`                  | number      | 否                          | 语义检索权重（仅 mixedRecall 生效）                |
| `usingReRank`                      | string      | 否                          | 是否开启重排，默认 false                           |
| `rerankModel`                      | **boolean** | 否                          | 重排模型 code                                      |
| `datasetSearchUsingExtensionQuery` | string      | 否                          | 是否启用 LLM 问题优化                              |
| `datasetSearchExtensionModel`      | **boolean** | 否                          | 问题优化模型 code                                  |
| `datasetSearchExtensionBg`         | string      | 否                          | 问题优化背景描述                                   |
| `knowledgeBaseIds`                 | string      | 描述写必填，`required` 未列 | 知识库 ID 列表，英文逗号分隔                       |

`required`：`["retrieveText"]`；`additionalProperties: false`。

`description` 实际返回值在 `开启 datasetSearchUsingEx` 处截断，后半段调用建议没有下发。

### 2.2 `list_knowledge`

| 字段           | 类型   | 必填 | 描述     |
| -------------- | ------ | ---- | -------- |
| `retrieveText` | string | 是   | 检索文本 |

### 2.3 `chat`

| 字段              | 类型        | 必填 | 描述                                       |
| ----------------- | ----------- | ---- | ------------------------------------------ |
| `knowledgeBaseId` | string      | 是   | 知识库 id                                  |
| `userMessage`     | string      | 是   | 检索文本（用户问题）                       |
| `threadId`        | string      | 是   | 会话 id                                    |
| `modelCode`       | string      | 是   | 大模型 id                                  |
| `searchType`      | **string**  | 是   | 检索类型 1-语义检索 2-全文检索 3-融合检索  |
| `enableRerank`    | **integer** | 是   | 是否开启重排，默认 false，0 不开启，1 开启 |
| `minRelevance`    | number      | 是   | 最小相关度，仅用于语义检索与结果重排       |

## 3. 问题清单

### P0-1 类型与语义冲突

| 字段                                                | 当前类型 | 实际语义                    | 后果                                                        |
| --------------------------------------------------- | -------- | --------------------------- | ----------------------------------------------------------- |
| `chat.searchType`                                   | string   | 枚举值 `"1" / "2" / "3"`    | 描述像数字，模型倾向传 number `1`；不一致时依赖网关隐式转换 |
| `chat.enableRerank`                                 | integer  | `0 / 1`                     | 描述里的 “false” 会让模型传布尔 `false`，实测直接 HTTP 400  |
| `search_knowledge.usingReRank`                      | string   | 布尔                        | 模型会传 `true` / `false` / `"true"`，类型不可预期          |
| `search_knowledge.rerankModel`                      | boolean  | 重排模型 code（字符串）     | 模型无法传入 `gte-rerank` 之类的模型 code                   |
| `search_knowledge.datasetSearchUsingExtensionQuery` | string   | 布尔                        | 同上                                                        |
| `search_knowledge.datasetSearchExtensionModel`      | boolean  | 问题优化模型 code（字符串） | 模型无法传入模型 code                                       |

实测结果（2026-10-29）：

- `chat` + `searchType: 1`（number）：网关隐式转换后成功；
- `chat` + `enableRerank: false`（boolean）：返回 HTTP 400 `Failed to convert value...`；
- `search_knowledge` + `usingReRank: true`、`rerankModel: "gte-rerank"`：当前均能成功（Java 侧做了宽松转换），但类型声明与语义不符，换模型或换网关后容易失效。

### P0-2 工具描述被截断

`search_knowledge` 的 description 在 `tools/list` 中只返回前半段，停在 `开启 datasetSearchUsingEx`。模型因此看不到：

- 何时应该开启问题优化 / 重排；
- 无结果时应该如何处理；
- 工具调用次数的建议。

建议：

- 将 description 控制在 500 字符以内；
- 把最重要的约束放在最前面（例如“无结果时不要换词重试”）；
- 详细参数说明放到各字段的 `description` 里，而不是工具级描述里。

### P1-1 `knowledgeBaseIds` 必填性不一致

字段描述写“必填”，但 `required` 只包含 `retrieveText`。模型因此可能省略该字段，检索范围退化为不确定状态。

### P1-2 缺少枚举、范围与默认值

以下字段建议补充约束，减少模型猜测空间：

- `searchMode` → `enum: ["embedding", "fullTextRecall", "mixedRecall"]`
- `searchType` → `enum: ["1", "2", "3"]`
- `enableRerank` → `enum: [0, 1]`
- `similarity` / `minRelevance` / `embeddingWeight` → `minimum: 0`, `maximum: 1`
- `limit` → `minimum: 1`, `maximum: 50`, `default: 5`
- `threadId` → `format: "uuid"` 或给出示例
- `modelCode` → 列出服务端实际支持的模型 code

### P1-3 参数错误返回 HTML

当前参数缺失时返回 Java Whitelabel 错误页：

```text
HTTP 400: <html><body><h1>Whitelabel Error Page</h1>...
Required String parameter 'retrieveText' is not present</body></html>
```

模型只能从 HTML 文本里猜原因，且不会得到结构化的字段名。建议改为 MCP 标准错误：

```json
{
  "isError": true,
  "content": [
    {
      "type": "text",
      "text": "{\"error\":\"INVALID_ARGUMENT\",\"field\":\"retrieveText\",\"message\":\"retrieveText is required\"}"
    }
  ]
}
```

### P1-4 空结果没有提示，模型反复换词检索

当前无结果时返回：

```json
{ "hasOk": true, "tip": null, "message": null, "bean": { "quoteVos": [] }, "save": false }
```

模型看到空数组后会自行判断“可能是关键词不对”，于是改写 query 再调用。建议在响应中显式给出终止信号：

```json
{
  "hasOk": true,
  "bean": { "quoteVos": [] },
  "hint": "没有匹配内容，请勿换关键词重复调用，直接告知用户未检索到相关内容"
}
```

同时在工具描述中写明“同一问题最多调用 1 次”。

### P2-1 `additionalProperties: false` 未生效

声明了 `additionalProperties: false`，但实测传入多余字段 `query` 时请求仍然成功，字段被静默忽略。建议要么由服务端真正校验并返回结构化错误，要么移除该声明，避免契约与行为不一致。

### P2-2 `list_knowledge` 返回结构不够明确

当前成功时 `bean` 是知识库 ID 字符串数组，无结果时是空数组；失败时是 HTML 400。建议统一为对象结构，例如：

```json
{ "knowledgeBaseIds": [], "hint": "没有可用知识库" }
```

## 4. 建议 schema

以下是建议的完整 `inputSchema`。类型收紧属于破坏性变更，建议按第 6 节的兼容策略分两步发布。

### 4.1 `search_knowledge`

```json
{
  "name": "search_knowledge",
  "description": "知识库检索工具。根据用户问题召回相关文档片段。无结果时不要换关键词重复调用，直接告知用户未检索到相关内容。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "retrieveText": {
        "type": "string",
        "description": "检索文本（用户问题）"
      },
      "searchMode": {
        "type": "string",
        "enum": ["embedding", "fullTextRecall", "mixedRecall"],
        "default": "embedding",
        "description": "检索模式：embedding 语义 / fullTextRecall 全文 / mixedRecall 混合"
      },
      "similarity": {
        "type": "number",
        "minimum": 0,
        "maximum": 1,
        "description": "最小相似度阈值"
      },
      "limit": {
        "type": "integer",
        "minimum": 1,
        "maximum": 50,
        "default": 5,
        "description": "最大返回条数"
      },
      "embeddingWeight": {
        "type": "number",
        "minimum": 0,
        "maximum": 1,
        "description": "语义检索权重（仅 mixedRecall 生效）"
      },
      "usingReRank": {
        "type": "boolean",
        "default": false,
        "description": "是否开启重排"
      },
      "rerankModel": {
        "type": "string",
        "description": "重排模型 code，例如 gte-rerank"
      },
      "datasetSearchUsingExtensionQuery": {
        "type": "boolean",
        "default": false,
        "description": "是否启用 LLM 问题优化"
      },
      "datasetSearchExtensionModel": {
        "type": "string",
        "description": "问题优化模型 code"
      },
      "datasetSearchExtensionBg": {
        "type": "string",
        "description": "问题优化背景描述"
      },
      "knowledgeBaseIds": {
        "type": "string",
        "description": "知识库 ID 列表，多个用英文逗号分隔，例如 'kb1,kb2'"
      }
    },
    "required": ["retrieveText", "knowledgeBaseIds"],
    "additionalProperties": false
  }
}
```

### 4.2 `list_knowledge`

```json
{
  "name": "list_knowledge",
  "description": "根据用户问题查询哪些知识库可用。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "retrieveText": {
        "type": "string",
        "minLength": 1,
        "description": "检索文本（用户问题）"
      }
    },
    "required": ["retrieveText"],
    "additionalProperties": false
  }
}
```

### 4.3 `chat`

```json
{
  "name": "chat",
  "description": "基于指定知识库内容生成专业回复。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "knowledgeBaseId": {
        "type": "string",
        "description": "知识库 ID"
      },
      "userMessage": {
        "type": "string",
        "description": "用户问题"
      },
      "threadId": {
        "type": "string",
        "description": "本轮会话 ID，同一轮多次调用共用同一个值"
      },
      "modelCode": {
        "type": "string",
        "enum": ["qwen-max", "MiniMax-M3"],
        "description": "生成模型 code，取值以服务端实际支持列表为准"
      },
      "searchType": {
        "type": "string",
        "enum": ["1", "2", "3"],
        "description": "1 语义检索 / 2 全文检索 / 3 融合检索"
      },
      "enableRerank": {
        "type": "integer",
        "enum": [0, 1],
        "description": "0 关闭重排 / 1 开启重排"
      },
      "minRelevance": {
        "type": "number",
        "minimum": 0,
        "maximum": 1,
        "default": 0.5,
        "description": "最小相关度，仅用于语义检索与结果重排"
      }
    },
    "required": [
      "knowledgeBaseId",
      "userMessage",
      "threadId",
      "modelCode",
      "searchType",
      "enableRerank",
      "minRelevance"
    ],
    "additionalProperties": false
  }
}
```

> `modelCode` 的 enum 中的值需要服务端确认后再定稿；如果暂时无法枚举，至少要在 description 中列出当前支持的模型 code。

## 5. 错误与空结果约定

建议统一遵循 MCP 语义：

| 场景                                 | 返回                                                              |
| ------------------------------------ | ----------------------------------------------------------------- |
| 参数缺失 / 类型错误                  | `isError: true`，`text` 为 JSON：`{ error, field, message }`      |
| 业务失败（知识库不存在、模型不可用） | `isError: true`，`text` 为 JSON：`{ error, code, message }`       |
| 检索成功但无结果                     | `isError: false`，`bean.quoteVos: []`，并附带 `hint` 提示不要重试 |
| 正常结果                             | `isError: false`，返回现有结构即可                                |

不要再返回 HTML 错误页。

## 6. 兼容性与迁移

1. **第一阶段（向后兼容）**：补 `enum`、`minimum/maximum`、`default`，加 `hint`；`searchType` 和 `enableRerank` 服务端继续接受 number / string / boolean 的旧形式。
2. **第二阶段（收紧）**：在客户端按新 schema 发布后，再拒绝旧类型。
3. **客户端同步点**：AionUi 的 `packages/desktop/src/renderer/utils/kb/injectKbPrompt.ts` 目前写的是 `searchType：1`，如改成 string enum，需要同步改为 `searchType："1"`；`modelCode：MiniMax-M3` 需要确认在 enum 中。
4. **描述长度**：工具级 description 控制在 500 字符以内，避免再次被截断。

## 7. 验收清单

- [ ] `tools/list` 返回的 `search_knowledge.description` 完整、未截断。
- [ ] `chat` 传 `searchType: "1"`、`enableRerank: 0` 成功。
- [ ] `chat` 传 `enableRerank: false` 返回结构化 `INVALID_ARGUMENT`，而不是 HTML 400。
- [ ] `search_knowledge` 传 `usingReRank: true`、`rerankModel: "gte-rerank"` 成功。
- [ ] 缺少 `retrieveText` 时返回结构化错误，包含 `field: "retrieveText"`。
- [ ] 检索无结果时返回 `hint`，模型不再换词重复调用。
- [ ] `additionalProperties: false` 的行为与文档一致（真正校验或移除）。
- [ ] `knowledgeBaseIds` 的必填性与 `required` 一致。
