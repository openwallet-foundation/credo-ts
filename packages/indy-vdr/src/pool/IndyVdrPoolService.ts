import { parseIndyDid } from '@credo-ts/anoncreds'
import { injectable } from '@credo-ts/core'
import { IndyVdrError, IndyVdrNotConfiguredError } from '../error'
import { IndyVdrModuleConfig } from '../IndyVdrModuleConfig'

import { IndyVdrPool } from './IndyVdrPool'

@injectable()
export class IndyVdrPoolService {
  public pools: IndyVdrPool[] = []
  private indyVdrModuleConfig: IndyVdrModuleConfig

  public constructor(indyVdrModuleConfig: IndyVdrModuleConfig) {
    this.indyVdrModuleConfig = indyVdrModuleConfig

    this.pools = this.indyVdrModuleConfig.networks.map((poolConfig) => new IndyVdrPool(poolConfig))
  }

  /**
   * Get the pool for the namespace of a did:indy did.
   */
  public getPoolForDid(did: string): { pool: IndyVdrPool } {
    const { namespace } = parseIndyDid(did)

    return { pool: this.getPoolForNamespace(namespace) }
  }

  /**
   * Refresh the pool connections asynchronously
   */
  public refreshPoolConnections() {
    return Promise.allSettled(this.pools.map((pool) => pool.refreshConnection()))
  }

  /**
   * Get all pool transactions
   */
  public getAllPoolTransactions() {
    return Promise.allSettled(
      this.pools.map(async (pool) => {
        return { config: pool.config, transactions: await pool.transactions }
      })
    )
  }

  /**
   * Get the most appropriate pool for the given indyNamespace
   */
  public getPoolForNamespace(indyNamespace: string) {
    if (this.pools.length === 0) {
      throw new IndyVdrNotConfiguredError(
        'No indy ledgers configured. Provide at least one pool configuration in IndyVdrModuleConfigOptions.networks'
      )
    }

    const pool = this.pools.find((pool) => pool.indyNamespace === indyNamespace)

    if (!pool) {
      throw new IndyVdrError(`No ledgers found for indy namespace '${indyNamespace}'.`)
    }

    return pool
  }
}
