/**
 * The Create Redirect Session body for a plan: `paidPlansCheckout: { planId }` plus the callbacks.
 * postFlowUrl defaults to the current page (browser); a server caller passes it explicitly.
 * The return origin must be the site's real https origin as registered on the OAuth app's allowed
 * domains — an unlisted or http origin 403s on return.
 */
export function purchaseBody(planId, { thankYouPageUrl, postFlowUrl } = {}) {
    if (!planId)
        throw new Error("A plan id is required to start checkout.");
    const href = typeof window !== "undefined" ? window.location.href : "";
    return {
        paidPlansCheckout: { planId },
        callbacks: {
            postFlowUrl: postFlowUrl ?? (href || undefined),
            ...(thankYouPageUrl ? { thankYouPageUrl } : {}),
        },
    };
}
/** The hosted checkout URL out of a redirect-session response; throws when there is none. */
export function redirectUrl(session) {
    const url = session?.redirectSession?.fullUrl;
    if (!url)
        throw new Error("Checkout couldn't start — please try again.");
    return url;
}
