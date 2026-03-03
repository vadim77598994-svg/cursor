"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { COLLECTION_LANDING_URL } from "@/lib/constants";

type Item = {
  id: string;
  name: string;
  description: string | null;
  image_url: string;
  rarity: string | null;
  lenses: string | null;
  frame: string | null;
  material: string | null;
};

export default function GalleryItemPage() {
  const params = useParams();
  const id = params.id as string;
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("collection_items")
      .select("id, name, description, image_url, rarity, lenses, frame, material")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (!error) setItem(data as Item);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="animate-pulse text-white/40 text-sm">Loading…</div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center gap-4">
        <p className="text-white/50">Предмет не найден.</p>
        <Link href="/gallery" className="text-white/70 hover:text-white text-sm">← В галерею</Link>
      </div>
    );
  }

  const traits = [
    item.rarity && { label: "Редкость", value: item.rarity },
    item.lenses && { label: "Линзы", value: item.lenses },
    item.frame && { label: "Оправа", value: item.frame },
    item.material && { label: "Материал", value: item.material },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <Link href="/gallery" className="text-white/60 hover:text-white text-sm tracking-[0.2em] uppercase">
            ← Collection
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16 md:py-24">
        <div className="grid gap-14 md:grid-cols-2 md:gap-20">
          <div className="aspect-[45/55] relative overflow-hidden rounded-xl bg-white/5">
            {item.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.image_url}
                alt={item.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-white/30 text-sm">нет фото</div>
            )}
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-6">
              {item.name}
            </h1>
            {item.description && (
              <p className="text-white/60 text-sm leading-relaxed mb-8">
                {item.description}
              </p>
            )}
            <dl className="space-y-4 mb-12">
              {traits.map(({ label, value }) => (
                <div key={label} className="flex gap-6 text-sm">
                  <dt className="text-white/40 w-28 shrink-0 uppercase tracking-wider">{label}</dt>
                  <dd className="text-white/80 tracking-wide">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="border border-white/20 rounded-xl p-6 bg-white/5">
              <p className="text-white/50 text-sm mb-2 uppercase tracking-wider">Передарить цифровой дух</p>
              <p className="text-white/40 text-sm leading-relaxed mb-4">
                Скоро: подключи кошелёк и получи NFT — тогда сможешь передарить его другому адресу.
              </p>
              <a href={COLLECTION_LANDING_URL} target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-white text-sm underline">
                Купить очки — официальный лендинг →
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
