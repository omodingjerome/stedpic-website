// Blog DTOs — the serializable shapes every hook, component, and page consumes.
// Plain JSON: safe as Astro island props or across server/client boundaries. Cover images are
// resolved https URLs; dates are pre-formatted display strings plus an ISO value for <time>.
// A field that is "" or undefined means "not known" — render nothing for it, never a placeholder.
export {};
