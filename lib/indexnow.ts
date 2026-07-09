/**
 * IndexNow instant-indexing ping (Bing/Yandex/Seznam — free, no signup).
 *
 * The key is NOT a secret: it is a public proof-of-ownership served at
 * https://twinmile.com/{key}.txt (see public/{key}.txt). Search engines
 * fetch that file to verify we own the host before honoring pings.
 *
 * Fire-and-forget: never throws, 5s timeout, logs the result.
 */

const INDEXNOW_HOST = "twinmile.com";
const INDEXNOW_KEY = "434bccd7ef03123a3112110abc0d864f2e13c0abd859ba075a2eb2332bbb2bda";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

export async function pingIndexNow(urls: string[]): Promise<void> {
  if (!urls.length) return;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: INDEXNOW_HOST,
        key: INDEXNOW_KEY,
        keyLocation: `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`,
        urlList: urls,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    console.log(
      JSON.stringify({ event: "indexnow_ping", status: res.status, urls, ts: new Date().toISOString() })
    );
  } catch (error: any) {
    console.warn(`[indexnow] ping failed (non-fatal): ${error?.message || error}`);
  }
}
