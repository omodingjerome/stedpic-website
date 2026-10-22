/** A verb's role as the API spells it; ADMIN (the most restrictive reading) when absent. */
const role = (r) => (typeof r === "string" && r ? r : "ADMIN");
/** One raw field → DTO. The reference target sits under typeMetadata.reference | .multiReference. */
export function toFieldSchema(f) {
    const ref = f.typeMetadata?.reference?.referencedCollectionId ?? f.typeMetadata?.multiReference?.referencedCollectionId;
    return {
        key: f.key ?? "",
        displayName: f.displayName ?? f.key ?? "",
        type: f.type ?? "TEXT",
        systemField: f.systemField === true,
        required: f.required === true,
        ...(ref ? { referencedCollectionId: ref } : {}),
    };
}
/** A raw DataCollection → the schema DTO (id, display name, fields, the four verbs' roles). */
export function toCollectionSchema(raw) {
    const id = raw._id ?? raw.id ?? "";
    const p = raw.permissions ?? {};
    return {
        id,
        displayName: raw.displayName ?? id,
        fields: (raw.fields ?? []).map(toFieldSchema),
        permissions: { read: role(p.read), insert: role(p.insert), update: role(p.update), remove: role(p.remove) },
    };
}
/** The fields of one type — e.g. every MULTI_REFERENCE to link after an insert, every IMAGE to guard. */
export function fieldsOfType(schema, type) {
    return schema.fields.filter((f) => f.type === type);
}
