export function isSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  const urlOrigin = new URL(req.url).origin;

  const candidate = origin ?? (referer ? new URL(referer).origin : null);
  if (!candidate) return true;

  return candidate === urlOrigin;
}
