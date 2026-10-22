// The hosted plan checkout sends a buyer here ONLY on success, carrying ?planOrderId=<GUID>.
// Without that param this is not a confirmation, so the page says nothing was confirmed.
import { el } from "./blog-ui.js";

const root = document.getElementById("ty-root");
const orderId = new URLSearchParams(location.search).get("planOrderId");
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

if (orderId && GUID.test(orderId)) {
  const box = el("div", { class: "done-box", role: "status" });
  box.append(
    el("div", { class: "wf-success-mark" }, "✓"),
    el("h2", {}, "Payment received — we're on it."),
    el("p", {}, "A receipt is on its way to your email. Our team will contact you by email or WhatsApp to confirm your property details and begin."),
    el("p", { class: "auth-note" }, `Order reference: ${orderId}`),
  );
  const row = el("div", { style: "display:flex;gap:.8rem;justify-content:center;flex-wrap:wrap" });
  row.append(el("a", { class: "btn-primary", href: "/#contact" }, "Send us your property details →"), el("a", { class: "btn-outline", href: "/" }, "Back to the homepage"));
  box.append(row);
  root.replaceChildren(box);
} else {
  document.getElementById("ty-title").textContent = "No order to confirm";
  const box = el("div", { class: "state-msg" }, "We don't have a completed order on this page. If you were paying, check your email for a receipt — or ");
  box.append(el("a", { href: "https://wa.me/256773961113", target: "_blank", rel: "noopener" }, "message us on WhatsApp"), document.createTextNode(" and we'll check for you."));
  root.replaceChildren(box);
}
