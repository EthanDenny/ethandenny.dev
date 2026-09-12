const elements = {
  body: document.querySelector("#body"),
  date: document.querySelector("#date"),
  deletePost: document.querySelector("#delete-post"),
  form: document.querySelector("#post-form"),
  newPost: document.querySelector("#new-post"),
  openPreview: document.querySelector("#open-preview"),
  posts: document.querySelector("#posts"),
  preview: document.querySelector("#preview"),
  refreshPreview: document.querySelector("#refresh-preview"),
  save: document.querySelector("#save"),
  slug: document.querySelector("#slug"),
  status: document.querySelector("#status"),
  title: document.querySelector("#title"),
};

const state = {
  currentSlug: null,
  dirty: false,
  posts: [],
  siteUrl: "http://127.0.0.1:4322",
  slugEdited: false,
};

await initialize();

async function initialize() {
  try {
    const config = await request("/api/config");
    state.siteUrl = config.siteUrl;
    await loadPosts();
    if (state.posts.length) {
      await openPost(state.posts[0].slug, false);
    } else {
      startNewPost(false);
    }
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function loadPosts() {
  const { posts } = await request("/api/posts");
  state.posts = posts;
  renderPostList();
}

function renderPostList() {
  elements.posts.replaceChildren(
    ...state.posts.map((post) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = post.slug === state.currentSlug ? "selected" : "";
      button.dataset.slug = post.slug;

      const title = document.createElement("strong");
      title.textContent = post.title;
      const date = document.createElement("time");
      date.dateTime = post.date;
      date.textContent = post.date;
      button.append(title, date);
      button.addEventListener("click", () => openPost(post.slug));
      return button;
    }),
  );
}

async function openPost(slug, confirmNavigation = true) {
  if (confirmNavigation && !canLeaveDraft()) return;

  try {
    setStatus("loading…");
    const post = await request(`/api/posts/${encodeURIComponent(slug)}`);
    state.currentSlug = post.slug;
    state.slugEdited = true;
    elements.title.value = post.title;
    elements.slug.value = post.slug;
    elements.date.value = post.date;
    elements.body.value = post.body;
    elements.deletePost.hidden = false;
    setDirty(false);
    renderPostList();
    refreshPreview();
  } catch (error) {
    setStatus(error.message, "error");
  }
}

function startNewPost(confirmNavigation = true) {
  if (confirmNavigation && !canLeaveDraft()) return;

  state.currentSlug = null;
  state.slugEdited = false;
  elements.form.reset();
  elements.date.value = today();
  elements.deletePost.hidden = true;
  setDirty(false);
  renderPostList();
  clearPreview();
  elements.title.focus();
}

async function savePost(event) {
  event.preventDefault();
  if (!elements.form.reportValidity()) return;

  elements.save.disabled = true;
  setStatus("saving…");

  try {
    const post = {
      originalSlug: state.currentSlug,
      slug: elements.slug.value.trim(),
      title: elements.title.value.trim(),
      date: elements.date.value,
      body: elements.body.value,
    };
    await request("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(post),
    });
    state.currentSlug = post.slug;
    state.slugEdited = true;
    setDirty(false);
    await loadPosts();
    elements.deletePost.hidden = false;
    setStatus("saved", "success");
    window.setTimeout(refreshPreview, 300);
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    elements.save.disabled = false;
  }
}

async function deletePost() {
  if (!state.currentSlug) return;
  const title = elements.title.value || state.currentSlug;
  if (!window.confirm(`Delete “${title}”? This removes its Markdown file.`))
    return;

  try {
    setStatus("deleting…");
    await request(`/api/posts/${encodeURIComponent(state.currentSlug)}`, {
      method: "DELETE",
    });
    state.currentSlug = null;
    await loadPosts();
    if (state.posts.length) {
      await openPost(state.posts[0].slug, false);
    } else {
      startNewPost(false);
    }
    setStatus("deleted", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

function refreshPreview() {
  const slug = state.currentSlug;
  if (!slug) {
    clearPreview();
    return;
  }

  const url = `${state.siteUrl}/writing/${encodeURIComponent(slug)}`;
  elements.preview.src = `${url}?editor=${Date.now()}`;
  elements.openPreview.href = url;
  elements.openPreview.removeAttribute("aria-disabled");
}

function clearPreview() {
  elements.preview.removeAttribute("src");
  elements.openPreview.href = "#";
  elements.openPreview.setAttribute("aria-disabled", "true");
}

function setDirty(dirty = true) {
  state.dirty = dirty;
  setStatus(dirty ? "unsaved" : "ready", dirty ? "dirty" : "");
}

function setStatus(message, kind = "") {
  elements.status.textContent = message;
  elements.status.dataset.kind = kind;
}

function canLeaveDraft() {
  return !state.dirty || window.confirm("Discard your unsaved changes?");
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function today() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function request(url, options) {
  const response = await fetch(url, options);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || `Request failed (${response.status}).`);
  }
  return result;
}

elements.form.addEventListener("submit", savePost);
elements.newPost.addEventListener("click", () => startNewPost());
elements.deletePost.addEventListener("click", deletePost);
elements.refreshPreview.addEventListener("click", refreshPreview);

for (const input of [
  elements.title,
  elements.slug,
  elements.date,
  elements.body,
]) {
  input.addEventListener("input", () => setDirty());
}

elements.title.addEventListener("input", () => {
  if (!state.currentSlug && !state.slugEdited) {
    elements.slug.value = slugify(elements.title.value);
  }
});

elements.slug.addEventListener("input", () => {
  state.slugEdited = Boolean(elements.slug.value);
});

window.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    elements.form.requestSubmit();
  }
});

window.addEventListener("beforeunload", (event) => {
  if (!state.dirty) return;
  event.preventDefault();
});
