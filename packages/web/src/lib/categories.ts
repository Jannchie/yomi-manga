export function resolveCategoryLabel(
  type: string,
  t: (key: string) => string,
  te: (key: string) => boolean,
): string {
  const key = `categories.${type}`
  return te(key) ? t(key) : type
}
