"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f8fafc", margin: 0 }}>
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, textAlign: "center" }}>
          <div>
            <h1 style={{ fontSize: 24, color: "#0f172a" }}>QuizMaker is having trouble</h1>
            <p style={{ color: "#475569" }}>Please try again in a moment.</p>
            <button type="button" onClick={reset} style={{ marginTop: 12, height: 44, padding: "0 20px", borderRadius: 12, border: 0, background: "#4f46e5", color: "white", fontWeight: 600 }}>
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
