import type { Logger } from '@aries-framework/core'
import {IndyPool} from '@aries-framework/core'
import { PoolCreate } from "indy-vdr-test-shared"

interface TransactionAuthorAgreement {
  version: `${number}.${number}` | `${number}`
  acceptanceMechanism: string
}

interface IndyVdrPoolConfig {
  genesisTransactions: string
  isProduction: boolean
  indyNamespace: string
  transactionAuthorAgreement?: TransactionAuthorAgreement
}

export class IndyVdrPool {
  private pool: IndyPool // Not sure this is the correct type for the pool
  private logger: Logger
  private poolConfig: IndyVdrPoolConfig
  private poolConnected?: Promise<number>

  constructor(poolConfig: IndyVdrPoolConfig, logger: Logger) {
    this.logger = logger
    this.poolConfig = poolConfig
  }

  public get IndyNamespace(): string {
    return this.poolConfig.indyNamespace
  }

  public get config() {
    return this.poolConfig
  }

  public async connect() {
    this.pool = new PoolCreate({parameters: {}}) 

    

  }
}
