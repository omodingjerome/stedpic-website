export const rawId = (raw) => raw?._id ?? raw?.id ?? "";
// Copies of services-core's ids (same values) so this file stands alone when stripped.
/** The Wix Bookings app id — the cart line's catalogReference.appId and the events filter. */
export const BOOKINGS_APP_ID = "13d21c63-b5ec-5912-8397-c3a5ddb27a97";
/** Staff-member resource type id (ANY_RESOURCE fallback + staff filtering). */
export const STAFF_RESOURCE_TYPE_ID = "1cd44cf8-756f-41c3-bd90-3e2ffcaf1155";
/** One availability page: Wix's headless package pages 1000 and follows the cursor; 100 truncates a busy week. */
export const SLOTS_PAGE_LIMIT = 1000;
/** Next-availability defaults: 3 upcoming times, clamped to 1..6, scanned to the end of the month 6 months out. */
export const NEXT_AVAILABLE_DEFAULT = 3;
export const NEXT_AVAILABLE_MAX = 6;
export const NEXT_AVAILABLE_MONTHS = 6;
/** Sessions list page size (Wix's viewer shows 7 upcoming sessions per page). */
export const SESSIONS_PAGE_SIZE = 7;
const WEEKDAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const pad = (n) => String(n).padStart(2, "0");
/** Local wall-clock "YYYY-MM-DDThh:mm:ss" (NO Z) — the format the availability and calendar APIs require. */
export function toLocalDateString(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
/** Midnight at the start of the given day (local). */
export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes(), d.getSeconds());
/** The visitor's IANA time zone — used only when the site shows times in the CUSTOMER's zone. */
export const defaultTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
/**
 * The display-zone POLICY → the `timeZone` the availability and calendar requests send: the
 * visitor's zone under CUSTOMER_TIME_ZONE; `undefined` (omit the param) under the Wix default,
 * BUSINESS_TIME_ZONE — the server then computes in the business zone and echoes it back.
 */
export function resolveDisplayTimeZone(settings) {
    return settings.displayTimeZone === "CUSTOMER" ? defaultTimeZone() : undefined;
}
/** "Eastern Time (EDT)" for a zone at a date (the abbreviation is date-dependent); "" when it can't be formatted. */
export function timeZoneLabel(timeZone, referenceDate = new Date(), locale) {
    if (!timeZone)
        return "";
    try {
        const part = (style) => new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: style }).formatToParts(referenceDate).find((p) => p.type === "timeZoneName")?.value ?? "";
        const generic = part("longGeneric");
        const abbr = part("short");
        if (!generic)
            return abbr;
        if (!abbr || abbr === generic)
            return generic;
        return `${generic} (${abbr})`;
    }
    catch {
        return "";
    }
}
/** [start of `from`'s day, start of the day `days` later) as the local strings both time-slot APIs take. */
export function slotsRange({ from = new Date(), days = 7 }) {
    const start = startOfDay(from);
    return { fromLocalDate: toLocalDateString(start), toLocalDate: toLocalDateString(addDays(start, days)) };
}
/**
 * The List Availability Time Slots body for an APPOINTMENT service: bookable slots only, the staff
 * resources included on each slot, optionally narrowed to one staff member, one 1000-slot page at a
 * time (the transport follows `cursorPagingMetadata.cursors.next`). No `timeZone` key when none is
 * resolved — the server computes in the business zone and echoes it.
 */
export function appointmentSlotsRequest(serviceId, { timeZone, staffId, cursor, ...window }) {
    return {
        serviceId,
        ...slotsRange(window),
        ...(timeZone ? { timeZone } : {}),
        bookable: true,
        cursorPaging: cursor ? { limit: SLOTS_PAGE_LIMIT, cursor } : { limit: SLOTS_PAGE_LIMIT },
        includeResourceTypeIds: [STAFF_RESOURCE_TYPE_ID],
        ...(staffId ? { resourceTypes: [{ resourceTypeId: STAFF_RESOURCE_TYPE_ID, resourceIds: [staffId] }] } : {}),
    };
}
/**
 * The List Event Time Slots body for a CLASS service: its sessions INCLUDING full ones (they render
 * disabled as "Full" instead of vanishing), optionally one staff member's, paged like appointments
 * (the cursor rides `pagingMetadata.cursors.next` on this API).
 */
