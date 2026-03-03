"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { COLLECTION_LANDING_URL, COLLECTION_NAME } from "@/lib/constants";

type Item = {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  image_url: string;
  rarity: string | null;
  lenses: string | null;
  frame: string | null;
  material: string | null;
  sort_order: number;
};

export default function GalleryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filterRarity, setFilterRarity] = useState<string | null>(null);
  const [filterFrame, setFilterFrame] = useState<string | null>(null);

  useEffect(() => {
    setFetchError(null);
    supabase
      .from("collection_items")
      .select("id, slug, name, description, image_url, rarity, lenses, frame, material, sort_order")
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          setFetchError(error.message);
          setItems([]);
        } else {
          setItems((data as Item[]) ?? []);
        }
        setLoading(false);
      })
      .catch((err) => {
        setFetchError(err?.message ?? "Ошибка загрузки");
        setLoading(false);
      });
  }, []);

  const rarities = [...new Set(items.map((i) => i.rarity).filter(Boolean))] as string[];
  const frames = [...new Set(items.map((i) => i.frame).filter(Boolean))] as string[];

  const filtered = items.filter((item) => {
    if (filterRarity && item.rarity !== filterRarity) return false;
    if (filterFrame && item.frame !== filterFrame) return false;
    return true;
  });

  function Card({ item }: { item: Item }) {
    return (
      <Link href={`/gallery/${item.id}`} className="group block">
        <div className="aspect-[45/55] relative overflow-hidden rounded-lg bg-white/5 mb-5">
          {item.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image_url}
              alt={item.name}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white/30 text-sm">нет фото</div>
          )}
        </div>
        <h2 className="text-xl font-medium tracking-tight text-white group-hover:text-white/90">
          {item.name}
        </h2>
        <p className="text-sm text-white/50 mt-1.5 tracking-wide">
          {[item.rarity, item.lenses, item.frame].filter(Boolean).join(" · ") || "—"}
        </p>
      </Link>
    );
  }

  const byRarity = (filterRarity || filterFrame)
    ? null
    : rarities.reduce<Record<string, Item[]>>((acc, r) => {
        acc[r] = filtered.filter((i) => i.rarity === r);
        return acc;
      }, {});
  const hasSections = byRarity && Object.keys(byRarity).length > 1;
  const noRarityItems = hasSections ? filtered.filter((i) => !i.rarity) : [];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white" style={{ backgroundColor: "#0a0a0a" }}>
      <header className="border-b border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-8 flex items-center justify-between flex-wrap gap-4">
          <Link href="/" className="text-white/60 hover:text-white text-sm tracking-[0.2em] uppercase">
            ← NFT Glasses
          </Link>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{COLLECTION_NAME}</h1>
          <a
            href={COLLECTION_LANDING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/50 hover:text-white/80 text-sm tracking-wide"
          >
            Лендинг коллекции →
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <p className="text-white/50 text-sm mb-14 max-w-lg tracking-wide">
          Физические очки и их цифровой дух. Товар — на{" "}
          <a href={COLLECTION_LANDING_URL} target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white underline">
            официальном лендинге
          </a>
          . Здесь — каталог; позже минт и передарить.
        </p>

        {(rarities.length > 0 || frames.length > 0) && (
          <div className="flex flex-wrap gap-2 mb-14">
            <span className="text-white/40 text-xs uppercase tracking-[0.2em] mr-2">Filter</span>
            {rarities.map((r) => (
              <button
                key={r}
                onClick={() => setFilterRarity(filterRarity === r ? null : r)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                  filterRarity === r
                    ? "border-white text-white bg-white/10"
                    : "border-white/20 text-white/60 hover:text-white/80 hover:border-white/40"
                }`}
              >
                {r}
              </button>
            ))}
            {frames.map((f) => (
              <button
                key={f}
                onClick={() => setFilterFrame(filterFrame === f ? null : f)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                  filterFrame === f
                    ? "border-white text-white bg-white/10"
                    : "border-white/20 text-white/60 hover:text-white/80 hover:border-white/40"
                }`}
              >
                {f}
              </button>
            ))}
            {(filterRarity || filterFrame) && (
              <button
                onClick={() => { setFilterRarity(null); setFilterFrame(null); }}
                className="px-3 py-1.5 text-xs text-white/40 hover:text-white/70"
              >
                clear
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 md:gap-12">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[45/55] bg-white/10 rounded-lg mb-5" />
                <div className="h-6 bg-white/10 rounded w-2/3 mb-2" />
                <div className="h-4 bg-white/5 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : fetchError ? (
          <div className="space-y-4">
            <p className="text-red-400 text-sm">Ошибка загрузки: {fetchError}</p>
            <p className="text-white/50 text-sm">Проверь, что в .env.local указаны NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY от того же проекта Supabase.</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-white/40 text-sm">Нет предметов в каталоге.</p>
        ) : hasSections ? (
          <div className="space-y-20">
            {noRarityItems.length > 0 && (
              <section>
                <h2 className="text-xs uppercase tracking-[0.25em] text-white/40 mb-8">Collection</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 md:gap-12">
                  {noRarityItems.map((item) => (
                    <Card key={item.id} item={item} />
                  ))}
                </div>
              </section>
            )}
            {byRarity && Object.entries(byRarity).map(([rarity, list]) =>
              list.length > 0 ? (
                <section key={rarity}>
                  <h2 className="text-xs uppercase tracking-[0.25em] text-white/40 mb-8">{rarity}</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 md:gap-12">
                    {list.map((item) => (
                      <Card key={item.id} item={item} />
                    ))}
                  </div>
                </section>
              ) : null
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 md:gap-12">
            {filtered.map((item) => (
              <Card key={item.id} item={item} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
