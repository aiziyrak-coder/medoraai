/**
 * Read an object as a string-keyed bag of `unknown` values.
 *
 * Every JS object *is* such a bag at runtime, but TypeScript grants an implicit
 * index signature only to type *aliases*, never to `interface` declarations - so
 * `someInterface as Record<string, unknown>` is reported as a possible mistake
 * even though the widening is always sound.
 *
 * This helper localises that one unavoidable widening rather than scattering
 * `as unknown as Record<string, unknown>` through the codebase. It only ever
 * *widens*: the result is `unknown`-valued, so every field still has to be
 * narrowed (typeof / Array.isArray / ...) before use. Nothing is hidden.
 *
 * Do NOT use it to go the other way (Record -> some interface): that direction
 * needs a real runtime check, not a cast.
 */
export function asRecord<T extends object>(value: T): Record<string, unknown> {
  return value as unknown as Record<string, unknown>;
}
