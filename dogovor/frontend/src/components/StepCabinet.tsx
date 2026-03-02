"use client";

import { useEffect, useState } from "react";
import type { Location, Staff } from "@/lib/api";
import { fetchLocations, fetchStaff } from "@/lib/api";

type StepCabinetProps = {
  onNext: (location: Location, staff: Staff) => void;
};

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
    return () => {
      cancelled = true;
    };
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
    return () => {
      cancelled = true;
    };
  }, [selectedLocation]);

  const canNext = selectedLocation && selectedStaff;

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-lg text-gray-500">Загрузка кабинетов…</p>
      </div>
    );
  }

  if (error) {
    const isNetwork = error.includes("fetch") || error.includes("Network") || error.includes("Failed");
    return (
      <div className="rounded-xl bg-red-50 p-6 text-red-800">
        <p className="font-medium">Сервер недоступен</p>
        <p className="mt-1">{error}</p>
        {isNetwork && (
          <div className="mt-4 rounded-lg bg-red-100/80 p-4 font-mono text-sm">
            <p className="font-semibold">Запустите бэкенд в отдельном терминале:</p>
            <p className="mt-1 break-all">cd ~/Desktop/cursor/dogovor/backend && ./run.sh</p>
            <p className="mt-2 text-xs opacity-90">После появления «Uvicorn running on http://127.0.0.1:8000» обновите страницу.</p>
          </div>
        )}
        {!isNetwork && (
          <p className="mt-2 text-sm">Проверьте, что бэкенд запущен (port 8000) и в Supabase выполнена миграция.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Кабинет проверки зрения</h2>
        <p className="mt-1 text-gray-600">Выберите точку оказания услуги</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-1">
        {locations.map((loc) => (
          <button
            key={loc.id}
            type="button"
            onClick={() => setSelectedLocation(loc)}
            className={`rounded-xl border-2 p-4 text-left transition ${
              selectedLocation?.id === loc.id
                ? "border-medical-blue bg-medical-blue-light"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <span className="font-medium">{loc.name}</span>
            <span className="mt-1 block text-sm text-gray-600">{loc.address}</span>
          </button>
        ))}
      </div>

      {selectedLocation && (
        <div>
          <h3 className="mb-3 text-lg font-semibold text-gray-900">Оптометрист</h3>
          <div className="grid gap-3 sm:grid-cols-1">
            {staffList.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedStaff(s)}
                className={`rounded-xl border-2 p-4 text-left transition ${
                  selectedStaff?.id === s.id
                    ? "border-medical-blue bg-medical-blue-light"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <span className="font-medium">{s.fio}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="pt-4">
        <button
          type="button"
          onClick={() => canNext && onNext(selectedLocation!, selectedStaff!)}
          disabled={!canNext}
          className="w-full rounded-xl bg-medical-blue px-6 py-4 text-lg font-medium text-white shadow-md transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Далее — сканирование паспорта
        </button>
      </div>
    </div>
  );
}
