import { defineConfig } from "astro/config";

import tailwind from "@tailwindcss/vite";

export default defineConfig({
  site: "https://ethandenny.dev",
  vite: {
    plugins: [tailwind()],
  },
});
