import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const configFilename = fileURLToPath(import.meta.url);
const configDir = path.dirname(configFilename);

const nextConfig: NextConfig = {
  turbopack: {
    root: configDir,
  },
  async redirects() {
    return [
      {
        source: "/cord",
        destination: "/",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
