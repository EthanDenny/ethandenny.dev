import { createServer } from "node:http";
import { spawn } from "node:child_process";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const editorDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(editorDirectory, "..");
const publicDirectory = join(editorDirectory, "public");
const writingDirectory = join(projectDirectory, "src/content/writing");
const astroCli = join(projectDirectory, "node_modules/astro/astro.js");
const host = "127.0.0.1";
const editorPort = parsePort(process.env.EDITOR_PORT, 4321);
const sitePort = parsePort(process.env.SITE_PORT, 4322);
const siteUrl = `http://${host}:${sitePort}`;
const maxRequestBytes = 2 * 1024 * 1024;

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

await mkdir(writingDirectory, { recursive: true });

let astroProcess = null;
const managesAstro = !(await isSiteRunning());
if (managesAstro) await startAstro();

const server = createServer(async (request, response) => {
  response.on("error", (error) => console.error(error));

  try {
    await routeRequest(request, response);
  } catch (error) {
    const statusCode = Number.isInteger(error.statusCode)
      ? error.statusCode
      : 500;
    if (statusCode === 500) console.error(error);
    sendJson(response, statusCode, {
      error:
        statusCode === 500
          ? "The editor hit an unexpected error."
          : error.message,
    });
  }
});

server.listen(editorPort, host, () => {
  console.log(`\nWriting editor: http://${host}:${editorPort}`);
  console.log(`Site preview:  ${siteUrl}\n`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await stopAstro();
    server.close(() => process.exit(0));
  });
}

async function routeRequest(request, response) {
  const requestUrl = new URL(request.url ?? "/", `http://${host}`);
  const { pathname } = requestUrl;

  if (request.method === "GET" && pathname === "/api/config") {
    sendJson(response, 200, { siteUrl });
    return;
  }

  if (request.method === "GET" && pathname === "/api/posts") {
    sendJson(response, 200, { posts: await listPosts() });
    return;
  }

  if (pathname.startsWith("/api/posts/")) {
    const slug = decodeURIComponent(pathname.slice("/api/posts/".length));
    validateSlug(slug);

    if (request.method === "GET") {
      sendJson(response, 200, await readPost(slug));
      return;
    }

    if (request.method === "DELETE") {
      assertLocalMutation(request);
      await withAstroRestart(() => deletePost(slug));
      sendJson(response, 200, { deleted: slug });
      return;
    }
  }

  if (request.method === "POST" && pathname === "/api/posts") {
    assertLocalMutation(request);
    const post = validatePost(await readJsonBody(request));
    await withAstroRestart(() => savePost(post));
    const previewReady = await waitForPreview(post.slug);
    sendJson(response, 200, { saved: post.slug, previewReady });
    return;
  }

  if (request.method === "GET") {
    await serveStaticFile(pathname, response);
    return;
  }

  sendJson(response, 404, { error: "Not found." });
}

async function listPosts() {
  const files = await readdir(writingDirectory, { withFileTypes: true });
  const posts = await Promise.all(
    files
      .filter((file) => file.isFile() && file.name.endsWith(".md"))
      .map(async (file) => {
        const slug = file.name.slice(0, -3);
        const post = await readPost(slug);
        return {
          slug,
          title: post.title,
          date: post.date,
          draft: post.draft,
        };
      }),
  );

  return posts.sort(
    (first, second) =>
      second.date.localeCompare(first.date) ||
      first.title.localeCompare(second.title),
  );
}

async function readPost(slug) {
  let source;

  try {
    source = await readFile(postPath(slug), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      const notFound = new Error(`No post exists at “${slug}”.`);
      notFound.statusCode = 404;
      throw notFound;
    }
    throw error;
  }

  return { slug, ...parseMarkdown(source) };
}

async function savePost({ originalSlug, slug, title, date, draft, body }) {
  const destination = postPath(slug);
  const source = originalSlug ? postPath(originalSlug) : null;

  if (source !== destination && (await fileExists(destination))) {
    const conflict = new Error(`A post named “${slug}” already exists.`);
    conflict.statusCode = 409;
    throw conflict;
  }

  const temporary = `${destination}.${process.pid}.${Date.now()}.tmp`;
  const markdown = `---\ntitle: ${JSON.stringify(title)}\ndate: ${date}\ndraft: ${draft}\n---\n\n${body.trim()}\n`;

  await writeFile(temporary, markdown, "utf8");
  await rename(temporary, destination);

  if (source && source !== destination) {
    await unlink(source);
  }
}

async function deletePost(slug) {
  try {
    await unlink(postPath(slug));
  } catch (error) {
    if (error.code === "ENOENT") {
      const notFound = new Error(`No post exists at “${slug}”.`);
      notFound.statusCode = 404;
      throw notFound;
    }
    throw error;
  }
}

