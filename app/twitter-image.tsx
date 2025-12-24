import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Twin Mile LLC";
export const size = {
  width: 1200,
  height: 630,
};

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#0B0C0E",
          color: "#FFFFFF",
        }}
      >
        <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.05 }}>
          Twin Mile LLC
        </div>
        <div style={{ marginTop: 18, fontSize: 36, color: "#B5B8C0" }}>
          Logistics Built for the Urgent.
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
