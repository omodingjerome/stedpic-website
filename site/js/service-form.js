// Renders a Wix Form from its live schema into a mount element. Fields are never named here:
// the owner edits them in the Wix dashboard and this page follows. State, rules, validation and
// the submit all run through the shipped store (./wix/form-store.js).
import { createFormStore, FORM_ERROR, otherValue, otherText } from "./wix/form-store.js";

const OTHER = "__other__";

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children) if (c) node.append(c);
  return node;
}

function paragraphs(text) {
  return String(text).split("\n").filter(Boolean).map((line) => el("p", { text: line }));
}

export function mountWixForm(mount, formId) {
  const store = createFormStore({ formId });
  const fieldEls = new Map(); // target -> { key, wrap, errEls: Map(errKey -> <p>) }
  let formEl = null;
  let listEl = null;
  let formErrEl = null;
  let submitBtn = null;
  let mode = null; // "skeleton" | "error" | "closed" | "form" | "done"

  const fieldKey = (f) => JSON.stringify([f.control, f.label, f.showLabel, f.required, f.readOnly, f.placeholder,
    f.description, f.choices, f.otherOption, f.addressParts, f.validation]);

  function labelFor(f, form, forId) {
    const mark = form.requiredIndicator === "TEXT" ? " (Required)" : form.requiredIndicator === "NONE" ? "" : " *";
    const text = f.required && mark ? (form.requiredIndicatorBefore ? mark.trim() + " " + f.label : f.label + mark) : f.label;
    return el("label", { for: forId, class: f.showLabel === false ? "sr-only" : undefined, text });
  }

  function textInput(f, type, extra = {}) {
    const st = store.getState();
    const input = el("input", {
      type, id: `f-${f.target}`, name: f.target, placeholder: f.placeholder,
      readonly: f.readOnly, "aria-describedby": `err-${f.target}`, ...extra,
    });
    input.value = String(st.values[f.target] ?? "");
    input.addEventListener("input", () => store.setValue(f.target, input.value));
    input.addEventListener("blur", () => store.validate(f.target));
    return input;
  }

  function buildControl(f) {
    const st = store.getState();
    const v = f.validation || {};
    const value = st.values[f.target];
    switch (f.control) {
      case "text": case "password": return textInput(f, f.control, { minlength: v.minLength, maxlength: v.maxLength });
      case "email": return textInput(f, "email", { autocomplete: "email" });
      case "phone": return textInput(f, "tel", { autocomplete: "tel", placeholder: f.placeholder || (f.phoneCountry ? `e.g. ${f.phoneCountry}` : undefined) });
      case "url": {
        const input = textInput(f, "url");
        input.addEventListener("blur", () => {
          if (input.value && !/^https?:\/\//i.test(input.value)) { input.value = "https://" + input.value; store.setValue(f.target, input.value); }
        });
        return input;
      }
      case "number": case "rating":
        return textInput(f, "number", { min: v.minimum ?? (f.control === "rating" ? 1 : undefined), max: v.maximum ?? (f.control === "rating" ? 5 : undefined), step: v.multipleOf });
      case "date": return textInput(f, "date", { min: v.minDate, max: v.maxDate });
      case "time": return textInput(f, "time");
      case "datetime": return textInput(f, "datetime-local", { min: v.minDate, max: v.maxDate });
      case "textarea": {
        const ta = el("textarea", { id: `f-${f.target}`, name: f.target, placeholder: f.placeholder, readonly: f.readOnly, maxlength: v.maxLength, "aria-describedby": `err-${f.target}` });
        ta.value = String(value ?? "");
        ta.addEventListener("input", () => store.setValue(f.target, ta.value));
        ta.addEventListener("blur", () => store.validate(f.target));
        return ta;
      }
      case "select": {
        const wrap = el("div", { class: "wf-select" });
        const sel = el("select", { id: `f-${f.target}`, name: f.target, disabled: f.readOnly, "aria-describedby": `err-${f.target}` });
        sel.append(el("option", { value: "", text: f.placeholder || "Select…" }));
        for (const c of f.choices) sel.append(el("option", { value: c.value, text: c.label }));
        let other = null;
        if (f.otherOption) {
          sel.append(el("option", { value: OTHER, text: f.otherOption.label }));
          other = el("input", { type: "text", class: "wf-other", placeholder: f.otherOption.placeholder || "Please specify", "aria-label": f.otherOption.label, hidden: true });
          other.addEventListener("input", () => store.setValue(f.target, otherValue(f, other.value)));
          other.addEventListener("blur", () => store.validate(f.target));
        }
        const existingOther = otherText(f, value);
        if (existingOther !== null && other) { sel.value = OTHER; other.hidden = false; other.value = existingOther; }
        else sel.value = String(value ?? "");
        sel.addEventListener("change", () => {
          if (sel.value === OTHER) { other.hidden = false; other.focus(); store.setValue(f.target, otherValue(f, other.value)); }
          else { if (other) other.hidden = true; store.setValue(f.target, sel.value); }
        });
        sel.addEventListener("blur", () => store.validate(f.target));
        wrap.append(sel);
        if (other) wrap.append(other);
        return wrap;
      }
      case "radio": case "checkboxGroup": case "tags": {
        const multi = f.control !== "radio";
        const group = el("div", { class: "wf-choices", role: multi ? "group" : "radiogroup", "aria-describedby": `err-${f.target}` });
        const read = () => {
          const checked = [...group.querySelectorAll("input[data-choice]")].filter((i) => i.checked).map((i) => i.value);
          const otherBox = group.querySelector("input[data-other]");
          const otherTxt = group.querySelector("input.wf-other");
          if (otherBox && otherBox.checked) checked.push(otherValue(f, otherTxt.value));
          store.setValue(f.target, multi ? checked : (checked[0] ?? ""));
        };
        const current = multi ? (Array.isArray(value) ? value : []) : [value];
        for (const c of f.choices) {
          const input = el("input", { type: multi ? "checkbox" : "radio", name: f.target, value: c.value, "data-choice": true, disabled: f.readOnly });
          input.checked = current.includes(c.value);
          input.addEventListener("change", read);
          input.addEventListener("blur", () => store.validate(f.target));
          group.append(el("label", { class: "wf-choice" }, input, el("span", { text: c.label })));
        }
        if (f.otherOption) {
          const box = el("input", { type: multi ? "checkbox" : "radio", name: f.target, "data-other": true });
          const txt = el("input", { type: "text", class: "wf-other", placeholder: f.otherOption.placeholder || "Please specify", "aria-label": f.otherOption.label });
          const prior = current.map((x) => otherText(f, x)).find((x) => x !== null);
          if (prior !== undefined && prior !== null) { box.checked = true; txt.value = prior; }
          box.addEventListener("change", read);
          txt.addEventListener("input", () => { box.checked = true; read(); });
          group.append(el("label", { class: "wf-choice" }, box, el("span", { text: f.otherOption.label }), txt));
        }
        return group;
      }
      case "checkbox": {
        const input = el("input", { type: "checkbox", id: `f-${f.target}`, name: f.target, disabled: f.readOnly, "aria-describedby": `err-${f.target}` });
        input.checked = value === true;
        input.addEventListener("change", () => { store.setValue(f.target, input.checked); store.validate(f.target); });
        return input;
      }
      case "file": case "signature": {
        const input = el("input", { type: "file", id: `f-${f.target}`, name: f.target, accept: v.accept, multiple: (v.fileLimit || 1) > 1, "aria-describedby": `err-${f.target}` });
        input.addEventListener("change", () => { store.setValue(f.target, [...input.files]); store.validate(f.target); });
        return input;
      }
      case "address": {
        const box = el("div", { class: "wf-address" });
        const addr = (value && typeof value === "object") ? value : {};
        for (const part of f.addressParts) {
          const id = `f-${f.target}-${part.sub}`;
          let ctl;
          if (part.choices && part.choices.length) {
            ctl = el("select", { id, "aria-describedby": `err-${f.target}/${part.sub}` });
            ctl.append(el("option", { value: "", text: "Select…" }));
            for (const c of part.choices) ctl.append(el("option", { value: c.value, text: c.label }));
          } else {
            ctl = el("input", { type: "text", id, "aria-describedby": `err-${f.target}/${part.sub}` });
          }
          ctl.value = String(addr[part.sub] ?? "");
          const evt = ctl.tagName === "SELECT" ? "change" : "input";
          ctl.addEventListener(evt, () => {
            const cur = store.getState().values[f.target];
            store.setValue(f.target, { ...(cur && typeof cur === "object" ? cur : {}), [part.sub]: ctl.value });
          });
          ctl.addEventListener("blur", () => store.validate(`${f.target}/${part.sub}`));
          box.append(el("div", { class: "wf-addr-part" },
            el("label", { for: id, text: part.label + (part.required ? " *" : "") }), ctl,
            el("p", { class: "wf-error", id: `err-${f.target}/${part.sub}`, "data-err": `${f.target}/${part.sub}` })));
        }
        return box;
      }
      default:
        return el("p", { class: "wf-note", text: "This question can't be answered here yet — please mention it in your message or contact us directly." });
    }
  }

  function buildField(f, form) {
    const wrap = el("div", { class: "form-field", "data-target": f.target });
    const forId = ["radio", "checkboxGroup", "tags", "address"].includes(f.control) ? undefined : `f-${f.target}`;
    const control = buildControl(f);
    if (f.control === "checkbox") {
      wrap.classList.add("wf-check");
      const lab = labelFor(f, form, forId);
      lab.prepend(control);
      wrap.append(lab);
    } else {
      wrap.append(labelFor(f, form, forId), control);
    }
    if (f.description) wrap.append(el("p", { class: "wf-help", text: f.description }));
    wrap.append(el("p", { class: "wf-error", id: `err-${f.target}`, "data-err": f.target }));
    return wrap;
  }

  function showOutcome(out) {
    if (out.url) {
      if (out.newTab) window.open(out.url, "_blank", "noopener");
      else { window.location.assign(out.url); return; }
    }
  }

  function render() {
    const st = store.getState();
    const form = st.form;

    if (st.outcome) {
      if (mode !== "done") {
        mode = "done";
        const msg = st.outcome.message ? paragraphs(st.outcome.message)
          : [el("p", { text: "Thank you — your request has been sent." })];
        mount.replaceChildren(el("div", { class: "wf-success", role: "status" }, el("div", { class: "wf-success-mark", text: "✓" }), ...msg));
        if (st.outcome.url) showOutcome(st.outcome);
      }
      return;
    }
    if (!form && st.errors[FORM_ERROR]) {
      if (mode !== "error") { mode = "error"; mount.replaceChildren(el("p", { class: "wf-form-error", role: "alert", text: st.errors[FORM_ERROR] })); }
      return;
    }
    if (!form) {
      if (mode !== "skeleton") {
        mode = "skeleton";
        mount.replaceChildren(el("div", { class: "wf-skeleton", "aria-busy": "true" }, ...[1, 2, 3, 4].map(() => el("div", { class: "wf-sk-row" }))));
      }
      return;
    }
    if (st.closed) {
      if (mode !== "closed") { mode = "closed"; mount.replaceChildren(el("p", { class: "wf-note", text: form.disabledMessage || "This form is no longer accepting requests. Please contact us directly." })); }
      return;
    }

    if (mode !== "form") {
      mode = "form";
      fieldEls.clear();
      listEl = el("div", { class: "wf-fields" });
      formErrEl = el("p", { class: "wf-form-error", role: "alert" });
      submitBtn = el("button", { type: "submit", class: "form-submit" });
      formEl = el("form", { novalidate: true }, listEl, formErrEl, submitBtn);
      formEl.addEventListener("submit", (e) => {
        e.preventDefault();
        store.submit(e).then((out) => { if (out) showOutcome(out); });
      });
      mount.replaceChildren(formEl);
    }

    // Fields: rebuild only those whose definition changed; keep the rest (and their focus).
    const step = form.steps[st.step] || form.steps[0];
    const fields = form.fields.filter((x) => !step || x.stepId === step.id);
    const keep = new Set(fields.map((f) => f.target));
    for (const [t, rec] of fieldEls) if (!keep.has(t)) { rec.wrap.remove(); fieldEls.delete(t); }
    fields.forEach((f, i) => {
      const key = fieldKey(f);
      let rec = fieldEls.get(f.target);
      if (!rec || rec.key !== key) {
        const wrap = buildField(f, form);
        if (rec) rec.wrap.replaceWith(wrap);
        rec = { key, wrap };
        fieldEls.set(f.target, rec);
      }
      if (listEl.children[i] !== rec.wrap) listEl.insertBefore(rec.wrap, listEl.children[i] || null);
    });

    // Errors and aria state.
    for (const p of listEl.querySelectorAll("[data-err]")) {
      const msg = st.errors[p.getAttribute("data-err")] || "";
      p.textContent = msg;
      const owner = listEl.querySelector(`[aria-describedby="${CSS.escape(p.id)}"]`);
      if (owner) { if (msg) owner.setAttribute("aria-invalid", "true"); else owner.removeAttribute("aria-invalid"); }
    }
    formErrEl.textContent = st.errors[FORM_ERROR] || "";
    formErrEl.hidden = !st.errors[FORM_ERROR];

    // Steps (multi-page forms the owner may create later).
    const last = st.step >= form.steps.length - 1;
    let back = formEl.querySelector(".wf-back");
    if (st.step > 0 && !back) {
      back = el("button", { type: "button", class: "wf-back", text: form.previousText || "Back" });
      back.addEventListener("click", () => store.previous());
      formEl.insertBefore(back, submitBtn);
    } else if (st.step === 0 && back) back.remove();
    submitBtn.type = last ? "submit" : "button";
    submitBtn.onclick = last ? null : () => store.next({ currentTarget: formEl });
    submitBtn.textContent = st.loading && last ? "Sending…" : last ? (form.submitText || "Send request") : (form.nextText || "Continue");
    submitBtn.disabled = st.loading;
  }

  store.subscribe(render);
  render();
  store.start();
  return store;
}
