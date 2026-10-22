// Booking page. Without ?slug: the bookable services as cards. With ?slug: that service's booking
// surface on the shipped booking-flow store — one day at a time, the times bucketed morning /
// afternoon / evening, the schema-driven form, the CTA labelled from ctaState. All booking logic
// (availability, the createBooking → checkout-or-place sequence) is the store's.
import { fetchServices, fetchServiceBySlug } from "../wix/services.js";
import { createBookingFlowStore } from "../wix/booking-flow-store.js";

const root = document.getElementById("book-root");
const slug = new URLSearchParams(location.search).get("slug");

const el = (tag, attrs = {}, text) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) n.setAttribute(k, v === true ? "" : v);
  if (text != null) n.textContent = text;
  return n;
};
const icon = (name) => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("class", "ico"); s.setAttribute("aria-hidden", "true"); const u = document.createElementNS("http://www.w3.org/2000/svg", "use"); u.setAttribute("href", `img/icons.svg#i-${name}`); s.append(u); return s; };
const priceLine = (s) => (s.price ? `${s.priceFrom ? "From " : ""}${s.price}` : "");
const badges = (s) => {
  const b = el("div", { class: "svc-badges" });
  if (s.durationLabel) { const x = el("span", { class: "badge" }); x.append(icon("clock"), s.durationLabel); b.append(x); }
  if (s.conferencing) { const x = el("span", { class: "badge" }); x.append(icon("video"), "Online"); b.append(x); }
  if (priceLine(s)) { const x = el("span", { class: "badge" }); x.append(icon("tag"), priceLine(s)); b.append(x); }
  return b;
};

if (!slug) listServices(); else bookService(slug);

// ---------- listing ----------
async function listServices() {
  root.replaceChildren(skeletonCards(2));
  try {
    const { items } = await fetchServices({});
    root.setAttribute("aria-busy", "false");
    const bookable = items.filter((s) => s.onlineBookingEnabled !== false);
    if (!bookable.length) { root.replaceChildren(el("div", { class: "state-msg" }, "No calls are open for booking right now — message us on WhatsApp and we'll find a time.")); return; }
    const grid = el("div", { class: "svc-pick" });
    for (const s of bookable) {
      const a = el("a", { class: "card", href: `book.html?slug=${encodeURIComponent(s.slug)}` });
      if (s.imageUrl) { const f = el("div", { class: "card-img" }); f.append(el("img", { src: s.imageUrl, alt: "", loading: "lazy" })); a.append(f); }
      const body = el("div", { class: "card-body" });
      body.append(badges(s), el("div", { class: "card-title" }, s.name));
      if (s.tagLine) body.append(el("p", { class: "card-text" }, s.tagLine));
      const more = el("span", { class: "card-more" }, s.ctaState === "requestToBook" ? "Request a time" : "Choose a time"); more.append(icon("arrow-right"));
      body.append(more); a.append(body); grid.append(a);
    }
    root.replaceChildren(grid);
  } catch (e) {
    root.setAttribute("aria-busy", "false");
    root.replaceChildren(el("div", { class: "state-msg error" }, `We couldn't load the booking calendar. ${e?.message ?? ""}`));
  }
}

function skeletonCards(n) {
  const g = el("div", { class: "svc-pick" });
  for (let i = 0; i < n; i++) { const c = el("div", { class: "card sk-card" }); c.append(el("div", { class: "card-img sk" })); const b = el("div", { class: "card-body" }); b.append(el("div", { class: "sk", style: "height:14px;width:40%" }), el("div", { class: "sk", style: "height:22px;width:80%" })); c.append(b); g.append(c); }
  return g;
}

// ---------- booking surface ----------
const BUCKETS = [
  { label: "Morning", test: (h) => h < 12 },
  { label: "Afternoon", test: (h) => h >= 12 && h < 17 },
  { label: "Evening", test: (h) => h >= 17 },
];
const hourOf = (slot) => Number(slot.startLocal.slice(11, 13));
const fmtDay = (dayKey, opts) => { try { return new Date(`${dayKey}T12:00:00`).toLocaleDateString(undefined, opts); } catch { return dayKey; } };
function ctaLabel(service, ctaState, payDeposit) {
  if (ctaState === "viewCourse") return "Not available";
  const verb = ctaState === "requestToBook" ? "Request to book" : "Book";
  if (service.free) return `${verb} — free`;
  if (service.deposit && payDeposit && service.deposit.amount) return `${verb} · deposit ${service.deposit.amount}`;
  if (!service.price) return verb;
  return `${verb} · ${service.priceFrom ? "from " : ""}${service.price}`;
}

