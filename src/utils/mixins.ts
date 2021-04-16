/* eslint-disable @typescript-eslint/no-explicit-any */
// Utils for Mixins in TypeScript
// @see https://www.typescriptlang.org/docs/handbook/mixins.html

// eslint-disable-next-line @typescript-eslint/ban-types
export type Constructor<T = {}> = new (...args: any[]) => T

// Turns A | B | C into A & B & C
export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never

// Merges constructor types. T[number] allows the type to be merged for each item in the array */
export type MergeConstructorTypes<T extends Mixin[]> = UnionToIntersection<InstanceType<ReturnType<T[number]>>>

// Take class as parameter, return class
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
  return extensions.reduce((extended, extend) => extend(extended), Base) as any
}
