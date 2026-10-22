// The blog feed as a framework-free store — the logic behind useBlogFeed, usable from React
// (useBlogFeed wraps it with useSyncExternalStore), from a static page or Vue/Svelte (subscribe and
// render), or as the specification for a port. State, actions, subscribe/getState, emit after every
// change — the same shape as storefront's shop-store.
//
// Category and tag filters are applied by Wix (fetchPosts), never to a page already in hand; the
// two are mutually exclusive — setting one clears the other. A changed filter starts a fresh cursor
// chain; a late response from a superseded query is dropped. Paging appends by cursor. Author
// bylines and counters ride on the posts themselves (fetchPosts joins them per page).
//
// SSR-friendly: seed with `initialPage` (and `initialCategories`/`initialTags`) and the first page
// renders at once with no client fetch. A category or tag page seeds a FILTERED first page: pass the
// filter it was fetched with as `initialCategoryId`/`initialTagId`, and the seed is trusted for
// exactly that filter. A SPA passes nothing and `start()` fetches. One store per mounted feed (a
// page can hold a feed and a "latest posts" rail): createBlogFeedStore().
//
// Error vs empty: a failed read leaves `posts: []` AND sets `error`. Render the empty state only
// when `error` is null — "No posts yet" over a network failure is a lie.
import { fetchPosts } from "./posts.js";
import { fetchBlogCategories, fetchBlogTags } from "./taxonomy.js";
export function createBlogFeedStore({ initialPage, initialCategoryId = null, initialTagId = null, initialCategories, initialTags, pageSize = 20, } = {}) {
    let posts = initialPage?.posts ?? null;
    let cursor = initialPage?.nextCursor ?? null;
    let categories = initialCategories ?? [];
    let tags = initialTags ?? [];
    let activeCategoryId = initialCategoryId;
    let activeTagId = initialTagId;
    let loadingMore = false;
    let error = null;
    let started = false;
    let generation = 0; // bumped by every filter change and stop(); a response from an older generation is dropped
    const listeners = new Set();
    let snapshot = null;
    const emit = () => { snapshot = null; for (const fn of listeners)
        fn(); };
    function getState() {
        if (snapshot)
            return snapshot;
        snapshot = { posts, categories, tags, activeCategoryId, activeTagId, hasMore: cursor !== null, loadingMore, error };
        return snapshot;
    }
    // The seeded page answers exactly the filter it was fetched with — nothing else.
    const seedMatches = () => Boolean(initialPage) && activeCategoryId === initialCategoryId && activeTagId === initialTagId;
    // The first page for the current filter: the seed when it matches, a fetch otherwise.
    function query() {
        if (!started)
            return;
        const id = ++generation;
        loadingMore = false;
        if (seedMatches()) {
            posts = initialPage.posts;
            cursor = initialPage.nextCursor;
            error = null;
            emit();
            return;
        }
        posts = null;
        cursor = null;
        error = null;
        emit();
        fetchPosts({ limit: pageSize, categoryId: activeCategoryId, tagId: activeTagId })
            .then((page) => {
            if (generation !== id)
                return; // superseded — drop it
            posts = page.posts;
            cursor = page.nextCursor;
            emit();
        })
            .catch((e) => {
            if (generation !== id)
                return;
            posts = [];
            cursor = null;
            error = e instanceof Error ? e.message : String(e);
            emit();
        });
    }
    return {
        getState,
        subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
        start() {
            if (started)
                return;
            started = true;
            if (!initialCategories)
                fetchBlogCategories().then((c) => { if (started) {
                    categories = c;
                    emit();
                } });
            if (!initialTags)
                fetchBlogTags().then((t) => { if (started) {
                    tags = t;
                    emit();
                } });
            query();
        },
        stop() { started = false; generation++; },
        setActiveCategoryId(id) {
            if (id === activeCategoryId && activeTagId === null)
                return;
            activeCategoryId = id;
            activeTagId = null;
            query();
        },
        setActiveTagId(id) {
            if (id === activeTagId && activeCategoryId === null)
                return;
            activeTagId = id;
            activeCategoryId = null;
            query();
        },
        async loadMore() {
            if (!cursor || loadingMore)
                return;
            const id = generation;
            loadingMore = true;
            error = null;
            emit();
            try {
                const page = await fetchPosts({ limit: pageSize, cursor });
                if (generation !== id)
                    return;
                posts = [...(posts ?? []), ...page.posts];
                cursor = page.nextCursor;
            }
            catch (e) {
                if (generation !== id)
                    return;
                error = e instanceof Error ? e.message : String(e);
            }
            finally {
                if (generation === id) {
                    loadingMore = false;
                    emit();
                }
            }
        },
    };
}
