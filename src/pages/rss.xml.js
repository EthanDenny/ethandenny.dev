import rss from "@astrojs/rss";

export function GET(context) {
  return rss({
    title: "Ethan Denny — Writing",
    description: "Writing by Ethan Denny.",
    site: context.site,
    items: [],
  });
}
