import { defineConfig } from "astro/config";

import tailwind from "@tailwindcss/vite";
import remarkEmbeds from "./src/lib/remark-embeds.mjs";

export default defineConfig({
  site: "https://ethandenny.dev",
  markdown: {
    remarkPlugins: [remarkEmbeds],
  },
  vite: {
    plugins: [tailwind()],
  },
});
