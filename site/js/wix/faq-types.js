// FAQ DTOs — the serializable shapes every hook, component, and page consumes. Plain JSON: safe as
// Astro island props or across server/client boundaries. Answers arrive as HTML the core produced
// from the API's rich content (sanitized: text escaped, only http(s) links, no scripts or styles),
// plus a plain-text twin for search, snippets, and structured data. No dates: the API's
// _createdDate/_updatedDate are not visitor-facing and are dropped in the data layer.
export {};
