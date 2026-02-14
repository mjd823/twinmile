/**
 * UTM parameter capture for ad campaign tracking.
 *
 * When a visitor arrives via an ad link like:
 *   https://twinmile.com/drive-with-us?utm_source=facebook&utm_medium=cpc&utm_campaign=driver_q1
 *
 * We capture those params on page load and store them in sessionStorage so they
 * persist across page navigations within the same tab/session. When the visitor
 * submits a form, we attach the UTM data to the lead document.
 */

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

export type UtmParams = Partial<Record<(typeof UTM_KEYS)[number], string>>;

const STORAGE_KEY = "tw_utm";

/** Call once on page load (client-side only). Captures UTM params from the URL. */
export function captureUtm(): void {
  if (typeof window === "undefined") return;

  try {
    const url = new URL(window.location.href);
    const params: UtmParams = {};
    let found = false;

    for (const key of UTM_KEYS) {
      const val = url.searchParams.get(key);
      if (val) {
        params[key] = val;
        found = true;
      }
    }

    // Only overwrite if the current URL actually has UTM params.
    // This preserves the original UTM from the landing page across navigations.
    if (found) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(params));
    }
  } catch {
    // sessionStorage may be unavailable (private browsing, etc.)
  }
}

/** Retrieve stored UTM params. Returns undefined if none captured. */
export function getUtm(): UtmParams | undefined {
  if (typeof window === "undefined") return undefined;

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw) as UtmParams;
  } catch {
    return undefined;
  }
}
