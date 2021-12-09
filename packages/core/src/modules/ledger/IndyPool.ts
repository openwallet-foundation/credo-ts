import type { AgentConfig } from '../../agent/AgentConfig'
import type { Logger } from '../../logger'
import type { FileSystem } from '../../storage/FileSystem'
import type * as Indy from 'indy-sdk'

import { AriesFrameworkError, IndySdkError } from '../../error'
import { isIndyError } from '../../utils/indyError'

import { LedgerError } from './error/LedgerError'
import { isLedgerRejectResponse } from './ledgerUtil'

export interface IndyPoolConfig {
  genesisPath?: string
  genesisTransactions?: string
  id: string
  isProduction: boolean
}

export class IndyPool {
  private indy: typeof Indy
  private logger: Logger
  private fileSystem: FileSystem
  private poolConfig: IndyPoolConfig
  private _poolHandle?: number
  private poolConnected?: Promise<number>
  public authorAgreement?: AuthorAgreement | null

  public constructor(agentConfig: AgentConfig, poolConfig: IndyPoolConfig) {
    this.indy = agentConfig.agentDependencies.indy
    this.poolConfig = poolConfig
    this.fileSystem = agentConfig.fileSystem
    this.logger = agentConfig.logger

    // Listen to stop$ (shutdown) and close pool
    agentConfig.stop$.subscribe(async () => {
      if (this._poolHandle) {
        await this.close()
      }
    })
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

    // FIXME: Add type to indy-sdk
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    await this.indy.closePoolLedger(poolHandle)
  }

  public async delete() {
    // Close the pool if currently open
    if (this._poolHandle) {
      await this.close()
    }

    // FIXME: Add type to indy-sdk
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    await this.indy.deletePoolLedgerConfig(this.agentConfig.poolName)
  }

  public async connect() {
    this.poolConnected = (async ()=>{
      const poolName = this.poolConfig.id
      const genesisPath = await this.getGenesisPath()

      if (!genesisPath) {
        throw new AriesFrameworkError('Cannot connect to ledger without genesis file')
      }

      this.logger.debug(`Connecting to ledger pool '${poolName}'`, { genesisPath })
      await this.indy.setProtocolVersion(2)

      try {
        this._poolHandle = await this.indy.openPoolLedger(poolName)
        return this._poolHandle
      } catch (error) {
        if (!isIndyError(error, 'PoolLedgerNotCreatedError')) {
          throw isIndyError(error) ? new IndySdkError(error) : error
        }
      }

      this.logger.debug(`Pool '${poolName}' does not exist yet, creating.`, {
        indyError: 'PoolLedgerNotCreatedError',
      })
      try {
        await this.indy.createPoolLedgerConfig(poolName, { genesis_txn: genesisPath })
        this._poolHandle = await this.indy.openPoolLedger(poolName)
        return this._poolHandle
      } catch (error) {
        throw isIndyError(error) ? new IndySdkError(error) : error
      }
    })()

    return this.poolConnected
  }

  private async submitRequest(request: Indy.LedgerRequest) {
    return this.indy.submitRequest(await this.getPoolHandle(), request)
  }

  public async submitReadRequest(request: Indy.LedgerRequest) {
    const response = await this.submitRequest(request)

    if (isLedgerRejectResponse(response)) {
      throw new LedgerError(`Ledger '${this.id}' rejected read transaction request: ${response.reason}`)
    }

    return response as Indy.LedgerReadReplyResponse
  }

  public async submitWriteRequest(request: Indy.LedgerRequest) {

    const response = await this.submitRequest(request)

    if (isLedgerRejectResponse(response)) {
      throw new LedgerError(`Ledger '${this.id}' rejected write transaction request: ${response.reason}`)
    }

    return response as Indy.LedgerWriteReplyResponse
  }

  private async getPoolHandle() {
    if (this.poolConnected != undefined) {
      //If we have tried to already connect to pool wait for it
      await this.poolConnected
    }
    if (!this._poolHandle) {
      return this.connect()
    }

    return this._poolHandle
  }

  private async getGenesisPath() {
    // If the path is already provided return it
    if (this.poolConfig.genesisPath) return this.poolConfig.genesisPath

    // Determine the genesisPath
    const genesisPath = this.fileSystem.basePath + `/afj/genesis-${this.poolConfig.id}.txn`
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