export function classSlotsRequest(serviceId, { timeZone, staffId, cursor, ...window }) {
    return {
        serviceIds: [serviceId],
        ...slotsRange(window),
        ...(timeZone ? { timeZone } : {}),
        includeNonBookable: true,
        cursorPaging: cursor ? { limit: SLOTS_PAGE_LIMIT, cursor } : { limit: SLOTS_PAGE_LIMIT },
        ...(staffId ? { eventFilter: { "resources.id": { $hasSome: [staffId] } } } : {}),
    };
}
/** The next page's cursor out of either time-slots response (they name the metadata differently); null at the end. */
export const nextSlotsCursor = (res) => res?.cursorPagingMetadata?.cursors?.next ?? res?.pagingMetadata?.cursors?.next ?? null;
/** Start of today → end of the last day of the month NEXT_AVAILABLE_MONTHS ahead (Wix's scan window). */
export function nextAvailableRange(now = new Date()) {
    const lastDay = new Date(now.getFullYear(), now.getMonth() + NEXT_AVAILABLE_MONTHS + 1, 0, 23, 59, 59);
    return { fromLocalDate: toLocalDateString(startOfDay(now)), toLocalDate: toLocalDateString(lastDay) };
}
export const clampNextAvailable = (n) => Math.min(Math.max(n ?? NEXT_AVAILABLE_DEFAULT, 1), NEXT_AVAILABLE_MAX);
/** The next-availability body: the same two APIs, bookable slots only, the first `limit` of them. */
export function nextAvailableRequest(service, { limit, staffId, timeZone } = {}) {
    const cursorPaging = { limit: clampNextAvailable(limit) };
    if (service.type === "CLASS") {
        return {
            serviceIds: [service.id],
            ...nextAvailableRange(),
            ...(timeZone ? { timeZone } : {}),
            includeNonBookable: false,
            cursorPaging,
            ...(staffId ? { eventFilter: { "resources.id": { $hasSome: [staffId] } } } : {}),
        };
    }
    return {
        serviceId: service.id,
        ...nextAvailableRange(),
        ...(timeZone ? { timeZone } : {}),
        bookable: true,
        cursorPaging,
        includeResourceTypeIds: [STAFF_RESOURCE_TYPE_ID],
        ...(staffId ? { resourceTypes: [{ resourceTypeId: STAFF_RESOURCE_TYPE_ID, resourceIds: [staffId] }] } : {}),
    };
}
/** Next-availability is shown only where a plain time is the whole choice: not VARIED pricing, add-ons, or a course. */
export const showsNextAvailability = (service) => service.type !== "COURSE" && service.rateType !== "VARIED" && !service.hasAddOns;
/** A slot's identity: start|end|location. The same time at two locations is two slots; two staff at one time is one. */
export const slotKey = (raw) => `${raw.localStartDate ?? ""}|${raw.localEndDate ?? ""}|${rawId(raw.location)}`;
/** Multi-staff appointments return one slot per staff member for the same time — merged into one, staff concatenated. */
export function dedupeSlots(raws) {
    const byKey = new Map();
    for (const raw of raws) {
        const key = slotKey(raw);
        const seen = byKey.get(key);
        if (!seen)
            byKey.set(key, raw);
        else if (raw.availableResources?.length)
            byKey.set(key, { ...seen, availableResources: [...(seen.availableResources ?? []), ...raw.availableResources] });
    }
    return [...byKey.values()];
}
const timeLabel = (local, locale) => {
    try {
        return new Date(local).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
    }
    catch {
        return local.slice(11, 16);
    }
};
const toSlotLocation = (raw) => {
    if (!raw || (!rawId(raw) && !raw.name))
        return null;
    const type = (["BUSINESS", "CUSTOM", "CUSTOMER"].includes(raw.locationType) ? raw.locationType : "BUSINESS");
    return { id: rawId(raw) || null, name: raw.name ?? "", type };
};
export function toSlot(raw) {
    const start = raw.localStartDate ?? "";
    const staff = (raw.availableResources ?? [])
        .flatMap((ar) => (ar.resources ?? []))
        .map((r) => ({ id: rawId(r), name: r.name ?? "" }))
        .filter((r) => r.id);
    return {
        key: slotKey(raw),
        startLocal: start,
        endLocal: raw.localEndDate ?? "",
        dayKey: start.slice(0, 10),
        label: timeLabel(start),
        bookable: raw.bookable !== false,
        totalCapacity: raw.totalCapacity ?? null,
        remainingCapacity: raw.remainingCapacity ?? null,
        waitlistCapacity: raw.eventInfo?.waitingList?.remainingCapacity ?? null,
        scheduleId: raw.scheduleId ?? null,
        eventId: raw.eventInfo?.eventId ?? null,
        eventTitle: raw.eventInfo?.eventTitle ?? "",
        location: toSlotLocation(raw.location),
        staff,
    };
}
/** Raw slots from one or more pages → a deduped, ordered SlotsPage with the response's zone. */
export function toSlotsPage(raws, timeZone) {
    const slots = dedupeSlots(raws).map(toSlot).sort((a, b) => a.startLocal.localeCompare(b.startLocal));
    return { slots, timeZone: timeZone ?? null };
}
export const dayLabel = (dayKey, locale) => {
    try {
        return new Date(`${dayKey}T12:00:00`).toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" });
    }
    catch {
        return dayKey;
    }
};
/** Slots grouped by day, days in order — what a slot picker renders. */
export function groupSlotsByDay(slots) {
    const byDay = new Map();
    for (const s of slots)
        byDay.set(s.dayKey, [...(byDay.get(s.dayKey) ?? []), s]);
    return [...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dayKey, daySlots]) => ({ dayKey, dayLabel: dayLabel(dayKey), slots: daySlots }));
}
/**
 * How many participants one booking may hold: the participants policy's cap, else the service's
 * capacity (1 for appointments), never more than the seats left on the chosen slot, never below 1.
 */
