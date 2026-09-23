"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="panel panel-pad" style={{ maxWidth: 480, margin: "40px auto", textAlign: "center" }}>
      <h2 style={{ fontSize: 18, marginBottom: 8, color: "var(--danger)" }}>An error occurred</h2>
      <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
        {error?.message || "Something went wrong while loading this view."}
      </p>
      <button className="btn" onClick={() => reset()}>
        Try again
      </button>
    </div>
  );
}
