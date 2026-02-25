// Utils for Mixins in TypeScript
// @see https://www.typescriptlang.org/docs/handbook/mixins.html

// biome-ignore lint/suspicious/noExplicitAny: no explanation
// biome-ignore lint/complexity/noBannedTypes: no explanation
export type Constructor<T = {}> = new (...args: any[]) => T

export type NonConstructable<T> = Omit<T, 'new'>
// biome-ignore lint/suspicious/noExplicitAny: no explanation
export type Constructable<T, ConstructorParams extends any[] = any[]> = T & (new (...args: ConstructorParams) => T)

// Turns A | B | C into A & B & C
// biome-ignore lint/suspicious/noExplicitAny: no explanation
export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never

// Merges constructor types. T[number] allows the type to be merged for each item in the array */
export type MergeConstructorTypes<T extends Mixin[]> = UnionToIntersection<InstanceType<ReturnType<T[number]>>>

// Take class as parameter, return class
// biome-ignore lint/suspicious/noExplicitAny: no explanation
type Mixin = (Base: Constructor<any>) => Constructor<any>

/**
 * Apply a list of mixins functions to a base class. Applies extensions in order
 *
 * @param Base Base class
 * @param extensions List of mixin functions that will extend the base class.
 *
 * @example
 * Compose(BaseClass, [TransportDecorated, SignatureDecorated])
 */
export function Compose<B, T extends Mixin[]>(
  Base: Constructor<B>,
  extensions: T
): Constructor<MergeConstructorTypes<T>> & B {
  // It errors without casting to any, but function + typings works
  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  return extensions.reduce((extended, extend) => extend(extended), Base) as any
}
