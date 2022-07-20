import type { Constructor } from '../utils/mixins'
import type { DependencyManager } from './DependencyManager'

export interface Module {
  api?: Constructor<unknown>
  register(dependencyManager: DependencyManager): void
}

/**
 * Decorator that marks the class as a module. Will enforce the required interface for a module (with static methods)
 * on the class declaration.
 */
export function module() {
  return <U extends Module | Constructor<Module>>(constructor: U) => constructor
}
