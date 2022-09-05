import type { FeatureQueryOptions } from './models'
import type { DiscoverFeaturesService } from './services'

/**
 * Get the supported protocol versions based on the provided credential services.
 */
export type ProtocolVersionType<DFSs extends DiscoverFeaturesService[]> = DFSs[number]['version']

/**
 * Get the service map for usage in the credentials module. Will return a type mapping of protocol version to service.
 *
 * @example
 * ```
 * type DiscoverFeaturesServiceMap = ServiceMap<[V1DiscoverFeaturesService,V2DiscoverFeaturesService]>
 *
 * // equal to
 * type CredentialServiceMap = {
 *   v1: V1DiscoverFeatureService
 *   v2: V2DiscoverFeaturesService
 * }
 * ```
 */
export type ServiceMap<DFSs extends DiscoverFeaturesService[]> = {
  [DFS in DFSs[number] as DFS['version']]: DiscoverFeaturesService
}

interface BaseOptions {
  connectionId: string
}

export interface QueryFeaturesOptions<DFSs extends DiscoverFeaturesService[] = DiscoverFeaturesService[]>
  extends BaseOptions {
  protocolVersion: ProtocolVersionType<DFSs>
  queries: FeatureQueryOptions[]
  comment?: string
}

export interface DiscloseFeaturesOptions<DFSs extends DiscoverFeaturesService[] = DiscoverFeaturesService[]>
  extends BaseOptions {
  protocolVersion: ProtocolVersionType<DFSs>
  queries: FeatureQueryOptions[]
  threadId?: string
}
