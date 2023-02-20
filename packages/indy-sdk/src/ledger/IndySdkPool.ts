import type { IndySdk } from '../types'
import type { FileSystem, Logger } from '@aries-framework/core'
import type { LedgerReadReplyResponse, LedgerRequest, LedgerWriteReplyResponse } from 'indy-sdk'
import type { Subject } from 'rxjs'

import { AriesFrameworkError } from '@aries-framework/core'

import { isIndyError, IndySdkError } from '../error'

import { IndySdkPoolError } from './error'
import { isLedgerRejectResponse, isLedgerReqnackResponse } from './util'

export interface TransactionAuthorAgreement {
  version: `${number}.${number}` | `${number}`
  acceptanceMechanism: string
}

export interface IndySdkPoolConfig {
  /**
   * Optional id that influences the pool config that is created by the indy-sdk.
   * Uses the indyNamespace as the pool identifier if not provided.
   */
  id?: string

  genesisPath?: string
  genesisTransactions?: string

  isProduction: boolean
  indyNamespace: string
  transactionAuthorAgreement?: TransactionAuthorAgreement
  connectOnStartup?: boolean
}

export class IndySdkPool {
  private indySdk: IndySdk
  private logger: Logger
  private fileSystem: FileSystem
  private poolConfig: IndySdkPoolConfig
  private _poolHandle?: number
  private poolConnected?: Promise<void>
  public authorAgreement?: AuthorAgreement | null

  public constructor(
    poolConfig: IndySdkPoolConfig,
    indySdk: IndySdk,
    logger: Logger,
    stop$: Subject<boolean>,
    fileSystem: FileSystem
  ) {
    this.indySdk = indySdk
    this.fileSystem = fileSystem
    this.poolConfig = poolConfig
    this.logger = logger

    // Listen to stop$ (shutdown) and close pool
    stop$.subscribe(async () => {
      if (this._poolHandle) {
        await this.close()
      }
    })
  }

  public get didIndyNamespace(): string {
    return this.config.indyNamespace
  }

  public get id() {
    return this.poolConfig.id
  }

  public get config() {
    return this.poolConfig
  }

  public async close() {
    const poolHandle = this._poolHandle

    if (!poolHandle) {
      return
    }

    this._poolHandle = undefined
    this.poolConnected = undefined

    await this.indySdk.closePoolLedger(poolHandle)
  }

  public async delete() {
    // Close the pool if currently open
    if (this._poolHandle) {
      await this.close()
    }

    await this.indySdk.deletePoolLedgerConfig(this.poolConfig.indyNamespace)
  }

  public async connect() {
    if (!this.poolConnected) {
      // Save the promise of connectToLedger to determine if we are done connecting
      this.poolConnected = this.connectToLedger()
      this.poolConnected.catch((error) => {
        // Set poolConnected to undefined so we can retry connection upon failure
        this.poolConnected = undefined
        this.logger.error('Connection to pool: ' + this.poolConfig.genesisPath + ' failed.', { error })
      })
      return this.poolConnected
    } else {
      throw new AriesFrameworkError('Cannot attempt connection to ledger, already connecting.')
    }
  }

  private async connectToLedger() {
    const poolName = this.poolConfig.id ?? this.poolConfig.indyNamespace
    const genesisPath = await this.getGenesisPath()

    if (!genesisPath) {
      throw new AriesFrameworkError('Cannot connect to ledger without genesis file')
    }

    this.logger.debug(`Connecting to ledger pool '${poolName}'`, { genesisPath })
    await this.indySdk.setProtocolVersion(2)

    try {
      this._poolHandle = await this.indySdk.openPoolLedger(poolName)
      return
    } catch (error) {
      if (!isIndyError(error, 'PoolLedgerNotCreatedError')) {
        throw isIndyError(error) ? new IndySdkError(error) : error
      }
    }

    this.logger.debug(`Pool '${poolName}' does not exist yet, creating.`, {
      indyError: 'PoolLedgerNotCreatedError',
    })
    try {
      await this.indySdk.createPoolLedgerConfig(poolName, { genesis_txn: genesisPath })
      this._poolHandle = await this.indySdk.openPoolLedger(poolName)
      return
    } catch (error) {
      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  private async submitRequest(request: LedgerRequest) {
    return this.indySdk.submitRequest(await this.getPoolHandle(), request)
  }

  public async submitReadRequest(request: LedgerRequest) {
    const response = await this.submitRequest(request)

    if (isLedgerRejectResponse(response) || isLedgerReqnackResponse(response)) {
      throw new IndySdkPoolError(
        `Ledger '${this.didIndyNamespace}' rejected read transaction request: ${response.reason}`
      )
    }

    return response as LedgerReadReplyResponse
  }

  public async submitWriteRequest(request: LedgerRequest) {
    const response = await this.submitRequest(request)

    if (isLedgerRejectResponse(response) || isLedgerReqnackResponse(response)) {
      throw new IndySdkPoolError(
        `Ledger '${this.didIndyNamespace}' rejected write transaction request: ${response.reason}`
      )
    }

    return response as LedgerWriteReplyResponse
  }

  private async getPoolHandle() {
    if (this.poolConnected) {
      // If we have tried to already connect to pool wait for it
      try {
        await this.poolConnected
      } catch (error) {
        this.logger.error('Connection to pool: ' + this.poolConfig.genesisPath + ' failed.', { error })
      }
    }

    if (!this._poolHandle) await this.connect()
    if (!this._poolHandle) throw new IndySdkPoolError('Pool handle not set after connection')

    return this._poolHandle
  }

  private async getGenesisPath() {
    // If the path is already provided return it
    if (this.poolConfig.genesisPath) return this.poolConfig.genesisPath

    // Determine the genesisPath
    const genesisPath = this.fileSystem.tempPath + `/genesis-${this.poolConfig.id ?? this.poolConfig.indyNamespace}.txn`
    // Store genesis data if provided
    if (this.poolConfig.genesisTransactions) {
      await this.fileSystem.write(genesisPath, this.poolConfig.genesisTransactions)
      this.poolConfig.genesisPath = genesisPath
      return genesisPath
    }

    // No genesisPath
    return null
  }
}

export interface AuthorAgreement {
  digest: string
  version: string
  text: string
  ratification_ts: number
  acceptanceMechanisms: AcceptanceMechanisms
}

export interface AcceptanceMechanisms {
  aml: Record<string, string>
  amlContext: string
  version: string
}
