// Plan access (paywall) as a framework-free store — the logic behind usePlanAccess, usable from
// React (usePlanAccess wraps it with useSyncExternalStore), from a static page or Vue/Svelte
// (subscribe and render), or as the specification for a port. State, subscribe/getState,
// check/stop, emit after every change.
//
// It does not know who is logged in — that is the `members` vertical's session (its store's
// `{ loggedIn, loading }`), handed in through `check(session)`. The rules: while the session is
// still loading, so is access; a visitor has no access and NO call is made (Member List Orders is
// member-only — it would be refused); a member gets one read, re-run only when the session flips.
// A failed read leaves `hasAccess: false` with the message in `error` — gated content stays closed.
//
// SSR-friendly: `initialAccess` (resolved in frontmatter with hasActiveOrderFor under a member
// session) renders at once with no client call. One store per gated surface: createPlanAccessStore().
// It imports the data layer by names the REST twin exports identically, so the same file runs over
// the SDK in Astro and over REST on a static page.
import { hasActiveOrderFor } from "./plan-access.js";
export function createPlanAccessStore({ planIds, initialAccess, call }) {
    let state = { hasAccess: initialAccess ?? false, loading: initialAccess === undefined, error: null };
    let stopped = false;
    /** The loggedIn value the last read ran for — a member is read once, not on every render. */
    let readFor = initialAccess === undefined ? null : true;
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
        check(session) {
            stopped = false;
            if (session.loading) {
                if (!state.loading)
                    setState({ loading: true });
                return;
            }
            if (readFor === session.loggedIn)
                return;
            readFor = session.loggedIn;
            if (!session.loggedIn) {
                setState({ hasAccess: false, loading: false, error: null }); // a visitor: no orders, no call
                return;
            }
            setState({ loading: true, error: null });
            hasActiveOrderFor(planIds, call)
                .then((hasAccess) => { if (!stopped)
                setState({ hasAccess, loading: false }); })
                .catch((e) => { if (!stopped)
                setState({ hasAccess: false, loading: false, error: e instanceof Error ? e.message : String(e) }); });
        },
        stop() {
            stopped = true;
        },
    };
}
