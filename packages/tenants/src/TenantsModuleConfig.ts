export interface TenantRecordCacheOptions {
  /** How long the cached properties of a tenant record are used. */
  expiryInSeconds: number
}

/**
 * TenantsModuleConfigOptions defines the interface for the options of the TenantsModuleConfig class.
 * This can contain optional parameters that have default values in the config class itself.
 */
export interface TenantsModuleConfigOptions {
  /**
   * Maximum number of concurrent tenant sessions that can be active at the same time. Defaults to
   * 100 concurrent sessions. The default is low on purpose, to make sure deployments determine their own
   * session limit based on the hardware and usage of the tenants module. Use `Infinity` to allow unlimited
   * concurrent sessions.
   *
   * @default 100
   */
  sessionLimit?: number

  /**
   * Timeout in milliseconds for acquiring a tenant session. If the {@link TenantsModuleConfigOptions.maxNumberOfSessions} is reached and
   * a tenant sessions couldn't be acquired within the specified timeout, an error will be thrown and the session creation will be aborted.
   * Use `Infinity` to disable the timeout.
   *
   * @default 1000
   */
  sessionAcquireTimeout?: number

  /**
   * Cache the id, status and storage version of the tenant record that is read when a tenant session
   * is opened, in the cache of the agent's `CacheModule`. Set to `false` to disable. The cache is not
   * used when the agent's cache is the `SingleContextStorageLruCache`.
   *
   * With multiple instances, use a shared cache (e.g. `RedisCache` from `@credo-ts/redis-cache`).
   * Otherwise a tenant deactivated or deleted by another instance still gets sessions here until the
   * entry expires.
   *
   * @default { expiryInSeconds: 30 }
   */
  tenantRecordCache?: TenantRecordCacheOptions | false
}

export class TenantsModuleConfig {
  private options: TenantsModuleConfigOptions

  public constructor(options?: TenantsModuleConfigOptions) {
    this.options = options ?? {}
  }

  /** See {@link TenantsModuleConfigOptions.sessionLimit} */
  public get sessionLimit(): number {
    return this.options.sessionLimit ?? 100
  }

  /** See {@link TenantsModuleConfigOptions.sessionAcquireTimeout} */
  public get sessionAcquireTimeout(): number {
    return this.options.sessionAcquireTimeout ?? 1000
  }

  /** See {@link TenantsModuleConfigOptions.tenantRecordCache} */
  public get tenantRecordCache() {
    return this.options.tenantRecordCache ?? { expiryInSeconds: 30 }
  }
}
