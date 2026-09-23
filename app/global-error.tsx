"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, -apple-system, sans-serif", padding: 24, textAlign: "center", background: "#0e1e24", color: "#e8eff1", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: 440, padding: 32, background: "#172b32", border: "1px solid #28444e", borderRadius: 8 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: "#fff" }}>Something went wrong</h2>
          <p style={{ color: "#7fa0a9", fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
            {error?.message || "An unexpected error occurred in the application."}
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: "9px 18px",
              background: "#1e4e5c",
              color: "#fff",
              border: "1px solid #2c6b7c",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