export function maxParticipants(service, slot) {
    const policy = service.maxParticipantsPerBooking ?? service.defaultCapacity ?? 1;
    const seats = slot?.remainingCapacity ?? Infinity;
    const cap = service.type === "APPOINTMENT" ? 1 : Math.min(policy, seats);
    return Math.max(1, Number.isFinite(cap) ? cap : 1);
}
// ---- calendar events: sessions, offered days, course seats ---------------------------------------------
/**
 * The Query Events body for a schedule's upcoming sessions (INSTANCE events from the start of today,
 * open-ended, oldest first), cursor-paged. Later pages send the cursor. No `timeZone` key when none
 * is resolved — the server uses the business zone and echoes it on each event.
 */
export function sessionsRequest(scheduleId, { limit = SESSIONS_PAGE_SIZE, cursor, timeZone } = {}) {
    return {
        query: { filter: { scheduleId }, cursorPaging: cursor ? { limit, cursor } : { limit } },
        fromLocalDate: toLocalDateString(startOfDay(new Date())),
        ...(timeZone ? { timeZone } : {}),
    };
}
/**
 * The Query Events body for the recurring (MASTER) events of several schedules at once — one batched
 * call per listing page; a MASTER event carries the weekly `recurrenceRule.days` and, for a course,
 * the whole course's `totalCapacity` / `remainingCapacity`.
 */
