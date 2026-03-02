import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Чтобы Next не путал корень из‑за нескольких lockfile в системе
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
