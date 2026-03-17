"use client";

import { useEffect, useState } from "react";
import type { Location, Staff } from "@/lib/api";
import { API_BASE, fetchLocations, fetchStaff } from "@/lib/api";

type StepCabinetProps = {
  onNext: (location: Location, staff: Staff) => void;
};

// Corner marks decoration (nothing.tech style)
function CornerMarks({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute -left-[3px] -top-[3px] z-10 font-mono text-[9px] leading-none text-[#CACAC3]" aria-hidden>+</span>
      <span className="pointer-events-none absolute -right-[3px] -top-[3px] z-10 font-mono text-[9px] leading-none text-[#CACAC3]" aria-hidden>+</span>
      <span className="pointer-events-none absolute -bottom-[3px] -left-[3px] z-10 font-mono text-[9px] leading-none text-[#CACAC3]" aria-hidden>+</span>
      <span className="pointer-events-none absolute -bottom-[3px] -right-[3px] z-10 font-mono text-[9px] leading-none text-[#CACAC3]" aria-hidden>+</span>
      {children}
    </div>
  );
}

export function StepCabinet({ onNext }: StepCabinetProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const locs = await fetchLocations();
        if (!cancelled) setLocations(locs);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Ошибка загрузки");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedLocation) {
      setStaffList([]);
      setSelectedStaff(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchStaff(selectedLocation.city);
        if (!cancelled) {
          setStaffList(list);
          setSelectedStaff(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Ошибка загрузки оптометристов");
      }
    })();
    return () => { cancelled = true; };
  }, [selectedLocation]);

  const canNext = selectedLocation && selectedStaff;

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="font-mono text-[12px] uppercase tracking-[.1em] text-[var(--pye-muted)]">
          Загрузка…
        </p>
      </div>
    );
  }

  if (error) {
    const isNetwork = error.includes("fetch") || error.includes("Network") || error.includes("Failed");
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const isLocalApi = API_BASE.includes("localhost") || API_BASE.includes("127.0.0.1");
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-5 text-red-800">
        <p className="font-medium">Сервер недоступен</p>
        <p className="mt-1 text-sm">{error}</p>
        {isNetwork && (
          <div className="mt-4 rounded border border-red-200 bg-red-100/60 p-4 font-mono text-xs">
            <p className="font-semibold">Диагностика</p>
            <p className="mt-2 break-all">origin: {origin || "—"}</p>
            <p className="mt-1 break-all">API: {API_BASE}</p>
            {isLocalApi ? (
              <p className="mt-3 break-all">
                Задайте NEXT_PUBLIC_DOGOVOR_API_URL и сделайте redeploy фронта.
              </p>
            ) : (
              <p className="mt-3 break-all">
                Проверьте CORS_ORIGINS на бэкенде — должен содержать {origin}.
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* ── Кабинет ─────────────────────────────── */}
      <div>
        <div className="mb-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-[.05em] text-[var(--pye-text)]">
            Кабинет проверки зрения
          </h2>
          <p className="mt-0.5 font-mono text-[11px] text-[var(--pye-muted)]">
            Выберите точку оказания услуги
          </p>
        </div>
        <CornerMarks>
          <div className="overflow-hidden rounded-md border border-[var(--pye-border)] bg-white">
            {locations.map((loc, index) => (
              <button
                key={loc.id}
                type="button"
                onClick={() => setSelectedLocation(loc)}
                className={`flex w-full cursor-pointer items-center justify-between px-[18px] py-3.5 text-left transition-colors ${
                  index > 0 ? "border-t border-[var(--pye-border)]" : ""
                } ${
                  selectedLocation?.id === loc.id
                    ? "bg-[var(--pye-text)]"
                    : "bg-white hover:bg-[#FAFAF8]"
                }`}
              >
                <div>
                  <span
                    className={`block text-[13px] font-medium leading-snug ${
                      selectedLocation?.id === loc.id ? "text-white" : "text-[var(--pye-text)]"
                    }`}
                  >
                    {loc.name}
                  </span>
                  <span
                    className={`mt-0.5 block font-mono text-[10.5px] tracking-[.02em] ${
                      selectedLocation?.id === loc.id ? "text-white/40" : "text-[var(--pye-muted)]"
                    }`}
                  >
                    {loc.address}
                  </span>
                </div>
                <span
                  className={`ml-4 h-1.5 w-1.5 shrink-0 rounded-full transition-all ${
                    selectedLocation?.id === loc.id
                      ? "bg-[var(--pye-accent)] shadow-[0_0_6px_rgba(232,68,10,.45)]"
                      : "border border-[var(--pye-border)]"
                  }`}
                />
              </button>
            ))}
          </div>
        </CornerMarks>
      </div>

      {/* ── Оптометрист ─────────────────────────── */}
      {selectedLocation && (
        <div>
          <div className="mb-3">
            <h3 className="text-[13px] font-semibold uppercase tracking-[.05em] text-[var(--pye-text)]">
              Оптометрист
            </h3>
            <p className="mt-0.5 font-mono text-[11px] text-[var(--pye-muted)]">
              Выберите специалиста
            </p>
          </div>
          <CornerMarks>
            <div className="overflow-hidden rounded-md border border-[var(--pye-border)] bg-white">
              {staffList.map((s, index) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedStaff(s)}
                  className={`flex w-full cursor-pointer items-center justify-between px-[18px] py-3.5 text-left transition-colors ${
                    index > 0 ? "border-t border-[var(--pye-border)]" : ""
                  } ${
                    selectedStaff?.id === s.id
                      ? "bg-[var(--pye-text)]"
                      : "bg-white hover:bg-[#FAFAF8]"
                  }`}
                >
                  <span
                    className={`text-[13px] font-medium ${
                      selectedStaff?.id === s.id ? "text-white" : "text-[var(--pye-text)]"
                    }`}
                  >
                    {s.fio}
                  </span>
                  <span
                    className={`ml-4 h-1.5 w-1.5 shrink-0 rounded-full transition-all ${
                      selectedStaff?.id === s.id
                        ? "bg-[var(--pye-accent)] shadow-[0_0_6px_rgba(232,68,10,.45)]"
                        : "border border-[var(--pye-border)]"
                    }`}
                  />
                </button>
              ))}
            </div>
          </CornerMarks>
        </div>
      )}

      {/* ── Кнопка ──────────────────────────────── */}
      <button
        type="button"
        onClick={() => canNext && onNext(selectedLocation!, selectedStaff!)}
        disabled={!canNext}
        className="flex min-h-[48px] w-full items-center justify-between rounded-[4px] bg-[var(--pye-text)] px-5 py-4 transition-colors hover:bg-[#1C1C18] disabled:cursor-not-allowed disabled:bg-[var(--pye-border)] disabled:text-[var(--pye-muted)]"
      >
        <span className="flex-1 text-center text-[13px] font-medium text-white">
          Далее — сканирование паспорта
        </span>
        <span className="ml-3 font-mono text-base text-white" aria-hidden>→</span>
      </button>

    </div>
  );
}