export function masterEventsRequest(scheduleIds, timeZone) {
    return {
        query: { filter: { appId: BOOKINGS_APP_ID, scheduleId: { $in: scheduleIds } }, cursorPaging: { limit: 500 } },
        recurrenceType: ["MASTER"],
        fromLocalDate: toLocalDateString(startOfDay(new Date())),
        ...(timeZone ? { timeZone } : {}),
    };
}
export const nextEventsCursor = (res) => res?.pagingMetadata?.cursors?.next ?? null;
const diffMinutes = (start, end) => {
    const a = new Date(start).getTime();
    const b = new Date(end).getTime();
    return Number.isNaN(a) || Number.isNaN(b) ? 0 : Math.round((b - a) / 60_000);
};
/** A calendar event → a Session; staff are its resources of the staff type. */
export function toSession(raw) {
    const start = raw.start?.localDate ?? "";
    const end = raw.end?.localDate ?? "";
    const remaining = raw.remainingCapacity ?? null;
    return {
        id: rawId(raw),
        title: raw.title ?? raw.scheduleName ?? "",
        startLocal: start,
        endLocal: end,
        dayKey: start.slice(0, 10),
        dayLabel: dayLabel(start.slice(0, 10)),
        label: timeLabel(start),
        durationMinutes: diffMinutes(start, end),
        staff: (raw.resources ?? [])
            .filter((r) => r.type === STAFF_RESOURCE_TYPE_ID && rawId(r))
            .map((r) => ({ id: rawId(r), name: r.name ?? "" })),
        totalCapacity: raw.totalCapacity ?? null,
        spotsLeft: remaining,
        isFullyBooked: remaining != null && remaining <= 0,
        isCancelled: raw.status === "CANCELLED",
    };
}
/** MASTER events → the weekdays each schedule meets on, in week order, without duplicates. */
export function offeredDaysByScheduleId(events) {
    const out = {};
    for (const e of events) {
        if (!e.scheduleId)
            continue;
        const set = (out[e.scheduleId] ??= new Set());
        for (const d of (e.recurrenceRule?.days ?? []))
            if (WEEKDAYS.includes(d))
                set.add(d);
    }
    return Object.fromEntries(Object.entries(out).map(([id, set]) => [id, WEEKDAYS.filter((d) => set.has(d))]));
}
/** Course seats from its first MASTER event; null once the course ended or when it has no recurring session yet. */
export function courseAvailabilityOf(events, ended) {
    const first = events[0];
    if (ended || !first)
        return null;
    const spotsLeft = first.remainingCapacity ?? null;
    return { totalCapacity: first.totalCapacity ?? null, spotsLeft, full: spotsLeft != null && spotsLeft <= 0 };
}
// ---- add-ons -------------------------------------------------------------------------------------------
/** The List Add-On Groups By Service Id body. */
export const addOnGroupsRequest = (serviceId) => ({ serviceId });
const money = (m) => {
    const value = m?.value;
    const currency = m?.currency;
    if (value == null || value === "" || !currency)
        return "";
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount === 0)
        return "";
    const digits = amount % 1 === 0 ? 0 : 2;
    try {
        return new Intl.NumberFormat(undefined, { style: "currency", currency, currencyDisplay: "symbol", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount);
    }
    catch {
        return `${amount} ${currency}`;
    }
};
/** The response's add-on groups → DTOs; translated names win over the originals (Wix's rule). */
export function toAddOnGroups(res) {
    return (res?.addOnGroupsDetails ?? []).map((g) => ({
        id: g.groupId ?? "",
        name: g.groupNameTranslated ?? g.groupName ?? "",
        prompt: g.promptTranslated ?? g.prompt ?? "",
        maxSelectable: g.maxNumberOfAddOns ?? null,
        addOns: (g.addOns ?? [])
            .map((a) => ({
            id: a.addOnId ?? "",
            name: a.nameTranslated ?? a.name ?? "",
            price: money(a.price),
            priceAmount: Number(a.price?.value ?? 0) || 0,
            currency: a.price?.currency ?? "",
            durationMinutes: a.durationInMinutes ?? null,
            maxQuantity: a.maxQuantity ?? null,
        }))
            .filter((a) => a.id),
    }));
}
/** A group accepts another distinct add-on while under its `maxSelectable`. */
export function canSelectMore(group, selection) {
    if (group.maxSelectable == null)
        return true;
    return group.addOns.filter((a) => (selection[a.id] ?? 0) > 0).length < group.maxSelectable;
}
/** A selection with `id` set to `quantity` (clamped to the add-on's max, removed at 0); refuses a new pick when the group is full. */
export function withAddOnQuantity(groups, selection, id, quantity) {
    const group = groups.find((g) => g.addOns.some((a) => a.id === id));
    const addOn = group?.addOns.find((a) => a.id === id);
    if (!group || !addOn)
        return selection;
    const q = Math.max(0, Math.min(Math.floor(quantity), addOn.maxQuantity ?? 1));
    const next = { ...selection };
    if (q === 0) {
        delete next[id];
        return next;
    }
    if (!(selection[id] > 0) && !canSelectMore(group, selection))
        return selection;
    next[id] = q;
    return next;
}
/** Price × quantity over the selection, formatted ("" when nothing priced is selected or currencies are missing). */
export function addOnsTotal(groups, selection) {
    let total = 0;
    let currency = "";
    for (const g of groups)
        for (const a of g.addOns) {
            const q = selection[a.id] ?? 0;
            if (q > 0 && a.priceAmount > 0) {
                total += a.priceAmount * q;
                currency ||= a.currency;
            }
        }
    return total > 0 ? money({ value: String(total), currency }) : "";
}
/** Extra minutes the selection adds to the session. */
export function addOnsDuration(groups, selection) {
    let minutes = 0;
    for (const g of groups)
        for (const a of g.addOns)
            minutes += (a.durationMinutes ?? 0) * (selection[a.id] ?? 0);
    return minutes;
}
// ---- the booking form -------------------------------------------------------------------------------
export const FALLBACK_FIELDS = [
    { target: "first_name", label: "First Name", type: "STRING", required: true },
    { target: "last_name", label: "Last Name", type: "STRING", required: true },
    { target: "email", label: "Email", type: "EMAIL", required: true },
];
const FIELD_TYPES = ["STRING", "EMAIL", "PHONE", "NUMBER", "URL"];
/**
 * Flat, render-ready fields from a form summary — deleted fields and non-text types dropped, values
 * keyed by `target`. `required` comes from the full form schema (`fields[].validation.required`,
 * keyed by target); the summary doesn't carry it. Without the schema every field counts as required.
 * ALWAYS non-empty: contact basics when the schema is missing or unusable.
 */
