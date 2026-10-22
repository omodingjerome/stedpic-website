/** The PUBLIC fieldset covers everything a byline needs: `profile.nickname` and `profile.photo`. */
export const AUTHOR_FIELDSETS = ["PUBLIC"];
/** Avatar size every byline gets — one scaled square URL per author. */
export const AVATAR_SIZE = 96;
/** Distinct, non-empty ids in first-seen order — one query per page, never one per card. */
export function uniqueIds(ids) {
    return [...new Set(ids.filter((id) => Boolean(id)))];
}
/**
 * The members query as the REST body — the SDK spells it queryMembers({ fieldsets }).in("_id", ids)
 * .limit(n). Members page by OFFSET (`paging`), unlike posts.
 */
export function authorsQuery(ids) {
    return { fieldsets: AUTHOR_FIELDSETS, query: { filter: { id: { $in: ids } }, paging: { limit: ids.length } } };
}
/**
 * A member photo in the form imgSrc scales. A Wix-hosted photo carries a media id (`_id` on the
 * SDK, `id` on REST) → the wix:image form; an avatar imported from a social login is an external
 * URL with an EMPTY id → passed through as-is (imgSrc leaves non-Wix URLs alone).
 */
export function photoValue(photo) {
    if (!photo)
        return "";
    const id = photo._id ?? photo.id;
    if (id)
        return `wix:image://v1/${id}/${id}${photo.width && photo.height ? `#originWidth=${photo.width}&originHeight=${photo.height}` : ""}`;
    return photo.url ?? "";
}
export function toAuthor(raw, imgSrc) {
    return {
        id: raw._id ?? raw.id ?? "",
        name: raw.profile?.nickname ?? "",
        avatarUrl: imgSrc(photoValue(raw.profile?.photo), AVATAR_SIZE, AVATAR_SIZE),
    };
}
/** Authors keyed by id — a plain object, not a Map, so it survives serialization into island props. */
export function indexAuthors(authors) {
    return Object.fromEntries(authors.filter((a) => a.id).map((a) => [a.id, a]));
}
