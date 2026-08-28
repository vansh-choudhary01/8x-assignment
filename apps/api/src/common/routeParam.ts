/** Express 5 types `req.params` as `string | string[]`. Route params in this app are always a single string. */
export function routeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
