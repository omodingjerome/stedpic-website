// CMS DTOs — the serializable shapes every hook, component, and page consumes. CMS is
// schema-generic: field keys come from the seed plan (seed/SEED.md), so an item is a flat
// field map rather than a fixed interface. Plain JSON: safe as Astro island props or across
// server/client boundaries. By the time an item leaves the data layer, Date fields are ISO
// strings and IMAGE fields are resolved https URLs.
export {};
