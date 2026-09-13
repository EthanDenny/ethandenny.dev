const previews = new Map();
const maxResponseBytes = 1024 * 1024;

export default function remarkEmbeds() {
  return async (tree) => {
    const standaloneLinks = findStandaloneLinks(tree);

    await Promise.all(
      standaloneLinks.map(async ({ node, listItem, url }) => {
        const preview = await getPreview(url);
        if (!preview) return;

        node.type = "html";
        node.value = renderPreview(preview);
        delete node.children;

        if (listItem) {
          listItem.data = {
            ...listItem.data,
            hProperties: {
              ...listItem.data?.hProperties,
              className: ["embed-list-item"],
            },
          };
        }
      }),
    );
  };
}

function findStandaloneLinks(tree) {
  const links = [];

  walk(tree, null, (node, parent) => {
    if (node.type !== "paragraph" || node.children?.length !== 1) return;

    const link = node.children[0];
    if (link.type !== "link" || !isBareUrl(link)) return;

    let listItem = null;
    if (parent?.type === "listItem" && parent.children.length === 1) {
      listItem = parent;
    }

    links.push({ node, listItem, url: link.url });
  });

  return links;
}

function walk(node, parent, visit) {
  visit(node, parent);
  for (const child of node.children ?? []) walk(child, node, visit);
}

function isBareUrl(link) {
  if (link.children.length !== 1 || link.children[0].type !== "text") {
    return false;
  }

  return link.children[0].value === link.url && isPublicHttpUrl(link.url);
}

function isPublicHttpUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;

    const hostname = url.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "::1" ||
      hostname.endsWith(".local") ||
      isPrivateIpv4(hostname) ||
      /^(?:fc|fd|fe8|fe9|fea|feb)/i.test(hostname.replaceAll(":", ""))
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function isPrivateIpv4(hostname) {
  const octets = hostname.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }

  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

async function getPreview(url) {
  if (!previews.has(url)) {
    previews.set(
      url,
      loadPreview(url).catch((error) => {
        console.warn(`[embeds] ${url}: ${error.message}`);
        return null;
      }),
    );
  }

  return previews.get(url);
}

async function loadPreview(url) {
  if (isTweetUrl(url)) {
    const tweet = await loadTweet(url);
    if (tweet) return tweet;
  }

  return loadWebpage(url);
}

function isTweetUrl(value) {
  const url = new URL(value);
  return (
    ["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(
      url.hostname.toLowerCase(),
    ) && /^\/[^/]+\/status\/\d+/.test(url.pathname)
  );
}

async function loadTweet(url) {
  const endpoint = new URL("https://publish.twitter.com/oembed");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("omit_script", "true");
  endpoint.searchParams.set("dnt", "true");

  const response = await fetchWithTimeout(endpoint, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;

  const tweet = await response.json();
  if (!tweet.html || !tweet.author_name) return null;

  return {
    type: "tweet",
    url,
    authorName: tweet.author_name,
    authorUrl: tweet.author_url,
    html: stripScripts(tweet.html),
  };
}

async function loadWebpage(url) {
  const response = await fetchWithTimeout(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "ethandenny.dev link preview",
    },
  });
  if (!response.ok) return null;

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return null;

  const html = await readLimitedText(response);
  const metadata = readMetadata(html);
  const resolvedUrl = response.url || url;
  const hostname = new URL(resolvedUrl).hostname.replace(/^www\./, "");
  const title =
    metadata["og:title"] || metadata["twitter:title"] || readTitle(html);

  if (!title) return null;

  return {
    type: "link",
    url,
    siteName: metadata["og:site_name"] || hostname,
    title,
    description:
      metadata["og:description"] ||
      metadata["twitter:description"] ||
      metadata.description ||
      "",
    image: resolveUrl(
      metadata["og:image"] || metadata["twitter:image"],
      resolvedUrl,
    ),
  };
}

async function fetchWithTimeout(url, options) {
  return fetch(url, {
    ...options,
    redirect: "follow",
    signal: AbortSignal.timeout(5000),
  });
}

async function readLimitedText(response) {
  const reader = response.body?.getReader();
  if (!reader) return "";

  const chunks = [];
  let size = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    size += value.byteLength;
    if (size > maxResponseBytes) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(
    chunks.reduce((total, chunk) => total + chunk.length, 0),
  );
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(bytes);
}

function readMetadata(html) {
  const metadata = {};
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];

  for (const tag of tags) {
    const attributes = readAttributes(tag);
    const key = (attributes.property || attributes.name || "").toLowerCase();
    if (key && attributes.content && !metadata[key]) {
      metadata[key] = decodeHtml(attributes.content.trim());
    }
  }

  return metadata;
}

function readAttributes(tag) {
  const attributes = {};
  const pattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match;

  while ((match = pattern.exec(tag))) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }

  return attributes;
}

function readTitle(html) {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtml(match[1].replace(/\s+/g, " ").trim()) : "";
}

function decodeHtml(value) {
  return value
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([\da-f]+);/gi, (_, number) =>
      String.fromCodePoint(Number.parseInt(number, 16)),
    )
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function resolveUrl(value, base) {
  if (!value) return "";
  try {
    return new URL(value, base).href;
  } catch {
    return "";
  }
}

function renderPreview(preview) {
  return preview.type === "tweet" ? renderTweet(preview) : renderLink(preview);
}

function renderTweet(preview) {
  return `<article class="embed-card tweet-preview">
  <header class="embed-card-header">
    <a href="${escapeAttribute(preview.authorUrl)}">${escapeHtml(preview.authorName)}</a>
    <span>x.com</span>
  </header>
  ${preview.html}
</article>`;
}

function renderLink(preview) {
  const description = preview.description
    ? `<span class="embed-card-description">${escapeHtml(preview.description)}</span>`
    : "";
  const image = preview.image
    ? `<img src="${escapeAttribute(preview.image)}" alt="" loading="lazy" />`
    : "";

  return `<a class="embed-card link-preview" href="${escapeAttribute(preview.url)}">
  <span class="embed-card-copy">
    <span class="embed-card-site">${escapeHtml(preview.siteName)}</span>
    <strong>${escapeHtml(preview.title)}</strong>
    ${description}
  </span>
  ${image}
</a>`;
}

function stripScripts(value) {
  return value.replace(/<script\b[\s\S]*?<\/script>/gi, "").trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value ?? "");
}