function parseMarkdown(source) {
  const match = source.match(
    /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/,
  );
  if (!match) {
    throw new Error("Post is missing valid frontmatter.");
  }

  const fields = Object.fromEntries(
    match[1]
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf(":");
        if (separator === -1) return [line.trim(), ""];
        return [
          line.slice(0, separator).trim(),
          parseScalar(line.slice(separator + 1).trim()),
        ];
      }),
  );

  return {
    title: String(fields.title ?? ""),
    date: String(fields.date ?? ""),
    draft: fields.draft === true,
    body: match[2].replace(/^\r?\n/, "").trimEnd(),
  };
}

function parseScalar(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value.startsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function validatePost(value) {
  if (!value || typeof value !== "object") {
    throw badRequest("Post data is required.");
  }

  const originalSlug = value.originalSlug || null;
  const slug = String(value.slug ?? "").trim();
  const title = String(value.title ?? "").trim();
  const date = String(value.date ?? "").trim();
  const draft = value.draft === true;
  const body = String(value.body ?? "");

  if (originalSlug) validateSlug(originalSlug);
  validateSlug(slug);
  if (!title || title.length > 200) {
    throw badRequest("Title must be between 1 and 200 characters.");
  }
  if (!isValidDate(date)) {
    throw badRequest("Date must be a real date in YYYY-MM-DD format.");
  }
  if (Buffer.byteLength(body, "utf8") > maxRequestBytes) {
    throw badRequest("Post body is too large.");
  }

  return { originalSlug, slug, title, date, draft, body };
}

function validateSlug(slug) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw badRequest("Slug must use lowercase letters, numbers, and hyphens.");
  }
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
  );
}

function postPath(slug) {
  return join(writingDirectory, `${slug}.md`);
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxRequestBytes) {
      throw badRequest("Request is too large.");
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw badRequest("Request body must be valid JSON.");
  }
}

async function serveStaticFile(pathname, response) {
  const requestedFile = pathname === "/" ? "index.html" : pathname.slice(1);
  if (!/^[a-z0-9.-]+$/i.test(requestedFile)) {
    sendText(response, 404, "Not found.");
    return;
  }

  const file = join(publicDirectory, requestedFile);
  try {
    const contents = await readFile(file);
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
      "Content-Security-Policy": `default-src 'self'; frame-src ${siteUrl}; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'`,
      "X-Content-Type-Options": "nosniff",
    });
    response.end(contents);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendText(response, 404, "Not found.");
      return;
    }
    throw error;
  }
}

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(value));
}

function sendText(response, statusCode, value) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(value);
}

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function assertLocalMutation(request) {
  const allowedHosts = new Set([
    `${host}:${editorPort}`,
    `localhost:${editorPort}`,
    `[::1]:${editorPort}`,
  ]);
  const origin = request.headers.origin;

  if (
    !allowedHosts.has(request.headers.host) ||
    (origin && !allowedHosts.has(new URL(origin).host))
  ) {
    const error = new Error("Editor changes are only accepted locally.");
    error.statusCode = 403;
    throw error;
  }
}

async function fileExists(file) {
  try {
    await stat(file);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function isSiteRunning() {
  try {
    const response = await fetch(siteUrl, {
      signal: AbortSignal.timeout(750),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function withAstroRestart(change) {
  if (!managesAstro) return change();

  await stopAstro();
  try {
    return await change();
  } finally {
    await startAstro();
  }
}

async function startAstro() {
  const child = spawn(
    process.execPath,
    [astroCli, "dev", "--host", host, "--port", String(sitePort)],
    {
      cwd: projectDirectory,
      stdio: "inherit",
    },
  );
  astroProcess = child;

  child.on("exit", (code, signal) => {
    if (astroProcess !== child) return;
    astroProcess = null;
    if (code !== 0 && signal !== "SIGTERM") {
      console.error(
        `Astro stopped unexpectedly (${signal ?? `exit ${code}`}).`,
      );
    }
  });

  const ready = await waitForUrl(siteUrl, 10_000);
  if (!ready) throw new Error("Astro did not start within 10 seconds.");
}

async function stopAstro() {
  const child = astroProcess;
  if (!child || child.exitCode !== null) return;
  astroProcess = null;

  await new Promise((resolveExit) => {
    const forceKill = setTimeout(() => child.kill("SIGKILL"), 3000);
    forceKill.unref();
    child.once("exit", () => {
      clearTimeout(forceKill);
      resolveExit();
    });
    child.kill("SIGTERM");
  });
}

async function waitForPreview(slug) {
  const previewUrl = `${siteUrl}/writing/${encodeURIComponent(slug)}`;
  return waitForUrl(previewUrl, 5000);
}

async function waitForUrl(url, timeout) {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(750),
      });
      if (response.ok) return true;
    } catch {
      // Astro may be restarting or refreshing its content collection.
    }
    await delay(250);
  }

  return false;
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

function parsePort(value, fallback) {
  const port = value ? Number(value) : fallback;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${value}`);
  }
  return port;
}

server.on("clientError", (_, socket) => {
  socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});