export function toFormFields(summary, form) {
    const requiredByTarget = new Map((form?.fields ?? []).filter((f) => f.target).map((f) => [f.target, f.validation?.required === true]));
    const fields = (summary?.fields ?? [])
        .filter((f) => !f.deleted)
        .filter((f) => f.type && FIELD_TYPES.includes(f.type))
        .map((f) => ({
        target: f.target ?? "",
        label: f.label ?? f.target ?? "",
        type: f.type,
        ...(Array.isArray(f.options) && f.options.length ? { options: f.options } : {}),
        required: requiredByTarget.get(f.target ?? "") ?? true,
    }))
        .filter((f) => f.target);
    return fields.length ? fields : FALLBACK_FIELDS;
}
/** A slot's location type → the booking's: BUSINESS → OWNER_BUSINESS, CUSTOMER → CUSTOM, CUSTOM → OWNER_CUSTOM. */
export function bookingLocationType(type) {
    if (type === "CUSTOMER")
        return "CUSTOM";
    if (type === "CUSTOM")
        return "OWNER_CUSTOM";
    return "OWNER_BUSINESS";
}
/**
 * The Create Booking `booking` object. APPOINTMENT: the SLOT's scheduleId (never service.schedule.id)
 * plus start/end as local wall-clock with the time zone; CLASS: the eventId; COURSE: no slot at all —
 * `bookedEntity.schedule` with the service's schedule id enrols the visitor in every session. A chosen
 * staff member is the slot's `resource`; otherwise ANY_RESOURCE of the staff type. The location is the
 * SLOT's (id + name, type mapped) so a multi-location business books the right place; only a slot
 * without one falls back to the bare OWNER_BUSINESS type. `depositSelected` rides only when paying
 * ONLINE for a service that takes a deposit AND lets the visitor choose (otherwise the server default
 * applies). `idKey` spells ids the way the transport wants them: `_id` on the SDK, `id` on REST.
 */
export function bookingRequest(service, slot, { staffId, timeZone = defaultTimeZone(), idKey = "id", participants = 1, depositSelected } = {}) {
    const deposit = depositSelected !== undefined && service.paymentOption === "ONLINE" && service.deposit && service.deposit.fullUpfrontAllowed
        ? { depositSelected }
        : {};
    const base = { selectedPaymentOption: service.paymentOption, ...deposit, totalParticipants: Math.max(1, Math.floor(participants)) };
    if (service.type === "COURSE" || !slot) {
        if (!service.scheduleId)
            throw new Error("This course has no schedule to book.");
        return { ...base, bookedEntity: { schedule: { scheduleId: service.scheduleId, serviceId: service.id, timezone: timeZone } } };
    }
    const staff = staffId ? slot.staff.find((s) => s.id === staffId) : undefined;
    return {
        ...base,
        bookedEntity: {
            slot: {
                serviceId: service.id,
                scheduleId: slot.scheduleId ?? undefined,
                eventId: slot.eventId ?? undefined,
                startDate: slot.startLocal,
                endDate: slot.endLocal,
                timezone: timeZone,
                ...(staff
                    ? { resource: { [idKey]: staff.id, name: staff.name } }
                    : { resourceSelections: [{ resourceTypeId: STAFF_RESOURCE_TYPE_ID, selectionMethod: "ANY_RESOURCE" }] }),
                location: slot.location
                    ? { ...(slot.location.id ? { [idKey]: slot.location.id } : {}), name: slot.location.name, locationType: bookingLocationType(slot.location.type) }
                    : { locationType: "OWNER_BUSINESS" },
            },
        },
    };
}
/**
 * The rest of the Create Booking request — the SDK's second argument, REST's top-level siblings of
 * `booking`: the visitor's form values as the formSubmission DIRECTLY, and the notifications Wix's
 * own flow sends (confirmation by email and SMS, an SMS reminder) — without them the "confirmation
 * email is on its way" copy would be false.
 */
