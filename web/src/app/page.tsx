import Link from "next/link";
import { COLLECTION_LANDING_URL, COLLECTION_NAME } from "@/lib/constants";

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-semibold">NFT Glasses Collection</h1>
      <p className="mt-2 text-neutral-600">
        Коллекция <strong>{COLLECTION_NAME}</strong>. Фаза 0: каталог и галерея. Подключение кошелька и минт — позже.
      </p>
      <p className="mt-4 text-sm">
        <a href={COLLECTION_LANDING_URL} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
          Официальный лендинг коллекции →
        </a>
        <span className="text-neutral-400 mx-2">·</span>
        <Link href="/gallery" className="text-blue-600 hover:underline font-medium">Галерея</Link>
      </p>
      <p className="mt-2 text-xs text-neutral-400">
        Здесь — цифровой дух очков (каталог, позже минт и передарить). Товар и заказ — на лендинге.
      </p>
    </main>
  );
}
