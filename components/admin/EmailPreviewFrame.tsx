"use client";

import * as React from "react";

/**
 * Branded email preview iframe — renders the FULL HTML document exactly as
 * delivered (header, logo, teal CTA, footer) and grows to the content height
 * on load so nothing clips on the owner's phone.
 *
 * sandbox="allow-same-origin" (NO allow-scripts): scripts stay blocked, but
 * we can measure the document height for auto-sizing.
 */
export function EmailPreviewFrame({
  html,
  minHeight = 360,
  title = "Email preview",
}: {
  html: string;
  minHeight?: number;
  title?: string;
}) {
  const ref = React.useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = React.useState(minHeight);

  const measure = React.useCallback(() => {
    try {
      const doc = ref.current?.contentDocument;
      if (!doc) return;
      const h = Math.max(
        doc.body?.scrollHeight || 0,
        doc.documentElement?.scrollHeight || 0
      );
      if (h > 0) setHeight(Math.max(minHeight, h + 8));
    } catch {
      // Cross-origin or not ready — keep the fallback height with scrolling.
    }
  }, [minHeight]);

  return (
    <div className="overflow-hidden rounded-md border border-border/60 bg-white">
      <iframe
        ref={ref}
        srcDoc={html}
        title={title}
        sandbox="allow-same-origin"
        onLoad={measure}
        style={{ height }}
        className="w-full border-0"
        scrolling="auto"
      />
    </div>
  );
}