async function bookService(slug) {
  document.getElementById("book-back").hidden = false;
  root.replaceChildren(el("div", { class: "sk", style: "height:320px" }));
  let service;
  try { service = await fetchServiceBySlug(slug); }
  catch (e) { root.setAttribute("aria-busy", "false"); root.replaceChildren(el("div", { class: "state-msg error" }, `We couldn't load this call. ${e?.message ?? ""}`)); return; }
  root.setAttribute("aria-busy", "false");
  if (!service) {
    document.getElementById("book-title").textContent = "That call isn't available.";
    document.getElementById("book-lead").textContent = "It may have been renamed or removed.";
    const box = el("div", { class: "state-msg" }, "");
    const a = el("a", { href: "book.html" }, "See the calls you can book"); box.append(a);
    root.replaceChildren(box);
    return;
  }

  document.title = `${service.name} — StedPic`;
  document.querySelector('meta[name="description"]')?.setAttribute("content", service.tagLine || service.description?.slice(0, 160) || "");
  document.getElementById("book-title").textContent = service.name;
  document.getElementById("book-lead").textContent = service.tagLine || "Pick a day and time that suits you.";

  const layout = el("div", { class: "book-layout" });
  const main = el("div");
  const aside = el("aside", { class: "book-aside" });
  if (service.imageUrl) aside.append(el("img", { src: service.imageUrl, alt: "" }));
  const ab = el("div", { class: "book-aside-body" });
  ab.append(badges(service), el("h2", {}, service.name));
  if (service.description) ab.append(el("p", {}, service.description));
  aside.append(ab);
  layout.append(main, aside);
  root.replaceChildren(layout);

  const store = createBookingFlowStore(service);
  let activeDay = null;

  // Static skeleton of the surface; render() fills the dynamic parts in place.
  const dayH = el("p", { class: "book-h" }, "Pick a day");
  const strip = el("div", { class: "day-strip", role: "group", "aria-label": "Choose a day" });
  const times = el("div");
  const form = el("div", { class: "book-form" });
  const formBuilt = { key: "" };
  const err = el("p", { class: "form-error", role: "alert" });
  const cta = el("button", { class: "btn-primary", type: "button" });
  const ctaWrap = el("div", { class: "book-cta" });
  ctaWrap.append(err, cta);
  main.append(dayH, strip, times, form, ctaWrap);
  cta.onclick = () => store.book().catch(() => {});

  const pickDay = (dayKey) => {
    activeDay = dayKey;
    const sel = store.getState().selectedSlot;
    if (sel && sel.dayKey !== dayKey) store.setSelectedSlot(null);
    render();
  };

  function render() {
    const s = store.getState();

    if (s.confirmed) {
      const sel = s.selectedSlot;
      const when = sel ? ` — ${fmtDay(sel.dayKey, { weekday: "long", month: "long", day: "numeric" })} at ${sel.label}${s.timeZoneLabel ? ` (${s.timeZoneLabel})` : ""}` : "";
      const box = el("div", { class: "done-box", role: "status" });
      box.append(el("div", { class: "wf-success-mark" }, "✓"),
        el("h2", {}, s.ctaState === "requestToBook" ? "Request sent" : "You're booked!"),
        el("p", {}, `${service.name}${when}. ${s.ctaState === "requestToBook" ? "You'll hear back once the request is approved." : "A confirmation email is on its way."}`));
      const home = el("a", { class: "btn-outline", href: "/" }, "Back to the homepage");
      box.append(home);
      root.replaceChildren(box);
      return;
    }

    // Day strip
    if (s.days === null) {
      strip.replaceChildren(...Array.from({ length: 5 }, () => el("div", { class: "day-sk sk" })));
      times.replaceChildren();
    } else {
      if (s.days.length && !s.days.some((d) => d.dayKey === activeDay)) activeDay = s.days[0].dayKey;
      const prev = el("button", { class: "pager", type: "button", "aria-label": "Previous week" }, "Earlier");
      prev.onclick = () => store.prevWeek();
      const next = el("button", { class: "pager", type: "button", "aria-label": "Next week" }, "More dates");
      next.onclick = () => store.nextWeek();
      const dayBtns = s.days.map((d) => {
        const b = el("button", { class: "day", type: "button", "aria-pressed": String(d.dayKey === activeDay) });
        b.append(el("small", {}, fmtDay(d.dayKey, { weekday: "short" })), el("strong", {}, fmtDay(d.dayKey, { day: "numeric" })));
        b.onclick = () => pickDay(d.dayKey);
        return b;
      });
      strip.replaceChildren(prev, ...dayBtns, next);

      const current = s.days.find((d) => d.dayKey === activeDay);
      if (!s.days.length) {
        const p = el("p", { class: "empty-week" }, "No times this week. ");
        if (s.nextAvailable === null) p.append("Looking for the next available time…");
        else if (s.nextAvailable.length) {
          const n = s.nextAvailable[0];
          const b = el("button", { class: "linkish", type: "button" }, `Next available: ${fmtDay(n.dayKey, { weekday: "short", month: "short", day: "numeric" })} at ${n.label}`);
          b.onclick = () => store.jumpTo(n.dayKey);
          p.append(b);
        } else p.append("Try the next week, or message us on WhatsApp.");
        times.replaceChildren(p);
      } else if (current) {
        const head = el("div", { class: "day-head" });
        head.append(el("strong", {}, fmtDay(current.dayKey, { weekday: "long", month: "long", day: "numeric" })),
          el("span", {}, `${current.slots.length} ${current.slots.length === 1 ? "time" : "times"}${s.timeZoneLabel ? ` · in ${s.timeZoneLabel}` : ""}`));
        const parts = [head];
        if (s.customerCanChangeTimeZone) {
          const tz = el("p", { class: "tz-switch" });
          const b = el("button", { class: "linkish", type: "button" }, s.displayTimeZone === "BUSINESS" ? "Show in my time zone" : "Show in Uganda time");
          b.onclick = () => store.setDisplayTimeZone(s.displayTimeZone === "BUSINESS" ? "CUSTOMER" : "BUSINESS");
          tz.append(b); parts.push(tz);
        }
        for (const bucket of BUCKETS) {
          const slots = current.slots.filter((x) => bucket.test(hourOf(x)));
          if (!slots.length) continue;
          const wrap = el("div", { class: "bucket" });
          wrap.append(el("p", {}, bucket.label));
          const chips = el("div", { class: "chips" });
          for (const slot of slots) {
            const label = slot.label + (!slot.bookable ? (slot.waitlistCapacity ? " · Full, waitlist" : " · Full") : "");
            const c = el("button", { class: "chip", type: "button", "aria-pressed": String(s.selectedSlot?.key === slot.key), disabled: !slot.bookable }, label);
            c.onclick = () => store.setSelectedSlot(slot);
            chips.append(c);
          }
          wrap.append(chips); parts.push(wrap);
        }
        times.replaceChildren(...parts);
      }
    }

    // Form — rebuilt only when the field set changes (keeps typing focus).
    const fkey = s.formFields.map((f) => f.target).join(",");
    if (fkey !== formBuilt.key) {
      formBuilt.key = fkey;
      form.replaceChildren(el("p", { class: "book-h" }, "Your details"));
      for (const f of s.formFields) {
        const id = `bf-${f.target}`;
        const wrap = el("div", { class: "field" });
        wrap.append(el("label", { for: id }, f.label + (f.required ? " *" : "")));
        let ctl;
        if (f.options?.length) {
          ctl = el("select", { id });
          ctl.append(el("option", { value: "" }, "Choose…"));
          for (const o of f.options) ctl.append(el("option", { value: o }, o));
          ctl.onchange = () => store.setValue(f.target, ctl.value);
        } else {
          const type = f.type === "EMAIL" ? "email" : f.type === "PHONE" ? "tel" : f.type === "NUMBER" ? "number" : f.type === "URL" ? "url" : "text";
          ctl = el("input", { id, type, required: f.required, autocomplete: type === "email" ? "email" : type === "tel" ? "tel" : undefined });
          ctl.oninput = () => store.setValue(f.target, ctl.value);
        }
        ctl.value = s.values[f.target] ?? "";
        wrap.append(ctl); form.append(wrap);
      }
    }

    err.textContent = s.error ?? "";
    err.hidden = !s.error;
    cta.disabled = !s.canBook || s.booking;
    cta.textContent = s.booking ? "Booking…" : ctaLabel(service, s.ctaState, s.payDeposit);
  }

  store.subscribe(render);
  render();
  store.start();
}
