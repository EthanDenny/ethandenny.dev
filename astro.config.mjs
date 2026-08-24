import { defineConfig } from "astro/config";

import inspectUrls from "@jsdevtools/rehype-url-inspector";
import tailwind from "@tailwindcss/vite";

export default defineConfig({
  site: "https://ethandenny.dev",
  vite: {
    plugins: [tailwind()],
  },
  markdown: {
    rehypePlugins: [
      [
        inspectUrls,
        {
          selectors: ["a[href]"],
          inspectEach(url) {
            url.node.properties.target = "_blank";
            url.node.properties.rel = "noopener noreferrer";
          },
        },
      ],
    ],
  },
});
