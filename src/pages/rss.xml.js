import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

function makeRootRelativeUrlsAbsolute(html, site) {
  return html?.replace(
    /(href|src)=(['"])(\/(?!\/)[^'"]*)\2/g,
    (_, attribute, quote, path) =>
      `${attribute}=${quote}${new URL(path, site).href}${quote}`,
  );
}

export async function GET(context) {
  const posts = (await getCollection("writing"))
    .filter(({ data }) => !data.draft)
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

  return rss({
    title: "Ethan Denny — Writing",
    description: "Writing by Ethan Denny.",
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      link: `/writing/${post.id}/`,
      content: makeRootRelativeUrlsAbsolute(post.rendered?.html, context.site),
    })),
  });
}
