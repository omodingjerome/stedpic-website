// One blog post. Without a bundler there is no Ricos viewer, so the body goes through the shipped,
// sanitizing Ricos→HTML converter from the FAQ core (headings, paragraphs, lists, quotes, http(s)
// links only); post.paragraphs is the fallback when a post carries no rich content.
import { createPostStore } from "../wix/post-store.js";
import { richContentToHtml } from "../wix/faq-core.js";
import { imgSrc } from "../wix/media.js";
import { fetchPosts, postMetaLine } from "../wix/posts.js";
import { fetchBlogCategories, fetchBlogTags } from "../wix/taxonomy.js";
import { el, postCard, renderSidebar, tagHref } from "./blog-ui.js";

const slug = new URLSearchParams(location.search).get("slug") || "";
const body = document.getElementById("post-body");
const title = document.getElementById("post-title");
const meta = document.getElementById("post-meta");
const catLabel = document.getElementById("post-cat");
const related = document.getElementById("post-related");
const relatedGrid = document.getElementById("post-related-grid");
const store = createPostStore({ slug, engagement: false });

// Sidebar: topics, recent posts, tags — the post's own topic highlighted.
const side = document.getElementById("blog-side");
const sideData = { categories: [], tags: [], recent: null };
const renderSide = () => renderSidebar(side, { ...sideData, currentSlug: slug, activeCategoryId: store.getState().post?.categoryIds?.[0] ?? null });
Promise.all([fetchBlogCategories().catch(() => []), fetchBlogTags().catch(() => []), fetchPosts({ limit: 5 }).then((r) => r.posts).catch(() => [])])
  .then(([categories, tags, recent]) => { Object.assign(sideData, { categories, tags, recent }); renderSide(); });
renderSide();
store.subscribe(renderSide);

let built = false;
function render() {
  const s = store.getState();
  if (s.notFound || !slug) {
    title.textContent = "Post not found";
    body.setAttribute("aria-busy", "false");
    const box = el("div", { class: "state-msg" }, "This post may have been moved or unpublished. ");
    box.append(el("a", { href: "blog.html" }, "See all posts"));
    body.replaceChildren(box);
    document.title = "Post not found — StedPic";
    return;
  }
  if (s.error && !s.post) { body.replaceChildren(el("div", { class: "state-msg error" }, `We couldn't load this post. ${s.error}`)); return; }
  if (!s.post) {
    body.replaceChildren(el("div", { class: "sk", style: "height:300px;margin-bottom:2rem" }), ...[90, 100, 80, 95].map((w) => el("div", { class: "sk", style: `height:14px;width:${w}%;margin-bottom:.8rem` })));
    return;
  }

  const p = s.post;
  if (!built) {
    built = true;
    body.setAttribute("aria-busy", "false");
    document.title = `${p.seoTitle || p.title} — StedPic`;
    document.querySelector('meta[name="description"]')?.setAttribute("content", p.seoDescription || "");
    title.textContent = p.title;
    const parts = [];
    if (p.coverUrl) parts.push(el("img", { class: "article-cover", src: p.coverUrl, alt: p.coverAlt || "" }));
    const prose = el("div", { class: "prose" });
    const html = p.richContent ? richContentToHtml(p.richContent, imgSrc) : "";
    if (html) prose.innerHTML = html; // sanitized by the shipped converter
    else prose.append(...(p.paragraphs || []).map((t) => el("p", {}, t)));
    parts.push(prose);
    body.replaceChildren(...parts);
  }

  if (s.categories[0]) catLabel.textContent = s.categories[0].label;
  meta.replaceChildren();
  if (p.authorName) meta.append(el("span", {}, `By ${p.authorName}`));
  const line = postMetaLine(p);
  if (line) meta.append(el("time", { datetime: p.dateISO }, line));
  for (const t of s.tags) meta.append(el("a", { class: "chip-tag", href: tagHref(t) }, `#${t.label}`));

  if (s.related && s.related.length) {
    related.hidden = false;
    relatedGrid.replaceChildren(...s.related.map((r) => postCard(r, s.categories)));
  } else related.hidden = true;
}

store.subscribe(render);
render();
store.start();