export function bookingOptions(formValues) {
    return {
        participantNotification: { notifyParticipants: true, metadata: { channels: "EMAIL,SMS" } },
        sendSmsReminder: true,
        formSubmission: formValues,
    };
}
/** The booking id out of a Create Booking response (wrapped { booking } on both transports). */
export const bookingIdOf = (res) => rawId(res?.booking);
/** The contact the server resolved from the form, echoed on the created booking. */
export const contactOf = (res) => res?.booking?.contactDetails ?? undefined;
/**
 * The Create Cart body that holds the booked seat(s): one line per BOOKING id (catalogItemId is the
 * booking id, never the service id), the site channel, the booking's business location, and the
 * contact the booking already resolved — so the hosted checkout doesn't ask for name and email again.
 */
export function bookingCartRequest(bookingIds, contact, locationId) {
    const cart = { source: { channelType: "WEB" } };
    if (locationId)
        cart.businessInfo = { locationId };
    if (contact) {
        cart.customerInfo = {
            ...(contact.firstName ? { firstName: contact.firstName } : {}),
            ...(contact.lastName ? { lastName: contact.lastName } : {}),
            ...(contact.phone ? { phone: contact.phone } : {}),
            ...(contact.email ? { email: contact.email } : {}),
        };
        if (contact.fullAddress?.country) {
            cart.deliveryInfo = { address: { ...contact.fullAddress } };
            cart.paymentInfo = { billingAddress: { ...contact.fullAddress } };
        }
    }
    return {
        catalogItems: bookingIds.map((id) => ({ quantity: 1, catalogReference: { catalogItemId: id, appId: BOOKINGS_APP_ID } })),
        cart,
    };
}
/** The cart id out of a Create Cart response — the SDK may unwrap the cart, REST wraps it. */
export const cartIdOf = (res) => rawId(res) || rawId(res?.cart);
/** The cart's total from a Calculate Cart response (`summary.priceSummary.total`); 0 when absent. */
export const cartTotal = (calc) => Number(calc?.summary?.priceSummary?.total?.amount ?? 0);
/**
 * Hosted checkout is required whenever a card must be involved: always when the service carries a
 * cancellation fee (a card goes on file); never when the calculated total is 0; never when the
 * CART LINE says the whole payment happens offline (`paymentConfig.paymentOption ===
 * "FULL_PAYMENT_OFFLINE"` — the server's resolution of the service's options, memberships included);
 * otherwise yes. Free and pay-in-person bookings therefore place the order directly.
 */
export function checkoutRequired(service, calc) {
    if (service.cancellationFeeEnabled)
        return true;
    if (cartTotal(calc) === 0)
        return false;
    return calc?.cart?.lineItems?.[0]?.paymentConfig?.paymentOption !== "FULL_PAYMENT_OFFLINE";
}
/** The Create Redirect Session body for a cart's checkout; the cart id IS the checkout id. */
export function checkoutRedirectRequest(cartId, origin) {
    return { ecomCheckout: { checkoutId: cartId }, callbacks: origin ? { postFlowUrl: `${origin}/` } : {} };
}
/** A placed order → the confirmed result; the order id is wherever the transport put it. */
export function confirmedResult(bookingId, order) {
    return { kind: "confirmed", bookingId, orderId: order?.orderId ?? (rawId(order?.order) || null) };
}
