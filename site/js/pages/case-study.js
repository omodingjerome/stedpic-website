// One case study from the "caseStudies" CMS collection, routed by ?slug=. The body is the stored
// RICH_TEXT HTML (owner-authored in the dashboard) — the only innerHTML here.
import { getItemBy } from "../wix/items.js";
import { el } from "./blog-ui.js";

const slug = new URLSearchParams(location.search).get("slug") || "";
const body = document.getElementById("cs-body");
const title = document.getElementById("cs-title");
const summary = document.getElementById("cs-summary");

body.replaceChildren(el("div", { class: "sk", style: "height:320px;margin-bottom:2rem" }));

try {
  const item = slug ? await getItemBy("caseStudies", "slug", slug) : null;
  body.setAttribute("aria-busy", "false");
  if (!item) {
    title.textContent = "Case study not found";
    const box = el("div", { class: "state-msg" }, "It may have been moved or removed. ");
    box.append(el("a", { href: "work.html#case-studies" }, "See all case studies"));
    body.replaceChildren(box);
  } else {
    document.title = `${item.title} — StedPic Case Study`;
    document.querySelector('meta[name="description"]')?.setAttribute("content", item.summary || "");
    title.textContent = item.title;
    summary.textContent = item.summary || "";
    const parts = [];
    if (item.photo) parts.push(el("img", { class: "article-cover", src: item.photo, alt: "" }));
    const facts = el("div", { class: "cs-facts" });
    for (const [label, value] of [["Service", item.service], ["Outcome", item.outcome]]) {
      if (!value) continue;
      const f = el("div", { class: "cs-fact" }); f.append(el("span", {}, label), el("strong", {}, value)); facts.append(f);
    }
    if (facts.children.length) parts.push(facts);
    const prose = el("div", { class: "prose" });
    prose.innerHTML = item.body || "";
    parts.push(prose);
    body.replaceChildren(...parts);
  }
} catch (e) {
  body.setAttribute("aria-busy", "false");
  body.replaceChildren(el("div", { class: "state-msg error" }, `We couldn't load this case study. ${e?.message ?? ""}`));
}
