// Author reads over REST — the twin of app/wix/blog/authors.ts. Same exports, same DTOs; the
// mappers come from authors-core (the SAME file the SDK transport uses, deployed flat next to this
// one). Both reads are non-fatal: authors are decoration on a card. Porting: keep the paths, keep
// the bodies, port the core once.
// docs: https://dev.wix.com/docs/api-reference/crm/members-contacts/members/member-management/members/query-members.md
// docs: https://dev.wix.com/docs/api-reference/crm/members-contacts/members/member-management/members/get-my-member.md
import { wixRequest } from "./client.js";
import { imgSrc } from "./media.js";
import { authorsQuery, indexAuthors, toAuthor, uniqueIds } from "./authors-core.js";
/**
 * Every distinct author of one page in ONE request, keyed by member id. {} on failure.
 * POST /members/v1/members/query  { fieldsets: ["PUBLIC"], query: { filter: { id: { $in } }, paging: { limit } } }
 */
export async function fetchAuthorsByIds(ids) {
    const unique = uniqueIds(ids);
    if (!unique.length)
        return {};
    try {
        const res = await wixRequest("/members/v1/members/query", { body: authorsQuery(unique) });
        return indexAuthors((res?.members ?? []).map((m) => toAuthor(m, imgSrc)));
    }
    catch {
        return {};
    }
}
/**
 * The current member's id, or null for an anonymous visitor (401/403 → null).
 * GET /members/v1/members/my
 */
export async function fetchCurrentMemberId() {
    try {
        const res = await wixRequest("/members/v1/members/my", { method: "GET" });
        return res?.member?.id ?? null;
    }
    catch {
        return null;
    }
}
