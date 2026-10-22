// Forms DTOs — the serializable shapes every hook and page consumes. A form is schema-driven
// (the owner picks the fields in their dashboard), so a FormDto is a LIST of fields rather
// than a fixed interface: render by mapping `form.fields`, never by naming fields in code.
//
// Why a DTO at all, when the schema IS the model: the raw `Form` nests a field's settings two
// levels deep under blocks named after its own enums
// (`inputOptions.stringOptions.dropdownOptions.label`), carries Date objects and Ricos
// rich-content labels that are not island-serializable, and spreads display ORDER across
// `steps[].layout` rather than `formFields[]`. FormFieldDto is that resolved once, in the data
// layer, into flat keys — the same rule every other vertical here follows.
//
// It is a FLATTENING, not a subset: every setting a renderer needs is carried through. When a
// field kind needs something not listed here, add the key — never reach past the DTO into the
// raw form.
export {};
