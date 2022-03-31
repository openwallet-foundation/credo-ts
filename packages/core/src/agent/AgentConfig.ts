import type { Logger } from '../logger'
import type { FileSystem } from '../storage/FileSystem'
import type { InitConfig } from '../types'
import type { AgentDependencies } from './AgentDependencies'

import { Subject } from 'rxjs'

import { DID_COMM_TRANSPORT_QUEUE } from '../constants'
import { AriesFrameworkError } from '../error'
import { ConsoleLogger, LogLevel } from '../logger'
import { AutoAcceptCredential } from '../modules/credentials/CredentialAutoAcceptType'
import { AutoAcceptProof } from '../modules/proofs/ProofAutoAcceptType'
import { MediatorPickupStrategy } from '../modules/routing/MediatorPickupStrategy'
import { DidCommMimeType } from '../types'

export class AgentConfig {
  private initConfig: InitConfig
  public label: string
  public logger: Logger
  public readonly agentDependencies: AgentDependencies
  public readonly fileSystem: FileSystem

  // $stop is used for agent shutdown signal
  public readonly stop$ = new Subject<boolean>()

  public constructor(initConfig: InitConfig, agentDependencies: AgentDependencies) {
    this.initConfig = initConfig
    this.label = initConfig.label
    this.logger = initConfig.logger ?? new ConsoleLogger(LogLevel.off)
    this.agentDependencies = agentDependencies
    this.fileSystem = new agentDependencies.FileSystem()

    const { mediatorConnectionsInvite, clearDefaultMediator, defaultMediatorId } = this.initConfig

    const allowOne = [mediatorConnectionsInvite, clearDefaultMediator, defaultMediatorId].filter((e) => e !== undefined)
    if (allowOne.length > 1) {
      throw new AriesFrameworkError(
        `Only one of 'mediatorConnectionsInvite', 'clearDefaultMediator' and 'defaultMediatorId' can be set as they negate each other`
      )
    }
  }

  public get connectToIndyLedgersOnStartup() {
    return this.initConfig.connectToIndyLedgersOnStartup ?? true
  }

  public get publicDidSeed() {
    return this.initConfig.publicDidSeed
  }

  public get indyLedgers() {
    return this.initConfig.indyLedgers ?? []
  }

  public get walletConfig() {
    return this.initConfig.walletConfig
  }

  public get autoAcceptConnections() {
    return this.initConfig.autoAcceptConnections ?? false
  }

  public get autoAcceptProofs() {
    return this.initConfig.autoAcceptProofs ?? AutoAcceptProof.Never
  }

  public get autoAcceptCredentials() {
    return this.initConfig.autoAcceptCredentials ?? AutoAcceptCredential.Never
  }

  public get didCommMimeType() {
    return this.initConfig.didCommMimeType ?? DidCommMimeType.V0
  }

  public get mediatorPollingInterval() {
    return this.initConfig.mediatorPollingInterval ?? 5000
  }

  public get mediatorPickupStrategy() {
    return this.initConfig.mediatorPickupStrategy ?? MediatorPickupStrategy.Explicit
  }

  public get endpoints(): [string, ...string[]] {
    // if endpoints is not set, return queue endpoint
    // https://github.com/hyperledger/aries-rfcs/issues/405#issuecomment-582612875
    if (!this.initConfig.endpoints || this.initConfig.endpoints.length === 0) {
      return [DID_COMM_TRANSPORT_QUEUE]
    }

    return this.initConfig.endpoints as [string, ...string[]]
  }

  public get mediatorConnectionsInvite() {
    return this.initConfig.mediatorConnectionsInvite
  }

  public get autoAcceptMediationRequests() {
    return this.initConfig.autoAcceptMediationRequests ?? false
  }

  public get defaultMediatorId() {
    return this.initConfig.defaultMediatorId
  }

  public get clearDefaultMediator() {
    return this.initConfig.clearDefaultMediator ?? false
  }

  public get useLegacyDidSovPrefix() {
    return this.initConfig.useLegacyDidSovPrefix ?? false
  }

  public get connectionImageUrl() {
    return this.initConfig.connectionImageUrl
  }

  public get autoUpdateStorageOnStartup() {
    return this.initConfig.autoUpdateStorageOnStartup ?? false
  }
}
