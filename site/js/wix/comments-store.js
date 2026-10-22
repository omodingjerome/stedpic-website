// A post's comment thread as a framework-free store — the logic behind useComments, usable from
// React (useComments wraps it), from a static page, from Vue/Svelte, or as the specification for a
// port. Top-level comments page by cursor; each one's replies load on demand from the seam the list
// handed back; creating and deleting run as the current identity.
//
// Mount it only when `post.commentingEnabled && post.referenceId` — the referenceId IS the thread.
// Whether guests may comment is the dashboard's "Who can comment" setting, decided by the server: a
// refused create sets `needsSignIn` (render a sign-in prompt), never a client-side guess. The
// site-wide comments master switch has no public read — a post whose owner turned comments off
// site-wide still says commentingEnabled here.
import { fetchCurrentMemberId } from "./authors.js";
import { createComment, deleteComment, fetchComments, fetchReplies } from "./comments.js";
import { DEFAULT_COMMENT_SORT, markOwn, mergeById, toDeletedPlaceholder } from "./comments-core.js";
import { isPermissionDenied } from "./posts-core.js";
export function createCommentsStore({ referenceId, pageSize, sort: initialSort = DEFAULT_COMMENT_SORT }) {
    let comments = null;
    let replies = {};
    let cursor = null;
    let loadingMore = false;
    let saving = false;
    let needsSignIn = false;
    let currentMemberId = null;
    let sort = initialSort;
    let error = null;
    let started = false;
    let generation = 0;
    const listeners = new Set();
    let snapshot = null;
    const emit = () => { snapshot = null; for (const fn of listeners)
        fn(); };
    const message = (e) => (e instanceof Error ? e.message : String(e));
    function getState() {
        if (snapshot)
            return snapshot;
        snapshot = { comments, replies, hasMore: cursor !== null, loadingMore, saving, needsSignIn, currentMemberId, sort, error };
        return snapshot;
    }
    // The first page for the current sort; a changed sort restarts the list and drops late answers.
    async function load() {
        const id = ++generation;
        comments = null;
        replies = {};
        cursor = null;
        error = null;
        emit();
        try {
            const page = await fetchComments({ referenceId, limit: pageSize, sort, currentMemberId });
            if (generation !== id)
                return;
            comments = page.comments;
            cursor = page.nextCursor;
            replies = Object.fromEntries(Object.entries(page.replies).map(([k, t]) => [k, { ...t, loading: false }]));
        }
        catch (e) {
            if (generation !== id)
                return;
            comments = [];
            error = message(e);
        }
        emit();
    }
    return {
        getState,
        subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
        start() {
            if (started)
                return;
            started = true;
            // The member read and the list run in parallel; ownership is re-marked once the id is known.
            fetchCurrentMemberId().then((mid) => {
                if (!started)
                    return;
                currentMemberId = mid;
                if (comments)
                    comments = markOwn(comments, mid);
                replies = Object.fromEntries(Object.entries(replies).map(([k, t]) => [k, { ...t, comments: markOwn(t.comments, mid) }]));
                emit();
            });
            void load();
        },
        stop() { started = false; generation++; },
        async loadMore() {
            if (!cursor || loadingMore)
                return;
            const id = generation;
            loadingMore = true;
            error = null;
            emit();
            try {
                const page = await fetchComments({ referenceId, limit: pageSize, sort, cursor, currentMemberId });
                if (generation !== id)
                    return;
                comments = mergeById(comments ?? [], page.comments);
                cursor = page.nextCursor;
                for (const [k, t] of Object.entries(page.replies))
                    replies[k] ??= { ...t, loading: false };
                replies = { ...replies };
            }
            catch (e) {
                if (generation !== id)
                    return;
                error = message(e);
            }
            finally {
                if (generation === id) {
                    loadingMore = false;
                    emit();
                }
            }
        },
        async loadReplies(topLevelId) {
            const thread = replies[topLevelId];
            if (!thread?.nextCursor || thread.loading)
                return;
            const id = generation;
            replies = { ...replies, [topLevelId]: { ...thread, loading: true } };
            emit();
            try {
                const page = await fetchReplies({ referenceId, topLevelId, cursor: thread.nextCursor, currentMemberId });
                if (generation !== id)
                    return;
                replies = { ...replies, [topLevelId]: { comments: mergeById(thread.comments, page.comments), nextCursor: page.nextCursor, loading: false } };
            }
            catch (e) {
                if (generation !== id)
                    return;
                replies = { ...replies, [topLevelId]: { ...thread, loading: false } };
                error = message(e);
            }
            emit();
        },
        setSort(next) {
            if (next === sort)
                return;
            sort = next;
            if (started)
                void load();
        },
        async create(text, { parentId = null, topLevelId = null } = {}) {
            const body = text.trim();
            if (!body || saving)
                return null;
            const threadId = parentId ? (topLevelId ?? parentId) : null;
            saving = true;
            needsSignIn = false;
            error = null;
            emit();
            try {
                const created = await createComment({ referenceId, text: body, parentId, topLevelId: threadId, currentMemberId });
                if (threadId) {
                    // A reply joins its top-level comment's thread (oldest first → appended) and bumps its count.
                    const thread = replies[threadId] ?? { comments: [], nextCursor: null, loading: false };
                    replies = { ...replies, [threadId]: { ...thread, comments: mergeById(thread.comments, [created]) } };
                    comments = (comments ?? []).map((c) => (c.id === threadId ? { ...c, replyCount: c.replyCount + 1 } : c));
                }
                else {
                    comments = sort === "NEWEST_FIRST" ? mergeById([created], comments ?? []) : mergeById(comments ?? [], [created]);
                }
                return created;
            }
            catch (e) {
                if (isPermissionDenied(e))
                    needsSignIn = true;
                else
                    error = message(e);
                return null;
            }
            finally {
                saving = false;
                emit();
            }
        },
        async remove(commentId) {
            if (saving)
                return;
            saving = true;
            error = null;
            emit();
            try {
                await deleteComment(commentId);
                const top = (comments ?? []).find((c) => c.id === commentId);
                if (top) {
                    // A top-level comment with replies stays as a placeholder so its thread keeps its context.
                    const hasReplies = top.replyCount > 0 || (replies[commentId]?.comments.length ?? 0) > 0;
                    comments = hasReplies ? comments.map((c) => (c.id === commentId ? toDeletedPlaceholder(c) : c)) : comments.filter((c) => c.id !== commentId);
                }
                else {
                    for (const [k, t] of Object.entries(replies)) {
                        if (!t.comments.some((c) => c.id === commentId))
                            continue;
                        // A reply that other replies point at stays as a placeholder; a leaf is dropped.
                        const referenced = t.comments.some((c) => c.parentId === commentId);
                        replies = { ...replies, [k]: { ...t, comments: referenced ? t.comments.map((c) => (c.id === commentId ? toDeletedPlaceholder(c) : c)) : t.comments.filter((c) => c.id !== commentId) } };
                        if (!referenced)
                            comments = (comments ?? []).map((c) => (c.id === k ? { ...c, replyCount: Math.max(0, c.replyCount - 1) } : c));
                    }
                }
            }
            catch (e) {
                if (isPermissionDenied(e))
                    needsSignIn = true;
                else
                    error = message(e);
            }
            finally {
                saving = false;
                emit();
            }
        },
    };
}
