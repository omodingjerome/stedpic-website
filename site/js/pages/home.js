// Homepage live strips: "Pay online" on each package (Pricing Plans hosted checkout), the case
// studies (CMS), the FAQ preview, and the latest blog posts. Each strip fails on its own — a
// failed read shows an inline message there and leaves the rest of the page alone.
import { fetchPlans } from "../wix/plans.js";
import { createPlanPurchaseStore } from "../wix/plan-purchase-store.js";
import { queryItems } from "../wix/items.js";
import { fetchFaq } from "../wix/faq.js";
import { anchorId, groupByCategory } from "../wix/faq-core.js";
import { fetchPosts } from "../wix/posts.js";
import { fetchBlogCategories } from "../wix/taxonomy.js";
import { el, icon, postCard, skeletonGrid } from "./blog-ui.js";

// ---------- Pay online ----------
const slots = [...document.querySelectorAll(".pkg-pay[data-plan]")];
if (slots.length) {
  const purchase = createPlanPurchaseStore();
  const byPlan = new Map();
  const renderPay = () => {
    const { purchasingId, error } = purchase.getState();
    for (const [slot, plan] of byPlan) {
      const btn = slot.querySelector("button");
      const busy = purchasingId === plan.id;
      btn.disabled = busy;
      btn.lastChild.textContent = busy ? "Redirecting to secure checkout…" : `Pay online · ${plan.price}${plan.billing && plan.billing !== "one-time" ? ` ${plan.billing}` : ""}`;
      let msg = slot.querySelector(".pay-error");
      if (error && purchasingId === null && slot.dataset.last === "1") {
        if (!msg) { msg = el("p", { class: "pay-error", role: "alert" }); slot.append(msg); }
        msg.textContent = error;
      } else if (msg) msg.remove();
    }
  };
  fetchPlans().then((plans) => {
    for (const slot of slots) {
      const plan = plans.find((p) => p.slug === slot.dataset.plan);
      if (!plan || !plan.buyable) continue; // the CTA renders only for a buyable plan
      byPlan.set(slot, plan);
      const btn = el("button", { class: "pkg-pay-btn", type: "button" });
      btn.append(icon("credit-card"), document.createTextNode(""));
      btn.onclick = () => {
        for (const s of slots) delete s.dataset.last;
        slot.dataset.last = "1";
        purchase.purchase(plan.id, { thankYouPageUrl: `${location.origin}/thank-you.html` }).catch(() => {});
      };
      slot.append(btn);
    }
    renderPay();
  }).catch(() => { /* packages still work through the contact form */ });
  purchase.subscribe(renderPay);
}

// ---------- Case studies ----------
const cases = document.getElementById("home-cases");
if (cases) {
  cases.replaceChildren(skeletonGrid(3));
  queryItems("caseStudies", { sort: [{ field: "publishDate", direction: "desc" }], limit: 6 })
    .then(({ items }) => {
      cases.setAttribute("aria-busy", "false");
      if (!items.length) { cases.closest("section").hidden = true; return; }
      const grid = el("div", { class: "card-grid" });
      for (const it of items) {
        const a = el("a", { class: "card", href: `case-study.html?slug=${encodeURIComponent(it.slug || "")}` });
        if (it.photo) { const f = el("div", { class: "card-img" }); f.append(el("img", { src: it.photo, alt: "", loading: "lazy" })); a.append(f); }
        const b = el("div", { class: "card-body" });
        if (it.service) b.append(el("span", { class: "card-eyebrow" }, it.service));
        b.append(el("div", { class: "card-title" }, it.title || ""));
        if (it.summary) b.append(el("p", { class: "card-text" }, it.summary));
        const more = el("span", { class: "card-more" }, "Read the case"); more.append(icon("arrow-right"));
        b.append(more); a.append(b); grid.append(a);
      }
      cases.replaceChildren(grid);
    })
    .catch((e) => { cases.setAttribute("aria-busy", "false"); cases.replaceChildren(el("div", { class: "state-msg error" }, `Case studies couldn't load. ${e?.message ?? ""}`)); });
}

// ---------- FAQ preview ----------
const faq = document.getElementById("home-faq");
if (faq) {
  faq.replaceChildren(...Array.from({ length: 4 }, () => el("div", { class: "sk", style: "height:62px" })));
  fetchFaq()
    .then((data) => {
      faq.setAttribute("aria-busy", "false");
      const qs = groupByCategory(data.categories, data.questions).flatMap((s) => s.questions).slice(0, 6);
      if (!qs.length) { faq.closest("section").hidden = true; return; }
      faq.replaceChildren(...qs.map((q) => { const a = el("a", { href: `faq.html#${anchorId(q)}` }, q.question); a.append(icon("chevron-right")); return a; }));
    })
    .catch(() => { faq.setAttribute("aria-busy", "false"); faq.closest("section").hidden = true; });
}

// ---------- Latest posts ----------
const blog = document.getElementById("home-blog");
if (blog) {
  blog.replaceChildren(skeletonGrid(3));
  Promise.all([fetchPosts({ limit: 3 }), fetchBlogCategories().catch(() => [])])
    .then(([{ posts }, cats]) => {
      blog.setAttribute("aria-busy", "false");
      if (!posts.length) { blog.closest("section").hidden = true; return; }
      const grid = el("div", { class: "card-grid" });
      grid.append(...posts.map((p) => postCard(p, cats)));
      blog.replaceChildren(grid);
    })
    .catch((e) => { blog.setAttribute("aria-busy", "false"); blog.replaceChildren(el("div", { class: "state-msg error" }, `Posts couldn't load. ${e?.message ?? ""}`)); });
}
