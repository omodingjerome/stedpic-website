// Builds the site's pages so they share one head, nav, footer and WhatsApp button.
//   node tools/build.mjs          (from the project root)
// - pages/<name>.html → site/<name>.html. Each source starts with a JSON comment:
//     <!-- {"title": "...", "description": "...", "script": "js/pages/x.js", "bodyClass": "..."} -->
//   followed by the page's <main> content.
// - site/index.html keeps its own content; the shared blocks between the @shared markers are refreshed.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = join(ROOT, "site");
const PAGES = join(ROOT, "pages");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
export const icon = (name, cls = "") => `<svg class="ico${cls ? " " + cls : ""}" aria-hidden="true"><use href="img/icons.svg#i-${name}"/></svg>`;

const head = ({ title, description }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description ?? "")}">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="icon" type="image/png" href="img/favicon.png">
<link rel="apple-touch-icon" href="img/apple-touch-icon.png">
<link rel="stylesheet" href="css/site.css">
<link rel="stylesheet" href="css/pages.css">
</head>`;

const nav = () => `<!-- @shared:nav -->
<nav>
  <a class="nav-brand" href="/" aria-label="StedPic home">
    <img class="nav-logo-img" src="img/logo-white.png" alt="StedPic — Trusted. Reliable. Convenient." width="733" height="180">
  </a>
  <button class="nav-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="nav-links">
    <span></span><span></span><span></span>
  </button>
  <ul class="nav-links" id="nav-links">
    <li><a href="/" data-page="home">Home</a></li>
    <li><a href="about.html" data-page="about">About</a></li>
    <li><a href="services.html" data-page="services">Services</a></li>
    <li><a href="packages.html" data-page="packages">Packages</a></li>
    <li><a href="property-management.html" data-page="property-management">Property Mgmt</a></li>
    <li><a href="work.html" data-page="work">Our Work</a></li>
    <li><a href="blog.html" data-page="blog">Blog</a></li>
    <li><a href="faq.html" data-page="faq">FAQ</a></li>
    <li><a href="contact.html" class="nav-cta" data-page="contact">Contact us →</a></li>
  </ul>
</nav>
<!-- /@shared:nav -->`;

const footer = () => `<!-- @shared:footer -->
<footer>
  <div class="footer-grid">
    <div class="footer-brand">
      <a class="footer-logo" href="/" aria-label="StedPic home"><img src="img/logo-white.png" alt="StedPic" width="733" height="180" loading="lazy"></a>
      <p>Your eyes, ears, and shield on the ground in Uganda. Protecting diaspora investments since 2018 — with trust, reliability, and convenience at our core.</p>
    </div>
    <div class="footer-col">
      <h4>Packages</h4>
      <ul>
        <li><a href="packages.html">The Buyer's Shield</a></li>
        <li><a href="packages.html">The Owner's Guard</a></li>
        <li><a href="packages.html">Full Confidence Package</a></li>
        <li><a href="packages.html">Property Watch</a></li>
        <li><a href="property-management.html">StedPic Guardian</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h4>Services</h4>
      <ul>
        <li><a href="services.html">Ownership Verification</a></li>
        <li><a href="services.html">Protective Caveat</a></li>
        <li><a href="services.html">Land Verification Survey</a></li>
        <li><a href="services.html">Property Intelligence Report</a></li>
        <li><a href="services.html">Title Creation &amp; Registration</a></li>
        <li><a href="services.html">Ownership Transfer &amp; Securing</a></li>
        <li><a href="services.html">Land Subdivision &amp; Structuring</a></li>
        <li><a href="services.html">Property Sales Representation</a></li>
        <li><a href="services.html">Property Acquisition &amp; Advisory</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h4>Company</h4>
      <ul>
        <li><a href="about.html">About StedPic</a></li>
        <li><a href="work.html">Our Work</a></li>
        <li><a href="work.html#case-studies">Case Studies</a></li>
        <li><a href="blog.html">Blog</a></li>
        <li><a href="faq.html">FAQ</a></li>
        <li><a href="contact.html">Contact Us</a></li>
      </ul>
    </div>
  </div>
  <div class="footer-bottom">
    <div>© 2026 StedPic Limited. All Rights Reserved. · Uganda &amp; USA</div>
    <div class="footer-serving">
      <span class="serving-tag">Kampala</span>
      <span class="serving-tag">Wakiso</span>
      <span class="serving-tag">Mukono</span>
      <span class="serving-tag">Jinja</span>
      <span class="serving-tag">Luwero</span>
      <span class="serving-tag">Mpigi</span>
    </div>
  </div>
</footer>
<a class="wa-float" href="https://wa.me/256773961113" target="_blank" rel="noopener" aria-label="Chat with StedPic on WhatsApp">
  ${icon("message-circle")}<span>WhatsApp us</span>
</a>
<!-- /@shared:footer -->`;

const scripts = (script) => `<script type="module" src="js/site.js"></script>${script ? `\n<script type="module" src="${script}"></script>` : ""}`;

// --- pages/*.html → site/*.html ---
const built = [];
for (const f of readdirSync(PAGES).filter((f) => f.endsWith(".html"))) {
  const src = readFileSync(join(PAGES, f), "utf8");
  const m = src.match(/^<!--\s*(\{[\s\S]*?\})\s*-->\s*/);
  if (!m) throw new Error(`${f}: missing the JSON header comment`);
  const meta = JSON.parse(m[1]);
  const body = src.slice(m[0].length).replace(/\{\{icon:([a-z0-9-]+)(?::([a-z0-9- ]+))?\}\}/g, (_, n, c) => icon(n, c));
  const html = `${head(meta)}
<body${meta.bodyClass ? ` class="${meta.bodyClass}"` : ""}>
${nav()}
${body.trim()}
${footer()}
${scripts(meta.script)}
</body>
</html>
`;
  writeFileSync(join(SITE, f), html);
  built.push(f);
}

// --- index.html: refresh the shared blocks in place ---
let index = readFileSync(join(SITE, "index.html"), "utf8");
const swap = (name, block) => {
  const re = new RegExp(`<!-- @shared:${name} -->[\\s\\S]*?<!-- /@shared:${name} -->`);
  if (!re.test(index)) throw new Error(`index.html: missing @shared:${name} markers`);
  index = index.replace(re, block);
};
swap("nav", nav());
swap("footer", footer());
writeFileSync(join(SITE, "index.html"), index);

console.log(JSON.stringify({ built, index: "shared blocks refreshed" }));
