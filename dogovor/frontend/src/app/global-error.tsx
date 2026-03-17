"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru">
      <body style={{ fontFamily: "system-ui", padding: "2rem", background: "#F8F8F6", color: "#0C0C0A" }}>
        <div style={{ maxWidth: "32rem", margin: "0 auto" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>
            Ошибка загрузки
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#8A8A82", marginBottom: "1rem" }}>
            {error.message}
          </p>
          {error.digest && (
            <p style={{ fontSize: "0.75rem", color: "#8A8A82", marginBottom: "1rem" }}>
              Код: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "0.5rem 1rem",
              background: "#0C0C0A",
              color: "#fff",
              border: "none",
              borderRadius: "0.25rem",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Попробовать снова
          </button>
        </div>
      </body>
    </html>
  );
}
