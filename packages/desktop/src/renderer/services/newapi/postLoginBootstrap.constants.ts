/**
 * NewAPI 登录后自动建 Provider 链路所用的常量。
 * 集中在一处,便于审计与单测覆盖。
 */

export const NEWAPI_MASK_FOR_CURRENT_PATH = '/project/newapi/newapikeyqueryaction/maskForCurrent';

/** 固定的 provider id — 二次登录(同 id 撞 409)时按"已存在"处理。 */
export const NEWAPI_PROVIDER_ID = 'newapi-default';

/** Provider 展示名。 */
export const NEWAPI_PROVIDER_NAME = '默认';

/** NewAPI 兼容 OpenAI 协议的 base url(完整路径,含 /v1)。 */
export const NEWAPI_BASE_URL = 'https://qw.badousoft.com/ai-proxy/v1';

/** 自动建好的 provider 默认带这一个模型,用户后续可在设置里 + 拉取更多。 */
export const NEWAPI_DEFAULT_MODEL = 'deepseek-v4-flash';

/**
 * 默认模型在登录后被自动建好时 / 已有 provider 回填时携带的 model_settings。
 * 当前只注入 tool_wire_shape: NewAPI 兼容 OpenAI 协议下,deepseek 系列
 * upstream 期望扁平 tools 格式(open_ai_flat_function);不注入会导致
 * 第一次对话报 USER_LLM_PROVIDER_INVALID_REQUEST(tools[i].name missing)。
 */
export const NEWAPI_DEFAULT_MODEL_SETTINGS = {
  tool_wire_shape: 'open_ai_flat_function',
} as const;
