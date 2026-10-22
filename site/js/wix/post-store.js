// One post as a framework-free store — the logic behind usePost, usable from React (usePost wraps
// it), from a static page's post view, from Vue/Svelte, or as the specification for a port. Loads
// the post by slug (unless seeded), resolves its category chips from the catalog and its tag chips
// BY ID (both in the post's own order), loads the related strip, and — in a browser only — the
// viewer's like state with fresh counters, with an optimistic like toggle.
//
// SSR-friendly: pass the server-fetched PostDetail as `initialPost` (plus `initialCategories`,
// `initialTags`, `initialRelated`) and no client read happens except the personal like state; a SPA
// passes only the slug. One store per post surface: createPostStore().
import { fetchPostBySlug, fetchRelatedPosts } from "./posts.js";
import { fetchLikeState, likePost, unlikePost } from "./post-likes.js";
import { fetchBlogCategories, fetchTagsByIds, inIdOrder } from "./taxonomy.js";
export function createPostStore({ slug, initialPost, initialCategories, initialTags, initialRelated, engagement = true }) {
    let post = initialPost && initialPost.slug === slug ? initialPost : null;
    let notFound = false;
    let catalog = initialCategories ?? null;
    let tags = initialTags && post ? inIdOrder(post.tagIds, initialTags) : [];
    let related = initialRelated ?? null;
    let liked = false;
    let baselineLiked = false; // what the server said — the optimistic delta is measured against it
    let freshLikes;
    let likeCountLoaded = false;
    let viewCount = post?.viewCount;
    let commentCount = post?.commentCount;
    let liking = false;
    let error = null;
    let started = false;
    const listeners = new Set();
    let snapshot = null;
    const emit = () => { snapshot = null; for (const fn of listeners)
        fn(); };
    function likeCount() {
        const base = freshLikes ?? post?.likeCount;
        return base === undefined ? undefined : Math.max(0, base + Number(liked) - Number(baselineLiked));
    }
    function getState() {
        if (snapshot)
            return snapshot;
        snapshot = {
            post,
            notFound,
            categories: post && catalog ? inIdOrder(post.categoryIds, catalog) : [],
            tags,
            related,
            isLiked: liked,
            likeCount: likeCount(),
            likeCountLoaded,
            viewCount,
            commentCount,
            liking,
            error,
        };
        return snapshot;
    }
    // Everything that needs the post: tag chips by id, the related strip, the viewer's like state.
    function afterPost(p) {
        if (!initialTags)
            fetchTagsByIds(p.tagIds).then((t) => { if (started) {
                tags = t;
                emit();
            } });
        if (!initialRelated)
            fetchRelatedPosts(p).then((r) => { if (started) {
                related = r;
                emit();
            } });
        // Personal and visitor-scoped: never during SSR (the identity there is the app, not the viewer).
        if (engagement && typeof window !== "undefined") {
            fetchLikeState(p.id).then(({ liked: l, metrics }) => {
                if (!started)
                    return;
                liked = baselineLiked = l;
                if (metrics) {
                    freshLikes = metrics.likes;
                    viewCount = metrics.views ?? viewCount;
                    commentCount = metrics.comments ?? commentCount;
                }
                likeCountLoaded = true;
                emit();
            });
        }
    }
    return {
        getState,
        subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
        start() {
            if (started)
                return;
            started = true;
            if (!catalog)
                fetchBlogCategories().then((c) => { if (started) {
                    catalog = c;
                    emit();
                } });
            if (post) {
                afterPost(post);
            }
            else {
                notFound = false;
                emit();
                fetchPostBySlug(slug)
                    .then((p) => {
                    if (!started)
                        return;
                    if (p) {
                        post = p;
                        viewCount = p.viewCount;
                        commentCount = p.commentCount;
                        afterPost(p);
                    }
                    else
                        notFound = true;
                    emit();
                })
                    .catch((e) => { if (started) {
                    error = e instanceof Error ? e.message : String(e);
                    emit();
                } });
            }
        },
        stop() { started = false; },
        async toggleLike() {
            if (!post || liking)
                return;
            const next = !liked;
            liked = next;
            liking = true;
            emit(); // optimistic flip
            try {
                await (next ? likePost(post.id) : unlikePost(post.id));
            }
            catch {
                liked = !next; // roll back — the control reverting is the whole error surface
            }
            finally {
                liking = false;
                emit();
            }
        },
    };
}
