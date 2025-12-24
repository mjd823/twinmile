export function getClientIp(req: Request): string {
  const xfwd = req.headers.get("x-forwarded-for");
  if (xfwd) {
    const first = xfwd.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}

export function getUserAgent(req: Request): string {
  return req.headers.get("user-agent") ?? "";
}
