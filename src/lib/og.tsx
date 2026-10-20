import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

/** Shared 1200×630 social preview: brand, headline, one supporting line and an optional chip. */
export function renderOgImage({ title, subtitle, chip }: { title: string; subtitle: string; chip?: string }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #0b0d1a 0%, #171035 55%, #2a1366 100%)",
          color: "#f5f3ff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34, fontWeight: 700 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "linear-gradient(135deg, #7c5cff, #c084fc)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* lucide "zap": emoji would need a font fetched from a CDN at render time. */}
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round">
              <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
            </svg>
          </div>
          EloBoost
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {chip && (
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                padding: "8px 18px",
                borderRadius: 999,
                border: "2px solid rgba(196, 181, 253, 0.5)",
                color: "#ddd6fe",
                fontSize: 26,
              }}
            >
              {chip}
            </div>
          )}
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>{title}</div>
          <div style={{ fontSize: 32, color: "#c4b5fd", lineHeight: 1.35 }}>{subtitle}</div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
