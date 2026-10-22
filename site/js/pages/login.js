// Sign in / sign up on this site's own form, through the shipped member store. Mirrors the
// reference LoginForm: the toggle, names only on sign-up, the verification-code step, the
// pending-approval notice, the inline error, and ?returnTo (a same-site path only) after success.
//
// reCAPTCHA: the site requires it on sign-up (dashboard: Settings > Site Member Settings > Signup &
// Login Security). Per Wix's docs the widget loads Google's enterprise script with WIX's visible site
// key, and its token rides the register/login body (captchaToken → captchaTokens[].Recaptcha).
// Sign-up always shows the checkbox; sign-in shows it only after Wix asks for one.
// docs: https://dev.wix.com/docs/go-headless/authentication/members/custom-login-page/re-captcha/add-re-captcha-to-a-custom-login-page-rest
import { login, register, verifyEmail, getMemberState, subscribeMember } from "../wix/member-store.js";
import { PROFILE_ON_SIGNUP } from "../wix/auth.js";
import { el } from "./blog-ui.js";

const WIX_RECAPTCHA_SITE_KEY = "6Ld0J8IcAAAAANyrnxzrRlX1xrrdXsOmsepUYosy";
const root = document.getElementById("auth-root");

let mode = "login";      // login | register
let step = "form";       // form | verify | pending
let busy = false;
let captchaOnLogin = false;
let captchaToken = null;
let widgetId = null;

function returnTo() {
  const wanted = new URLSearchParams(location.search).get("returnTo");
  if (wanted?.startsWith("/") && !wanted.startsWith("//")) return wanted;
  return "/account.html";
}
const done = () => location.assign(returnTo());

// Already signed in? Go straight on.
subscribeMember(() => { const s = getMemberState(); if (!s.loading && s.loggedIn && step === "form" && !busy) done(); });

// ---------- reCAPTCHA ----------
let scriptPromise = null;
function loadRecaptcha() {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    window.__stedpicRecaptchaReady = () => resolve(window.grecaptcha.enterprise);
    const s = document.createElement("script");
    s.src = "https://www.google.com/recaptcha/enterprise.js?onload=__stedpicRecaptchaReady&render=explicit";
    s.async = true; s.defer = true;
    s.onerror = () => { scriptPromise = null; reject(new Error("The security check couldn't load. Check your connection and try again.")); };
    document.head.append(s);
  });
  return scriptPromise;
}
const captchaBox = el("div", { class: "captcha-box" });
const captchaMsg = el("p", { class: "auth-note" });
async function ensureCaptcha() {
  if (widgetId !== null) return;
  captchaMsg.textContent = "Loading security check…";
  try {
    const gr = await loadRecaptcha();
    if (widgetId !== null) return;
    widgetId = gr.render(captchaBox, {
      sitekey: WIX_RECAPTCHA_SITE_KEY,
      callback: (t) => { captchaToken = t; captchaMsg.textContent = ""; syncButton(); },
      "expired-callback": () => { captchaToken = null; syncButton(); },
      "error-callback": () => { captchaToken = null; syncButton(); },
    });
    captchaMsg.textContent = "";
  } catch (e) { captchaMsg.textContent = e.message; }
}
function resetCaptcha() {
  captchaToken = null;
  if (widgetId !== null) try { window.grecaptcha.enterprise.reset(widgetId); } catch { /* widget gone */ }
}
const captchaNeeded = () => mode === "register" || captchaOnLogin;

// ---------- the form (built once; only its parts change) ----------
function field(label, attrs) {
  const id = `f-${attrs.name}`;
  const w = el("div", { class: "field" });
  w.append(el("label", { for: id }, label), el("input", { id, ...attrs }));
  return w;
}
const tabs = el("div", { class: "auth-tabs", role: "group", "aria-label": "Sign in or create an account" });
const tabLogin = el("button", { type: "button" }, "Sign in");
const tabRegister = el("button", { type: "button" }, "Create account");
tabs.append(tabLogin, tabRegister);
const form = el("form", { class: "auth-form" });
const names = el("div", { class: "row2" });
names.append(field("First name", { name: "firstName", autocomplete: "given-name" }), field("Last name", { name: "lastName", autocomplete: "family-name" }));
const emailF = field("Email", { name: "email", type: "email", required: true, autocomplete: "email" });
const passF = field("Password", { name: "password", type: "password", required: true, autocomplete: "current-password" });
const captchaWrap = el("div", { class: "captcha-wrap" });
captchaWrap.append(captchaBox, captchaMsg);
const errEl = el("p", { class: "form-error", role: "alert" });
const submitBtn = el("button", { class: "btn-primary", type: "submit" });
form.append(names, emailF, passF, captchaWrap, errEl, submitBtn);

