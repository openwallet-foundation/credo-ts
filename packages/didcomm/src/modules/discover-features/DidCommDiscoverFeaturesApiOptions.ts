import type { DidCommFeatureQueryOptions } from '../../models'
import type { DidCommDiscoverFeaturesService } from './services'

/**
 * Get the supported protocol versions based on the provided discover features services.
 */
export type DiscoverFeaturesProtocolVersionType<DFSs extends DidCommDiscoverFeaturesService[]> = DFSs[number]['version']

/**
 * Get the service map for usage in the discover features module. Will return a type mapping of protocol version to service.
 *
 * @example
 * ```
 * type ServiceMap = DiscoverFeaturesServiceMap<[V1DiscoverFeaturesService,V2DiscoverFeaturesService]>
 *
 * // equal to
 * type ServiceMap = {
 *   v1: V1DiscoverFeatureService
 *   v2: V2DiscoverFeaturesService
 * }
 * ```
 */
export type DiscoverFeaturesServiceMap<DFSs extends DidCommDiscoverFeaturesService[]> = {
  [DFS in DFSs[number] as DFS['version']]: DidCommDiscoverFeaturesService
}

interface BaseOptions {
  connectionId: string
}

export interface QueryFeaturesOptions<DFSs extends DidCommDiscoverFeaturesService[] = DidCommDiscoverFeaturesService[]>
  extends BaseOptions {
  protocolVersion: DiscoverFeaturesProtocolVersionType<DFSs>
  queries: DidCommFeatureQueryOptions[]
  awaitDisclosures?: boolean
  awaitDisclosuresTimeoutMs?: number
  comment?: string
}

export interface DiscloseFeaturesOptions<DFSs extends DidCommDiscoverFeaturesService[] = DidCommDiscoverFeaturesService[]>
  extends BaseOptions {
  protocolVersion: DiscoverFeaturesProtocolVersionType<DFSs>
  disclosureQueries: DidCommFeatureQueryOptions[]
  threadId?: string
}
