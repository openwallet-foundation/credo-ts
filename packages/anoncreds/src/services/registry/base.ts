export type Extensible = Record<string, unknown>

export interface AnonCredsOperationStateWait {
  state: 'wait'
}

export interface AnonCredsOperationStateAction {
  state: 'action'
  action: string
}

export interface AnonCredsOperationStateFinished {
  state: 'finished'
}

export interface AnonCredsOperationStateFailed {
  state: 'failed'
  reason: string
}

export interface AnonCredsResolutionMetadata extends Extensible {
  error?: 'invalid' | 'notFound' | 'unsupportedAnonCredsMethod' | string
  message?: string

  /**
   * Whether the anoncreds object was served from the cache
   */
  servedFromCache?: boolean

  /**
   * Whether the anoncreds object was served from a local record
   */
  servedFromRecord?: boolean
}

export interface AnonCredsResolutionOptions {
  /**
   * Whether to resolve the anoncreds object from the cache.
   *
   * @default true
   */
  useCache?: boolean

  /**
   * Whether to resolve the anoncreds object from a local created anoncreds object in a record.
   * Cache has precedence over local records, as they're often faster. Objects
   * served from  will not be added to the cache.
   *
   * The resolver must have enabled `allowsLocalRecord` (default false) to use this
   * feature.
   *
   * @default true
   */
  useLocalRecord?: boolean

  /**
   * Whether to persist the anoncreds object in the cache.
   *
   * @default true
   */
  persistInCache?: boolean

  /**
   * How many seconds to persist the resolved object.
   *
   * This may be overwritten with a shorter time based on the specific anoncreds object
   * e.g. a status list that decides it should only be cached for up to 1 minute
   *
   * @default 300
   */
  cacheDurationInSeconds?: number
}
