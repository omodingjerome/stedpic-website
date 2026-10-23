// Mobile menu, nav shadow on scroll, and reveal-on-scroll transitions.
const nav = document.querySelector("nav");
const toggle = document.querySelector(".nav-toggle");
const links = document.getElementById("nav-links");

function setMenu(open) {
  nav.classList.toggle("nav-open", open);
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
}
toggle.addEventListener("click", () => setMenu(!nav.classList.contains("nav-open")));
links.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && nav.classList.contains("nav-open")) { setMenu(false); toggle.focus(); }
});
document.addEventListener("click", (e) => { if (!nav.contains(e.target)) setMenu(false); });
matchMedia("(min-width: 1221px)").addEventListener("change", (e) => { if (e.matches) setMenu(false); });

const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 10);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// Reveal blocks as they scroll into view. Without JS, or with reduced motion, everything just shows.
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
if (!reduced && "IntersectionObserver" in window) {
  const selector = [
    ".why-header", ".packages-header", ".services-header", ".work-header", ".pm-header-row",
    ".persona-section .section-title", ".persona-section .section-sub",
    ".how-section .section-title", ".how-section .section-sub",
    ".testimonials-section .section-title", ".contact-section .section-title",
    ".arms-section .inner > div:first-child", ".cred-header", ".fear-headline",
    ".fear-card", ".why-card", ".cred-card", ".pkg-card", ".svc-card", ".arm-col", ".pm-promise",
    ".work-item", ".persona-story", ".checklist-panel", ".step", ".testimonial-card", ".trust-item",
    ".contact-info", ".contact-form", ".addon-card", ".indep-strip", ".pm-included", ".pm-cta-band",
    ".arms-honesty", ".fear-cta",
  ].join(",");
  const items = [...document.querySelectorAll(selector)];
  for (const el of items) {
    el.classList.add("reveal");
    const siblings = [...el.parentElement.children].filter((c) => c.classList.contains("reveal"));
    el.style.setProperty("--reveal-delay", `${(siblings.indexOf(el) % 4) * 90}ms`);
  }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("in");
      io.unobserve(entry.target);
    }
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  items.forEach((el) => io.observe(el));
  document.documentElement.classList.add("reveal-ready");
}

// Mark the current page in the nav (Home / Blog / FAQ; a post counts as Blog).
{
  const path = location.pathname.replace(/^\//, "") || "index.html";
  const page = path === "index.html" ? "home" : path === "post.html" || path === "blog.html" ? "blog" : path === "faq.html" ? "faq" : null;
  const link = page && document.querySelector(`.nav-links a[data-page="${page}"]`);
  if (link) link.setAttribute("aria-current", "page");
}
