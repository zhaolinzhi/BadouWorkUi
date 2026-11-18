/**
 * 极简 className 拼接。
 *
 * 不引 `classnames` —— 这个包是共享层,多一个依赖就多一份版本对齐负担,
 * 而这里只需要「拼上非空片段」这一件事。
 */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
