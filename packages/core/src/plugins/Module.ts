import type { DependencyManager } from './DependencyManager'

export interface Module {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new (...args: any[]): any
  register(dependencyManager: DependencyManager): void
}

/**
 * Decorator that marks the class as a module. Will enforce the required interface for a module (with static methods)
 * on the class declaration.
 */
export function module() {
  return <U extends Module>(constructor: U) => constructor
}
