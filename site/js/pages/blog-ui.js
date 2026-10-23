// Shared bits for the blog feed, the post page and the homepage teaser.
import { postMetaLine } from "../wix/posts.js";

export const el = (tag, attrs = {}, text) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) n.setAttribute(k, v === true ? "" : v);
  if (text != null) n.textContent = text;
  return n;
};
export const icon = (name) => {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("class", "ico"); s.setAttribute("aria-hidden", "true");
  const u = document.createElementNS("http://www.w3.org/2000/svg", "use");
  u.setAttribute("href", `img/icons.svg#i-${name}`); s.append(u);
  return s;
};
// Static hosting serves files, so a post route is the post page plus its slug.
export const postHref = (slug) => `post.html?slug=${encodeURIComponent(slug)}`;

/** A post tile — cover only when the post has one, byline only when the author resolved. */
export function postCard(p, categories = []) {
  const a = el("a", { class: "card", href: postHref(p.slug) });
  if (p.coverUrl) { const f = el("div", { class: "card-img" }); f.append(el("img", { src: p.coverUrl, alt: p.coverAlt || "", loading: "lazy" })); a.append(f); }
  const b = el("div", { class: "card-body" });
  const cat = categories.find((c) => p.categoryIds?.includes(c.id));
  if (cat) b.append(el("span", { class: "card-eyebrow" }, cat.label));
  b.append(el("div", { class: "card-title" }, p.title));
  if (p.excerpt) b.append(el("p", { class: "card-text" }, p.excerpt));
  const meta = postMetaLine(p);
  if (meta) { const m = el("div", { class: "card-meta" }); const t = el("time", { datetime: p.dateISO }, meta); m.append(icon("clock"), t); b.append(m); }
  a.append(b);
  return a;
}

export function skeletonGrid(n = 3) {
  const g = el("div", { class: "card-grid" });
  for (let i = 0; i < n; i++) {
    const c = el("div", { class: "card sk-card" });
    c.append(el("div", { class: "card-img sk" }));
    const b = el("div", { class: "card-body" });
    b.append(el("div", { class: "sk", style: "height:12px;width:35%" }), el("div", { class: "sk", style: "height:22px;width:90%" }), el("div", { class: "sk", style: "height:12px;width:70%" }));
    c.append(b); g.append(c);
  }
  return g;
}

// ---------- Sidebar (blog feed + post pages) ----------
// Topic and tag links open the feed filtered: blog.html?category=<slug> / ?tag=<slug>. On the feed
// page, onCategory/onTag switch the filter in place instead of reloading.
export const categoryHref = (c) => (c ? `blog.html?category=${encodeURIComponent(c.slug)}` : "blog.html");
export const tagHref = (t) => `blog.html?tag=${encodeURIComponent(t.slug)}`;

function sideBox(title) {
  const box = el("section", { class: "side-box" });
  box.append(el("h3", { class: "side-h" }, title));
  return box;
}

export function renderSidebar(container, { categories = [], tags = [], recent = null, activeCategoryId = null, activeTagId = null, currentSlug = null, onCategory, onTag } = {}) {
  const parts = [];

  // About
  const about = sideBox("About this blog");
  about.append(el("p", { class: "side-text" }, "Plain-language guides from StedPic's team on titles, surveys, caveats and protecting land in Uganda from abroad."));
  parts.push(about);

  // Topics
  if (categories.length) {
    const box = sideBox("Topics");
    const ul = el("ul", { class: "side-list" });
    for (const c of [null, ...categories]) {
      const li = el("li");
      const active = c ? activeCategoryId === c.id : !activeCategoryId && !activeTagId && !currentSlug;
      const a = el("a", { href: categoryHref(c), "aria-current": active ? "page" : null }, c ? c.label : "All posts");
      if (onCategory) a.onclick = (e) => { e.preventDefault(); onCategory(c ? c.id : null); };
      li.append(a); ul.append(li);
    }
    box.append(ul);
    parts.push(box);
  }

  // Recent posts
  const recentBox = sideBox("Recent posts");
  if (recent === null) {
    recentBox.append(...[1, 2, 3].map(() => el("div", { class: "sk", style: "height:54px;margin-bottom:.7rem" })));
  } else {
    const list = recent.filter((p) => p.slug !== currentSlug).slice(0, 4);
    if (!list.length) recentBox.hidden = true;
    for (const p of list) {
      const a = el("a", { class: "side-post", href: postHref(p.slug) });
      if (p.coverUrl) a.append(el("img", { src: p.coverUrl, alt: "", loading: "lazy" }));
      const t = el("div");
      t.append(el("strong", {}, p.title));
      if (p.dateLabel) t.append(el("time", { datetime: p.dateISO }, p.dateLabel));
      a.append(t); recentBox.append(a);
    }
  }
  parts.push(recentBox);

  // Tags
  if (tags.length) {
    const box = sideBox("Tags");
    const wrap = el("div", { class: "side-tags" });
    for (const t of tags) {
      const a = el("a", { class: "side-tag", href: tagHref(t), "aria-current": activeTagId === t.id ? "page" : null }, `#${t.label}`);
      if (onTag) a.onclick = (e) => { e.preventDefault(); onTag(t.id); };
      wrap.append(a);
    }
    box.append(wrap);
    parts.push(box);
  }

  // Call to action
  const cta = el("section", { class: "side-cta" });
  cta.append(el("h3", {}, "Buying land from abroad?"), el("p", {}, "Talk to us before you send money. A real person responds."));
  const wa = el("a", { class: "btn-primary", href: "https://wa.me/256773961113", target: "_blank", rel: "noopener" }, "WhatsApp us →");
  const email = el("a", { class: "side-wa", href: "mailto:info.stedpic@gmail.com" });
  email.append(icon("mail"), "Or email us");
  cta.append(wa, email);
  parts.push(cta);

  container.replaceChildren(...parts);
}
