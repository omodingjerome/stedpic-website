// FAQ page: renders the shipped FAQ store (search, topic filter, accordion, deep links).
// Answers are the core's sanitized HTML — the only innerHTML on the page.
import { subscribeFaq, getFaqState, setQuery, selectCategory, toggleQuestion, retry } from "../wix/faq-store.js";
import { anchorId, groupByCategory } from "../wix/faq-core.js";

const list = document.getElementById("faq-list");
const cats = document.getElementById("faq-cats");
const count = document.getElementById("faq-count");
const input = document.getElementById("faq-q");

const el = (tag, attrs = {}, text) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) n.setAttribute(k, v === true ? "" : v);
  if (text != null) n.textContent = text;
  return n;
};
const chevron = () => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("class", "ico"); s.setAttribute("aria-hidden", "true"); const u = document.createElementNS("http://www.w3.org/2000/svg", "use"); u.setAttribute("href", "img/icons.svg#i-chevron-down"); s.append(u); return s; };

let debounce;
input.addEventListener("input", () => { clearTimeout(debounce); debounce = setTimeout(() => setQuery(input.value), 180); });

let lastKey = "";
function render() {
  const s = getFaqState();
  list.setAttribute("aria-busy", String(s.data === null));

  if (s.data === null && s.error) {
    list.replaceChildren(el("div", { class: "state-msg error" }, s.error));
    const b = el("button", { class: "linkish", type: "button" }, "Try again");
    b.onclick = retry; list.firstChild.append(" ", b);
    return;
  }
  if (s.data === null) {
    list.replaceChildren(...Array.from({ length: 5 }, () => el("div", { class: "sk", style: "height:58px;margin-bottom:.75rem" })));
    return;
  }

  // Topic pills — only when more than one category holds questions.
  const withQs = s.data.categories.filter((c) => c.questionCount > 0);
  cats.hidden = withQs.length < 2;
  cats.replaceChildren(
    ...[{ id: null, title: "All topics" }, ...withQs].map((c) => {
      const b = el("button", { class: "pill", type: "button", "aria-pressed": String(s.activeCategoryId === c.id) }, c.title);
      b.onclick = () => selectCategory(c.id);
      return b;
    }),
  );

  count.textContent = s.query ? `${s.resultsCount} result${s.resultsCount === 1 ? "" : "s"} for “${s.query}”` : "";

  if (!s.data.questions.length) { list.replaceChildren(el("div", { class: "state-msg" }, "No questions yet — contact us and we'll answer directly.")); return; }
  if (s.query && !s.visible.length) {
    const box = el("div", { class: "state-msg" }, `No results for “${s.query}”. `);
    const b = el("button", { class: "linkish", type: "button" }, "Clear search");
    b.onclick = () => { input.value = ""; setQuery(""); };
    box.append(b); list.replaceChildren(box); return;
  }

  // Rebuild the list only when what's shown changes; expanding just flips classes (keeps focus).
  const key = s.visible.map((q) => q.id).join(",") + "|" + s.activeCategoryId;
  if (key !== lastKey) {
    lastKey = key;
    const sections = groupByCategory(s.data.categories, s.visible);
    list.replaceChildren(...sections.map((sec) => {
      const wrap = el("section", { class: "faq-section" });
      wrap.append(el("h2", {}, sec.category.title));
      for (const q of sec.questions) {
        const panelId = `panel-${q.id}`;
        const item = el("div", { class: "faq-item", id: anchorId(q), "data-qid": q.id });
        const h3 = el("h3");
        const btn = el("button", { class: "faq-q", type: "button", "aria-controls": panelId, "aria-expanded": "false" }, q.question);
        btn.append(chevron());
        btn.onclick = () => toggleQuestion(q.id);
        h3.append(btn);
        const panel = el("div", { class: "faq-a", id: panelId, role: "region", hidden: true });
        const body = el("div"); body.innerHTML = q.answerHtml; // sanitized by the core
        const link = el("a", { class: "faq-link", href: `faq.html#${anchorId(q)}` }, "Link to this answer");
        panel.append(body, link);
        item.append(h3, panel);
        wrap.append(item);
      }
      return wrap;
    }));
  }
  for (const item of list.querySelectorAll(".faq-item")) {
    const open = s.expandedIds.includes(item.dataset.qid);
    item.classList.toggle("open", open);
    item.querySelector(".faq-q").setAttribute("aria-expanded", String(open));
    item.querySelector(".faq-a").hidden = !open;
  }
}

subscribeFaq(render);
render();

// A deep link (#q-…) opens its answer via the store; bring it into view once rendered.
if (location.hash.startsWith("#q-")) {
  const stop = subscribeFaq(() => {
    const t = document.getElementById(location.hash.slice(1));
    if (t) { t.scrollIntoView({ block: "start" }); stop(); }
  });
}
