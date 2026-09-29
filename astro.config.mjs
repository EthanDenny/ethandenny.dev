import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";

import tailwind from "@tailwindcss/vite";
import remarkEmbeds from "./src/lib/remark-embeds.mjs";

export default defineConfig({
  site: "https://ethandenny.dev",
  markdown: {
    processor: unified({ remarkPlugins: [remarkEmbeds] }),
  },
  vite: {
    plugins: [tailwind()],
  },
});
