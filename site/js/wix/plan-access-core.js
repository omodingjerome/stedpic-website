/** The one order status that grants access: purchased, started, not paused/ended/canceled. */
export const ACCESS_ORDER_STATUSES = ["ACTIVE"];
/** The filter for "the current member's ACTIVE orders for these plans"; throws on an empty plan list. */
export function memberOrdersQuery(requiredPlanIds) {
    if (!requiredPlanIds.length)
        throw new Error("At least one required plan id is needed to check access.");
    return { planIds: requiredPlanIds, orderStatuses: ACCESS_ORDER_STATUSES };
}
/**
 * Access = the member has at least one order with status ACTIVE whose planId is one of the required
 * plans. Re-checked here even though the query already filtered (a caller may pass orders it read
 * for another reason). Visitors never reach this: they have no orders to list.
 */
export function hasPlanAccess(orders, requiredPlanIds) {
    return (orders ?? []).some((o) => o?.status === "ACTIVE" && requiredPlanIds.includes(o?.planId));
}
