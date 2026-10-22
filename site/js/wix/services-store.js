// The services listing as a framework-free store — the logic behind useServices, usable from React
// (useServices wraps it with useSyncExternalStore), from a static page or Vue/Svelte (subscribe and
// render), or as the specification for a port. State, actions, subscribe/getState, emit after every
// change. Category and location filters are applied by Wix (a fresh first page per selection, as its
// own service list does), pages are 20 long with `hasMore`/`loadMore()`, and the selection lives in
// the URL (`?category=`, `?location=`) so a filtered list is a link. After every page ONE batched
// calendar call fills `offeredDays` on the classes and courses of that page.
// SSR-friendly: seed with `initialServices` (+ `initialHasMore`, `initialCategories`, `initialLocations`)
// and nothing is fetched for the first paint; without them `start()` loads everything.
// One store per mounted listing: createServicesStore(), not a singleton.
import { fetchOfferedDays } from "./booking.js";
import { OTHER_LOCATIONS_ID, SERVICES_PAGE_SIZE, fetchBookingCategories, fetchLocations, fetchServices } from "./services.js";
export { OTHER_LOCATIONS_ID };
const CATEGORY_PARAM = "category";
const LOCATION_PARAM = "location";
const readParam = (name) => {
    if (typeof window === "undefined")
        return null;
    try {
        return new URL(window.location.href).searchParams.get(name) || null;
    }
    catch {
        return null;
    }
};
const writeParams = (values) => {
    if (typeof window === "undefined" || typeof history === "undefined")
        return;
    try {
        const url = new URL(window.location.href);
        for (const [k, v] of Object.entries(values))
            v ? url.searchParams.set(k, v) : url.searchParams.delete(k);
        history.replaceState(history.state, "", url.toString());
    }
    catch {
        /* an unusual URL — the selection still applies, it just isn't shareable */
    }
};
export function createServicesStore({ initialServices, initialHasMore = false, initialCategories, initialLocations, initialCategoryId = null, initialLocationId = null, pageSize = SERVICES_PAGE_SIZE, syncUrl = true, } = {}) {
    let services = initialServices ?? null;
    let categories = initialCategories ?? [];
    let locations = initialLocations?.locations ?? [];
    let hasOtherLocations = initialLocations?.hasOtherLocations ?? false;
    let activeCategoryId = initialCategoryId;
    let activeLocationId = initialLocationId;
    let hasMore = initialHasMore;
    let loadingMore = false;
    let error = null;
    let started = false;
    let generation = 0;
    const listeners = new Set();
    let snapshot = null;
    const emit = () => {
        snapshot = null;
        for (const fn of listeners)
            fn();
    };
    function getState() {
        if (snapshot)
            return snapshot;
        snapshot = { services, categories, locations, hasOtherLocations, activeCategoryId, activeLocationId, hasMore, loadingMore, error };
        return snapshot;
    }
    // One batched MASTER-events call per page: the weekdays every class/course on it meets (appointments have none).
    function fillOfferedDays(items, id) {
        const scheduleIds = [...new Set(items.filter((s) => s.type !== "APPOINTMENT").map((s) => s.scheduleId).filter((x) => !!x))];
        if (!scheduleIds.length)
            return;
        fetchOfferedDays(scheduleIds).then((days) => {
            if (!started || generation !== id || !services)
                return;
            services = services.map((s) => (s.scheduleId && days[s.scheduleId] ? { ...s, offeredDays: days[s.scheduleId] } : s));
            emit();
        });
    }
    // The selection changed: a fresh first page from Wix (the filter is applied there, never to a page in hand).
    function loadFirstPage() {
        if (!started)
            return;
        const id = ++generation;
        services = null;
        hasMore = false;
        loadingMore = false; // an in-flight loadMore belongs to the old selection
        error = null;
        emit();
        fetchServices({ limit: pageSize, offset: 0, categoryId: activeCategoryId, locationId: activeLocationId })
            .then((page) => {
            if (!started || generation !== id)
                return; // superseded — drop it
            services = page.items;
            hasMore = page.hasMore;
            emit();
            fillOfferedDays(page.items, id);
        })
            .catch((e) => {
            if (!started || generation !== id)
                return;
            services = [];
            error = e instanceof Error ? e.message : String(e);
            emit();
        });
    }
    return {
        getState,
        subscribe(fn) {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
        start() {
            if (started)
                return;
            started = true;
            // The URL is the source of truth for the selection; a seeded page fetched with a different one is stale.
            const urlCategory = syncUrl ? readParam(CATEGORY_PARAM) : null;
            const urlLocation = syncUrl ? readParam(LOCATION_PARAM) : null;
            const selectionChanged = syncUrl && ((urlCategory ?? null) !== activeCategoryId || (urlLocation ?? null) !== activeLocationId);
            if (selectionChanged) {
                activeCategoryId = urlCategory;
                activeLocationId = urlLocation;
            }
            if (!initialServices || selectionChanged)
                loadFirstPage();
            else
                fillOfferedDays(initialServices, generation);
            if (!initialCategories)
                fetchBookingCategories().then((c) => { if (started) {
                    categories = c;
                    emit();
                } });
            if (!initialLocations)
                fetchLocations().then((l) => { if (started) {
                    locations = l.locations;
                    hasOtherLocations = l.hasOtherLocations;
                    emit();
                } });
        },
        stop() {
            started = false;
            generation++;
        },
        setActiveCategoryId(id) {
            if (id === activeCategoryId)
                return;
            activeCategoryId = id;
            if (syncUrl)
                writeParams({ [CATEGORY_PARAM]: id });
            loadFirstPage();
        },
        setActiveLocationId(id) {
            if (id === activeLocationId)
                return;
            activeLocationId = id;
            if (syncUrl)
                writeParams({ [LOCATION_PARAM]: id });
            loadFirstPage();
        },
        async loadMore() {
            if (!started || loadingMore || !hasMore || !services)
                return;
            const id = generation;
            loadingMore = true;
            emit();
            try {
                const page = await fetchServices({ limit: pageSize, offset: services.length, categoryId: activeCategoryId, locationId: activeLocationId });
                if (!started || generation !== id)
                    return;
                services = [...services, ...page.items];
                hasMore = page.hasMore;
                fillOfferedDays(page.items, id);
            }
            catch (e) {
                if (!started || generation !== id)
                    return;
                error = e instanceof Error ? e.message : String(e);
            }
            finally {
                if (generation === id)
                    loadingMore = false;
                emit();
            }
        },
    };
}
