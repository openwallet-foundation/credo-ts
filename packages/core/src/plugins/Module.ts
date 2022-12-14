import type { FeatureRegistry } from '../agent/FeatureRegistry'
import type { Constructor } from '../utils/mixins'
import type { DependencyManager } from './DependencyManager'

export interface Module {
  api?: Constructor<unknown>
  register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry): void
}

export interface ApiModule extends Module {
  api: Constructor<unknown>
}
