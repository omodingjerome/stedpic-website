// The purchase action as a framework-free store — the logic behind usePlanPurchase, usable from
// React (usePlanPurchase wraps it), from a static page's card or detail CTA, from Vue/Svelte, or
// as the specification for a port. All correctness (the hosted redirect session, member
// login/signup, payment) lives in the data layer; this store tracks the in-flight plan and the
// last failure, and navigates the FULL document to the hosted checkout.
//
// One store per purchase surface (a grid and a detail CTA each key their own spinner):
// createPlanPurchaseStore(), not a singleton. No async work on mount, so no start/stop.
import { purchasePlan } from "./purchase.js";
export function createPlanPurchaseStore() {
    let state = { purchasingId: null, error: null };
    const listeners = new Set();
    function setState(patch) {
        state = { ...state, ...patch };
        for (const fn of listeners)
            fn();
    }
    return {
        getState: () => state,
        subscribe(fn) {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
        async purchase(planId, options) {
            setState({ purchasingId: planId, error: null });
            try {
                window.location.href = await purchasePlan(planId, options);
                // stays "purchasing" — the browser is leaving for the hosted checkout
            }
            catch (e) {
                setState({ purchasingId: null, error: e instanceof Error ? e.message : String(e) });
                throw e;
            }
        },
    };
}
