// Account page, gated in the page: loading → skeleton, visitor → sign-in prompt, member → profile
// and the client's next steps. Reports are delivered by email/WhatsApp, so this page says so
// rather than pretending to list them.
import { subscribeMember, getMemberState, logout } from "../wix/member-store.js";
import { el, icon } from "./blog-ui.js";

const root = document.getElementById("acct-root");

function action(href, iconName, title, text, external) {
  const a = el("a", { class: "acct-action", href, ...(external ? { target: "_blank", rel: "noopener" } : {}) });
  const t = el("div"); t.append(el("strong", {}, title), el("span", {}, text));
  a.append(icon(iconName), t);
  return a;
}

function render() {
  const { loading, loggedIn, member, error } = getMemberState();
  root.setAttribute("aria-busy", String(loading));
  if (loading) {
    const g = el("div", { class: "acct-grid" });
    g.append(el("div", { class: "auth-card sk", style: "height:280px" }), el("div", { class: "sk", style: "height:280px;border-radius:10px" }));
    root.replaceChildren(g);
    return;
  }
  if (!loggedIn) {
    const box = el("div", { class: "state-msg" }, "Please sign in to see your account. ");
    box.append(el("a", { href: "login.html?returnTo=%2Faccount.html" }, "Sign in or create an account"));
    root.replaceChildren(box);
    return;
  }

  const name = member?.displayName || "";
  document.getElementById("acct-title").textContent = name ? `Welcome, ${member.firstName || name}` : "My account";

  const grid = el("div", { class: "acct-grid" });
  const card = el("div", { class: "auth-card acct-profile" });
  const av = el("div", { class: "acct-avatar" });
  if (member?.photoUrl) av.append(el("img", { src: member.photoUrl, alt: "" }));
  else av.textContent = (name || "M").charAt(0);
  card.append(av);
  if (member) {
    card.append(el("h2", {}, name));
    if (member.loginEmail) card.append(el("p", {}, member.loginEmail));
    if (member.memberSince) card.append(el("p", {}, `Client since ${new Date(member.memberSince + "T12:00:00").toLocaleDateString(undefined, { month: "long", year: "numeric" })}`));
  } else {
    card.append(el("p", {}, "Profile details unavailable."));
  }
  const out = el("button", { class: "btn-outline", type: "button" }, "Sign out");
  out.onclick = () => { out.disabled = true; logout("/").catch(() => { out.disabled = false; render(); }); };
  card.append(out);
  if (error) card.append(el("p", { class: "form-error", role: "alert" }, error));

  const right = el("div");
  const actions = el("div", { class: "acct-actions" });
  actions.append(
    action("book.html", "calendar-check", "Book a free call", "Pick a time with our team — online, from anywhere."),
    action("/#contact", "file-search", "Request a service", "Tell us the property, the service and where it is."),
    action("/#packages", "shield-check", "Protection packages", "Buyer's Shield, Owner's Guard, Full Confidence, Property Watch."),
    action("https://wa.me/256773961113", "message-circle", "WhatsApp our team", "Fastest response · +256 773 961113", true),
  );
  const note = el("div", { class: "acct-note" }, "Your reports, photos and updates are sent to you directly by email or WhatsApp as each job progresses. Payments you make online are confirmed by email from Wix.");
  right.append(actions, note);
  grid.append(card, right);
  root.replaceChildren(grid);
}

subscribeMember(render);
render();
