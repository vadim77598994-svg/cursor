"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-xl font-semibold text-[var(--pye-text)]">Ошибка загрузки</h1>
      <p className="mt-2 font-mono text-sm text-[var(--pye-muted)]">{error.message}</p>
      {error.digest && (
        <p className="mt-1 font-mono text-xs text-[var(--pye-muted)]">Код: {error.digest}</p>
      )}
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 min-h-[44px] rounded-lg bg-[var(--pye-text)] px-5 py-2.5 font-mono text-sm text-white hover:opacity-90"
      >
        Попробовать снова
      </button>
    </div>
  );
}