function syncButton() {
  submitBtn.disabled = busy || (captchaNeeded() && !captchaToken);
  submitBtn.textContent = busy ? "Working…" : mode === "login" ? "Sign in" : "Create account";
}
function showError(msg) { errEl.textContent = msg || ""; errEl.hidden = !msg; }

function setMode(m) {
  mode = m;
  tabLogin.setAttribute("aria-pressed", String(m === "login"));
  tabRegister.setAttribute("aria-pressed", String(m === "register"));
  names.hidden = !(m === "register" && PROFILE_ON_SIGNUP);
  form.password.autocomplete = m === "login" ? "current-password" : "new-password";
  captchaWrap.hidden = !captchaNeeded();
  if (captchaNeeded()) ensureCaptcha();
  showError("");
  syncButton();
}
tabLogin.onclick = () => setMode("login");
tabRegister.onclick = () => setMode("register");

form.onsubmit = async (e) => {
  e.preventDefault();
  const email = form.email.value.trim(), password = form.password.value;
  const options = { returnTo: returnTo(), ...(captchaNeeded() && captchaToken ? { captchaToken } : {}) };
  busy = true; showError(""); syncButton();
  try {
    const r = mode === "login"
      ? await login(email, password, options)
      : await register(email, password, PROFILE_ON_SIGNUP ? { firstName: form.firstName.value.trim(), lastName: form.lastName.value.trim() } : undefined, options);
    if (r.state === "SUCCESS" && r.redirectUrl) return;
    if (r.state === "SUCCESS") return done();
    if (r.state === "EMAIL_VERIFICATION_REQUIRED") { step = "verify"; return renderStep(); }
    if (r.state === "OWNER_APPROVAL_REQUIRED") { step = "pending"; return renderStep(); }
    // A FAILURE: a token is single-use, so reset the checkbox; a sign-in that Wix wants a captcha for shows one.
    if (mode === "login" && (r.errorCode === "missingCaptchaToken" || r.errorCode === "captchaRequired")) {
      captchaOnLogin = true; captchaWrap.hidden = false; ensureCaptcha();
      showError("Please confirm you're not a robot, then sign in again.");
    } else {
      showError(friendly(r));
    }
    if (captchaNeeded()) resetCaptcha();
  } finally { busy = false; syncButton(); }
};

// Wix's messages, in plain words where the meaning is clear.
function friendly(r) {
  switch (r.errorCode) {
    case "invalidPassword": return "That email and password don't match. Try again.";
    case "invalidEmail": return "We couldn't find an account with that email. Check it, or create an account.";
    case "emailAlreadyExists": return "An account with that email already exists — sign in instead.";
    case "resetPassword": return "This account needs a new password. Contact us and we'll help you reset it.";
    case "missingCaptchaToken": return "Please tick “I'm not a robot” first.";
    case "invalidCaptchaToken": return "The security check expired. Tick “I'm not a robot” again.";
    default: return /identity not found/i.test(r.error || "") ? "We couldn't find an account with that email. Check it, or create an account." : (r.error || "Something went wrong. Please try again.");
  }
}

// ---------- verification / pending steps ----------
function renderStep() {
  if (step === "pending") {
    root.replaceChildren(el("div", { class: "state-msg" }, "Thanks — your account is awaiting approval. You'll be able to sign in once our team approves it."));
    return;
  }
  const f = el("form", { class: "auth-form" });
  const err = el("p", { class: "form-error", role: "alert", hidden: true });
  const b = el("button", { class: "btn-primary", type: "submit" }, "Verify");
  f.append(el("p", { class: "auth-note" }, "We've emailed you a verification code. Enter it below to finish."), field("Verification code", { name: "code", required: true, autocomplete: "one-time-code" }), err, b);
  f.onsubmit = async (e) => {
    e.preventDefault(); b.disabled = true; b.textContent = "Verifying…";
    try {
      const r = await verifyEmail(f.code.value.trim());
      if (r.state === "SUCCESS") return done();
      if (r.state === "OWNER_APPROVAL_REQUIRED") { step = "pending"; return renderStep(); }
      err.textContent = r.error || "That code didn't work. Check it and try again."; err.hidden = false;
    } finally { b.disabled = false; b.textContent = "Verify"; }
  };
  root.replaceChildren(f);
}

root.replaceChildren(tabs, form);
if (new URLSearchParams(location.search).get("mode") === "register") setMode("register"); else setMode("login");
