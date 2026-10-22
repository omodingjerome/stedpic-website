// FAQ page state — a module-scope store, deliberately NOT a React context and not a per-surface
// factory: the category nav, the search box, and the accordion are separate Astro islands on one
// page and must share one state (a context can't span islands; each island is its own React root).
// Framework-free — consume it through useFaq() (hooks/), or subscribe directly from a static page,
// Vue, or Svelte. Same shape as the storefront cart store: getState/subscribe + actions, emit after
// every change.
//
// Seeding: every island receives the SSR data and calls seedFaq(); on the server every seed replaces
// the state (a request renders its own props), in the browser the first seed wins and the rest are
// no-ops, so the SSR HTML and the first client paint agree. A page with no SSR data (a SPA) fetches on
// the first subscription.
//
// URL state (syncUrl, default on): `?category=<id>` and `#q-<slug>` are read once when the first
// island subscribes and written with history.replaceState on every change — a visitor can copy the
// address bar at any point and get back to the same view.
import { fetchFaq } from "./faq.js";
import { anchorId, findByAnchor, parseDeepLink, visibleQuestions } from "./faq-core.js";
const EMPTY_DATA = { categories: [], questions: [], truncated: false };
let state = {
    data: null,
    activeCategoryId: null,
    query: "",
    expandedIds: [],
    visible: [],
    resultsCount: 0,
    loading: false,
    error: null,
};
let expandOnlyOne = true;
let openFirst = false;
let syncUrl = true;
let seeded = false;
let started = false;
let generation = 0; // bumped by every load; a response from an older generation is dropped
const listeners = new Set();
const isBrowser = () => typeof window !== "undefined";
function setState(patch) {
    const next = { ...state, ...patch };
    next.visible = visibleQuestions(next.data, next.activeCategoryId, next.query);
    next.resultsCount = next.query.trim() ? next.visible.length : 0;
    state = next;
    for (const l of listeners)
        l();
}
function writeUrl() {
    if (!syncUrl || !isBrowser() || typeof history === "undefined")
        return;
    const url = new URL(location.href);
    if (state.activeCategoryId)
        url.searchParams.set("category", state.activeCategoryId);
    else
        url.searchParams.delete("category");
    const open = state.expandedIds.length === 1 ? state.visible.find((q) => q.id === state.expandedIds[0]) : undefined;
    url.hash = open ? anchorId(open) : "";
    try {
        history.replaceState(history.state, "", url.pathname + url.search + url.hash);
    }
    catch {
        /* a sandboxed frame may refuse — the view is right, only the address bar lags */
    }
}
/** `?category` and `#q-…` from the address bar → state: the anchor's question expands and its category is shown. */
function applyDeepLink() {
    if (!syncUrl || !isBrowser() || !state.data)
        return;
    const { categoryId, anchor } = parseDeepLink(location.search, location.hash);
    const patch = {};
    if (categoryId && state.data.categories.some((c) => c.id === categoryId))
        patch.activeCategoryId = categoryId;
    const target = anchor ? findByAnchor(state.data.questions, anchor) : undefined;
    if (target) {
        patch.expandedIds = expandOnlyOne ? [target.id] : [...new Set([...state.expandedIds, target.id])];
        // The deep link decides the category: a question hidden by the active filter switches the filter to its own.
        const active = patch.activeCategoryId ?? state.activeCategoryId;
        if (active && active !== target.categoryId)
            patch.activeCategoryId = target.categoryId;
    }
    if (Object.keys(patch).length)
        setState(patch);
    if (target && typeof document !== "undefined") {
        requestAnimationFrame(() => document.getElementById(anchorId(target))?.scrollIntoView({ block: "start" }));
    }
}
function load() {
    const id = ++generation;
    setState({ loading: true, error: null });
    fetchFaq()
        .then((data) => {
        if (generation !== id)
            return; // superseded — drop it
        setState({ data, loading: false, expandedIds: openFirst ? firstId(data) : state.expandedIds });
        applyDeepLink();
    })
        .catch((e) => {
        if (generation !== id)
            return;
        // An empty data set with an error: the accordion shows the error line and a retry, not skeletons forever.
        setState({ data: state.data ?? EMPTY_DATA, loading: false, error: e instanceof Error ? e.message : String(e) });
    });
}
function firstId(data) {
    const first = visibleQuestions(data, state.activeCategoryId, state.query)[0];
    return first ? [first.id] : [];
}
function start() {
    if (started)
        return;
    started = true;
    if (state.data)
        applyDeepLink();
    else
        load();
}
/**
 * Hand the store its SSR data and options. Call from every island (useFaq does) — on the server each
 * call replaces the state (one request, one data set); in the browser the first call seeds and later
 * calls are no-ops, so hydration matches the server HTML.
 */
export function seedFaq(o = {}) {
    if (o.expandOnlyOne !== undefined)
        expandOnlyOne = o.expandOnlyOne;
    if (o.openFirst !== undefined)
        openFirst = o.openFirst;
    if (o.syncUrl !== undefined)
        syncUrl = o.syncUrl;
    if (!o.initialData || (seeded && isBrowser()))
        return;
    seeded = true;
    const activeCategoryId = o.initialCategoryId && o.initialData.categories.some((c) => c.id === o.initialCategoryId) ? o.initialCategoryId : null;
    const data = o.initialData;
    state = { ...state, data, activeCategoryId, loading: false, error: null };
    state.visible = visibleQuestions(data, activeCategoryId, state.query);
    state.resultsCount = 0;
    state.expandedIds = openFirst ? firstId(data) : [];
    // No emit: seeding happens during render, before any subscriber exists.
}
export function getFaqState() {
    return state;
}
/** The first browser subscriber starts the store: the deep link is applied, and unseeded data is fetched. */
export function subscribeFaq(listener) {
    listeners.add(listener);
    if (isBrowser())
        start();
    return () => listeners.delete(listener);
}
/** Show one category (null = all). Keeps the search query — the two compose. */
export function selectCategory(id) {
    if (id === state.activeCategoryId)
        return;
    setState({ activeCategoryId: id });
    writeUrl();
}
/** Set the search query (debounce lives in the component). */
export function setQuery(q) {
    if (q === state.query)
        return;
    setState({ query: q });
}
export function toggleQuestion(id) {
    if (state.expandedIds.includes(id))
        collapseQuestion(id);
    else
        expandQuestion(id);
}
export function expandQuestion(id) {
    if (state.expandedIds.includes(id))
        return;
    setState({ expandedIds: expandOnlyOne ? [id] : [...state.expandedIds, id] });
    writeUrl();
}
export function collapseQuestion(id) {
    if (!state.expandedIds.includes(id))
        return;
    setState({ expandedIds: state.expandedIds.filter((x) => x !== id) });
    writeUrl();
}
export function collapseAll() {
    if (!state.expandedIds.length)
        return;
    setState({ expandedIds: [] });
    writeUrl();
}
/** Re-run the load after an error. */
export function retry() {
    load();
}
