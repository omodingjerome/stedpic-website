// A copy of posts-core's BLOG_APP_ID and dateParts, so this file stands alone when stripped.
const BLOG_APP_ID = "14bcded7-0066-7c35-14d7-466cb3f09103";
function dateParts(value) {
    if (!value)
        return { dateLabel: "", dateISO: "" };
    const d = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(d.getTime()))
        return { dateLabel: "", dateISO: "" };
    return { dateLabel: d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }), dateISO: d.toISOString() };
}
/** Top-level comments per page (Wix's default) and replies per "show more replies". */
export const COMMENTS_PAGE_SIZE = 10;
export const REPLIES_PAGE_SIZE = 10;
export const DEFAULT_COMMENT_SORT = "NEWEST_FIRST";
/**
 * The list-by-resource request as flat query-string params (the endpoint is a GET; nested fields
 * travel as dotted keys, the SDK flattens them the same way). `repliesLimit: 0` asks for the reply
 * SEAMS only — each top-level comment's reply cursor comes back without its replies, which load on
 * demand with `listRepliesParams`.
 */
export function listCommentsParams({ referenceId, cursor, limit = COMMENTS_PAGE_SIZE, sort = DEFAULT_COMMENT_SORT }) {
    return {
        appId: BLOG_APP_ID,
        contextId: referenceId,
        resourceId: referenceId,
        "commentSort.order": sort,
        "replySort.order": "OLDEST_FIRST",
        "cursorPaging.limit": String(limit),
        "cursorPaging.repliesLimit": "0",
        ...(cursor ? { "cursorPaging.cursor": cursor } : {}),
    };
}
/** The same GET, continuing ONE top-level comment's replies from the cursor the list handed back. */
export function listRepliesParams({ referenceId, cursor, limit = REPLIES_PAGE_SIZE }) {
    return {
        appId: BLOG_APP_ID,
        contextId: referenceId,
        resourceId: referenceId,
        "replySort.order": "OLDEST_FIRST",
        "cursorPaging.limit": String(limit),
        "cursorPaging.cursor": cursor,
    };
}
/** A one-paragraph Ricos document: TEXT is always a leaf inside a PARAGRAPH; the leaf's id is "". */
export function textToRichContent(text) {
    return {
        nodes: [
            { type: "PARAGRAPH", id: "c1", nodes: [{ type: "TEXT", id: "", nodes: [], textData: { text, decorations: [] } }], paragraphData: {} },
        ],
    };
}
/** The create body: `{ comment }`, the reply's parent as `parentComment.id`. */
export function createCommentBody({ referenceId, text, richContent, parentId }) {
    return {
        comment: {
            appId: BLOG_APP_ID,
            contextId: referenceId,
            resourceId: referenceId,
            content: { richContent: richContent ?? textToRichContent(text ?? "") },
            ...(parentId ? { parentComment: { id: parentId } } : {}),
        },
    };
}
/** The plain text of a Ricos document — every TEXT leaf, paragraphs joined by newlines. */
export function richContentText(rc) {
    const walk = (node) => node.type === "TEXT" ? (node.textData?.text ?? "") : (node.nodes ?? []).map(walk).join("");
    return (rc?.nodes ?? []).map(walk).map((s) => s.trim()).filter(Boolean).join("\n");
}
const STATUSES = ["PUBLISHED", "PENDING", "DELETED", "HIDDEN"];
export function toComment(raw, { authors, currentMemberId, topLevelId }) {
    const status = STATUSES.includes(raw.status) ? raw.status : "UNKNOWN";
    // A PENDING comment (awaiting the owner's approval) carries its text as draftContent, not content.
    const content = raw.content?.richContent ?? (status === "PENDING" ? raw.draftContent?.richContent : null) ?? null;
    const authorId = raw.author?.memberId ?? "";
    const author = authors[authorId];
    const parentAuthor = authors[raw.parentComment?.author?.memberId ?? ""];
    return {
        id: raw._id ?? raw.id ?? "",
        topLevelId,
        parentId: raw.parentComment?._id ?? raw.parentComment?.id ?? null,
        parentAuthorName: parentAuthor?.name ?? "",
        authorId,
        authorName: author?.name ?? "",
        authorAvatarUrl: author?.avatarUrl ?? "",
        isOwn: Boolean(currentMemberId) && authorId === currentMemberId,
        ...dateParts(raw.commentDate ?? raw._createdDate ?? raw.createdDate),
        status,
        content,
        text: richContentText(content),
        replyCount: typeof raw.replyCount === "number" ? raw.replyCount : 0,
    };
}
/** Every member id a raw comment list references (authors and reply-to authors), for one batched lookup. */
export function commentAuthorIds(raws) {
    return [...new Set(raws.flatMap((c) => [c.author?.memberId, c.parentComment?.author?.memberId]).filter((id) => Boolean(id)))];
}
/** All raw comments a list response carries — the top-level ones and every seam's replies. */
export function rawCommentsOf(res) {
    const replies = Object.values((res?.commentReplies ?? {})).flatMap((r) => (r.replies ?? []));
    return [...(res?.comments ?? []), ...replies];
}
export function toCommentPage(res, ctx) {
    const replies = {};
    for (const [topLevelId, r] of Object.entries((res?.commentReplies ?? {}))) {
        replies[topLevelId] = {
            comments: (r.replies ?? []).map((c) => toComment(c, { ...ctx, topLevelId })),
            nextCursor: r.pagingMetadata?.cursors?.next ?? null,
        };
    }
    return {
        comments: (res?.comments ?? []).map((c) => toComment(c, { ...ctx, topLevelId: null })),
        nextCursor: res?.pagingMetadata?.cursors?.next ?? null,
        replies,
    };
}
/** A replies page: the same response shape, its `comments` being the replies of one top-level comment. */
export function toCommentThread(res, ctx) {
    return {
        comments: (res?.comments ?? []).map((c) => toComment(c, ctx)),
        nextCursor: res?.pagingMetadata?.cursors?.next ?? null,
    };
}
/** Re-mark ownership once the current member is known (the list and the member read run in parallel). */
export function markOwn(items, currentMemberId) {
    return items.map((c) => ({ ...c, isOwn: Boolean(currentMemberId) && c.authorId === currentMemberId }));
}
/** A deleted comment that still has replies stays as a placeholder: no author, no body. */
export function toDeletedPlaceholder(c) {
    return { ...c, status: "DELETED", content: null, text: "", authorId: "", authorName: "", authorAvatarUrl: "", isOwn: false };
}
/** Merge a page into a list by id, keeping the existing order and appending what is new. */
export function mergeById(existing, incoming) {
    const byId = new Map(existing.map((c) => [c.id, c]));
    for (const c of incoming)
        byId.set(c.id, c);
    const seen = new Set(existing.map((c) => c.id));
    return [...existing.map((c) => byId.get(c.id)), ...incoming.filter((c) => !seen.has(c.id))];
}
