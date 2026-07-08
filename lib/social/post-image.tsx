import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { SITE_CONFIG } from "@/lib/site-config";
import { TRUST_LINE, type RecruitingPost } from "@/lib/social/post-pack";

/**
 * Instagram-portrait (1080x1350) recruiting post image rendered with next/og
 * (ImageResponse / satori). Architecture ported from jaelynnsfashion
 * lib/social/post-image.tsx; visual language is Twin Mile's: near-black
 * background, amber accents, bold condensed trucking energy.
 *
 * Images are rendered on demand by /api/social-image (no blob storage is
 * configured on this project) — rendering is a pure function of the post
 * fields, so the same pack always produces the same image.
 */

export const POST_WIDTH = 1080;
export const POST_HEIGHT = 1350;

const AMBER = "#F59E0B";
const AMBER_DIM = "rgba(245,158,11,0.55)";

interface OgFont {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700;
  style: "normal";
}

let fontsPromise: Promise<OgFont[]> | null = null;

/**
 * Real Twin Mile logo (public/brand/twinmile-logo.png, 1408x287 transparent
 * PNG) embedded as a data URI — satori can't fetch relative URLs, and a data
 * URI keeps rendering a pure function of the post fields. Loaded once per
 * process; falls back to the text wordmark if the file is missing.
 */
let logoDataUri: string | null | undefined;

function getLogoDataUri(): string | null {
  if (logoDataUri !== undefined) return logoDataUri;
  try {
    const buf = readFileSync(join(process.cwd(), "public", "brand", "twinmile-logo.png"));
    logoDataUri = `data:image/png;base64,${buf.toString("base64")}`;
  } catch (err) {
    console.warn("[social-pack] Brand logo unavailable, using text wordmark:", (err as Error)?.message);
    logoDataUri = null;
  }
  return logoDataUri;
}

/**
 * Best-effort bold display font (Google Fonts serves TTF to UA-less fetches).
 * On any failure we fall back to the default font bundled with next/og —
 * the image still renders, just without true bold.
 */
async function loadFonts(): Promise<OgFont[]> {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      const css = await fetch(
        "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap"
      ).then((res) => {
        if (!res.ok) throw new Error(`font css ${res.status}`);
        return res.text();
      });
      const faces = Array.from(
        css.matchAll(/font-weight:\s*(400|700);[^}]*?src:\s*url\((https:[^)]+\.ttf)\)/g)
      );
      if (faces.length === 0) throw new Error("no ttf urls in font css");
      const fonts: OgFont[] = [];
      for (const [, weight, url] of faces) {
        const data = await fetch(url).then((res) => {
          if (!res.ok) throw new Error(`font ttf ${res.status}`);
          return res.arrayBuffer();
        });
        fonts.push({
          name: "Inter",
          data,
          weight: Number(weight) as 400 | 700,
          style: "normal" as const,
        });
      }
      return fonts;
    })().catch((err) => {
      console.warn("[social-pack] Bold font unavailable, using default font:", err?.message);
      fontsPromise = null;
      return [];
    });
  }
  return fontsPromise;
}

export async function renderRecruitingPostPng(post: RecruitingPost): Promise<Buffer> {
  const fonts = await loadFonts();
  const bold = { fontFamily: "Inter", fontWeight: 700 as const };
  const headlineLines = post.headline.split("\n");
  const logo = getLogoDataUri();

  const response = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundImage: "linear-gradient(180deg, #0B0C0E 0%, #15100A 62%, #1C1406 100%)",
          color: "#ffffff",
          padding: "56px 64px",
        }}
      >
        {/* Header: wordmark + site */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {logo ? (
            // Real Twin Mile Logistics logo (gray/blue reads cleanly on the dark bg)
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="Twin Mile Logistics" width={314} height={64} />
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div
                style={{
                  width: 16,
                  height: 44,
                  backgroundColor: AMBER,
                  display: "flex",
                }}
              />
              <span style={{ ...bold, fontSize: 40, letterSpacing: 6 }}>TWIN MILE</span>
            </div>
          )}
          <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 28 }}>twinmile.com</span>
        </div>

        {/* Kicker */}
        <div style={{ display: "flex", marginTop: 90 }}>
          <span
            style={{
              ...bold,
              fontSize: 26,
              letterSpacing: 8,
              color: AMBER,
              border: `2px solid ${AMBER_DIM}`,
              borderRadius: 9999,
              padding: "10px 28px",
            }}
          >
            OWNER-OPERATORS
          </span>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 44 }}>
          {headlineLines.map((line, i) => (
            <span
              key={i}
              style={{
                ...bold,
                fontSize: 104,
                lineHeight: 1.08,
                letterSpacing: -1,
                color: i === headlineLines.length - 1 ? AMBER : "#ffffff",
              }}
            >
              {line}
            </span>
          ))}
          <span style={{ color: "rgba(255,255,255,0.78)", fontSize: 36, marginTop: 26 }}>
            {post.sub}
          </span>
        </div>

        {/* Proof points */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 26,
            marginTop: 64,
          }}
        >
          {post.bullets.map((bullet, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 22 }}>
              <div
                style={{
                  width: 14,
                  height: 14,
                  backgroundColor: AMBER,
                  transform: "rotate(45deg)",
                  display: "flex",
                }}
              />
              <span style={{ fontSize: 36, color: "rgba(255,255,255,0.92)" }}>{bullet}</span>
            </div>
          ))}
        </div>

        {/* Spacer */}
        <div style={{ display: "flex", flexGrow: 1 }} />

        {/* CTA bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: AMBER,
            borderRadius: 16,
            padding: "26px 36px",
          }}
        >
          <span style={{ ...bold, fontSize: 40, color: "#0B0C0E" }}>Drive with us →</span>
          <span style={{ ...bold, fontSize: 30, color: "rgba(11,12,14,0.75)" }}>
            twinmile.com/drive-with-us
          </span>
        </div>

        {/* Trust line */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 30,
          }}
        >
          <span style={{ fontSize: 26, color: "rgba(255,255,255,0.6)" }}>{TRUST_LINE}</span>
          <span style={{ fontSize: 26, color: "rgba(255,255,255,0.6)" }}>
            {SITE_CONFIG.phone}
          </span>
        </div>
      </div>
    ),
    {
      width: POST_WIDTH,
      height: POST_HEIGHT,
      fonts: fonts.length > 0 ? fonts : undefined,
    }
  );

  return Buffer.from(await response.arrayBuffer());
}
