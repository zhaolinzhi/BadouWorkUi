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
