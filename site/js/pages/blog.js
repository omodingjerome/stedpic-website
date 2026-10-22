// Blog feed: the shipped feed store (server-side topic/tag filter, cursor paging) plus the sidebar.
// ?category=<slug> / ?tag=<slug> open the feed filtered (resolved through the shipped slug reads);
// switching a filter updates the address bar so the view can be shared.
import { createBlogFeedStore } from "../wix/blog-feed-store.js";
import { fetchPosts } from "../wix/posts.js";
import { fetchCategoryBySlug, fetchTagBySlug } from "../wix/taxonomy.js";
import { el, postCard, skeletonGrid, renderSidebar } from "./blog-ui.js";

const feed = document.getElementById("blog-feed");
const cats = document.getElementById("blog-cats");
const note = document.getElementById("blog-filter");
const side = document.getElementById("blog-side");
const moreWrap = document.getElementById("blog-more");
const moreBtn = moreWrap.querySelector("button");

const params = new URLSearchParams(location.search);
const [cat, tag] = await Promise.all([
  params.get("category") ? fetchCategoryBySlug(params.get("category")).catch(() => null) : null,
  params.get("tag") ? fetchTagBySlug(params.get("tag")).catch(() => null) : null,
]);

const store = createBlogFeedStore({ pageSize: 12, initialCategoryId: cat?.id ?? null, initialTagId: cat ? null : tag?.id ?? null });
moreBtn.onclick = () => store.loadMore();

let recent = null;
fetchPosts({ limit: 5 }).then(({ posts }) => { recent = posts; render(); }).catch(() => { recent = []; render(); });

function writeUrl(s) {
  const url = new URL(location.href);
  url.searchParams.delete("category"); url.searchParams.delete("tag");
  const c = s.categories.find((x) => x.id === s.activeCategoryId);
  const t = s.tags.find((x) => x.id === s.activeTagId);
  if (c) url.searchParams.set("category", c.slug);
  else if (t) url.searchParams.set("tag", t.slug);
  try { history.replaceState(null, "", url.pathname + url.search); } catch { /* address bar only */ }
}
const setCategory = (id) => { store.setActiveCategoryId(id); writeUrl(store.getState()); window.scrollTo({ top: document.querySelector(".page-body").offsetTop - 80, behavior: "smooth" }); };
const setTag = (id) => { store.setActiveTagId(id); writeUrl(store.getState()); window.scrollTo({ top: document.querySelector(".page-body").offsetTop - 80, behavior: "smooth" }); };

function render() {
  const s = store.getState();
  feed.setAttribute("aria-busy", String(s.posts === null));

  renderSidebar(side, { categories: s.categories, tags: s.tags, recent, activeCategoryId: s.activeCategoryId, activeTagId: s.activeTagId, onCategory: setCategory, onTag: setTag });

  // Topic pills: shown on narrow screens, where the sidebar sits below the posts.
  cats.hidden = s.categories.length < 2;
  cats.replaceChildren(...[{ id: null, label: "All posts" }, ...s.categories].map((c) => {
    const b = el("button", { class: "pill", type: "button", "aria-pressed": String(s.activeCategoryId === c.id && !s.activeTagId) }, c.label);
    b.onclick = () => setCategory(c.id);
    return b;
  }));

  // What's being shown, with a way back to everything.
  const activeCat = s.categories.find((c) => c.id === s.activeCategoryId);
  const activeTag = s.tags.find((t) => t.id === s.activeTagId);
  note.hidden = !(activeCat || activeTag);
  if (activeCat || activeTag) {
    note.replaceChildren(el("span", {}, activeCat ? `Topic: ${activeCat.label}` : `Tagged #${activeTag.label}`));
    const clear = el("button", { class: "linkish", type: "button" }, "Show all posts");
    clear.onclick = () => setCategory(null);
    note.append(clear);
  }

  if (s.error && !s.posts?.length) { feed.replaceChildren(el("div", { class: "state-msg error" }, `We couldn't load the blog. ${s.error}`)); moreWrap.hidden = true; return; }
  if (s.posts === null) { feed.replaceChildren(skeletonGrid(2)); moreWrap.hidden = true; return; }
  if (!s.posts.length) { feed.replaceChildren(el("div", { class: "state-msg" }, activeCat || activeTag ? "No posts here yet." : "No posts yet — check back soon.")); moreWrap.hidden = true; return; }

  const grid = el("div", { class: "card-grid" });
  grid.append(...s.posts.map((p) => postCard(p, s.categories)));
  feed.replaceChildren(grid);
  moreWrap.hidden = !s.hasMore;
  moreBtn.disabled = s.loadingMore;
  moreBtn.textContent = s.loadingMore ? "Loading…" : "Load more posts";
}

store.subscribe(render);
render();
store.start();
