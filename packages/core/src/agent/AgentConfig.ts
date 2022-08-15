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
import { offlineTransports, onlineTransports } from '../modules/routing/types'
import { AutoAcceptValueTransfer } from '../modules/value-transfer/ValueTransferAutoAcceptType'
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

  public get staticDids() {
    return this.initConfig.staticDids || []
  }

  public get publicDidType() {
    return this.initConfig.publicDidType
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

  public get autoAcceptPaymentOffer() {
    return this.initConfig.valueTransferConfig?.party?.autoAcceptPaymentOffer ?? AutoAcceptValueTransfer.Never
  }

  public get autoAcceptPaymentRequest() {
    return this.initConfig.valueTransferConfig?.party?.autoAcceptPaymentRequest ?? AutoAcceptValueTransfer.Never
  }

  public get autoAcceptOfferedPaymentRequest() {
    return this.initConfig.valueTransferConfig?.party?.autoAcceptOfferedPaymentRequest ?? AutoAcceptValueTransfer.Never
  }

  public get witnessTockTime() {
    return this.initConfig.valueTransferConfig?.witness?.tockTime || 5000
  }

  public get witnessCleanupTime() {
    return this.initConfig.valueTransferConfig?.witness?.cleanupTime || 1000 * 60 * 60
  }

  public get witnessRedeliverTime() {
    return this.initConfig.valueTransferConfig?.witness?.redeliverTime || 1000 * 60 * 10
  }

  public get witnessHistoryThreshold() {
    return this.initConfig.valueTransferConfig?.witness?.historyThreshold || 1000 * 60 * 60
  }

  public get witnessRedeliveryThreshold() {
    return this.initConfig.valueTransferConfig?.witness?.redeliveryThreshold || 1000 * 60 * 60
  }

  public get witnessIssuerDids() {
    return this.initConfig.valueTransferConfig?.witness?.issuerDids
  }

  public get valueTransferWitnessDid() {
    return this.initConfig.valueTransferConfig?.party?.witnessDid
  }

  public get didCommMimeType() {
    return this.initConfig.didCommMimeType ?? DidCommMimeType.V0
  }

  public get mediatorPollingInterval() {
    return this.initConfig.mediatorPollingInterval ?? 5000
  }

  public get mediatorPickupStrategy() {
    return this.initConfig.mediatorPickupStrategy
  }

  public get mediatorDeliveryStrategy() {
    return this.initConfig.mediatorDeliveryStrategy
  }

  public get mediatorWebHookEndpoint() {
    return this.initConfig.mediatorWebHookEndpoint
  }

  public get mediatorPushToken() {
    return this.initConfig.mediatorPushToken
  }

  public get endpoints(): [string, ...string[]] {
    // if endpoint is not set, return queue endpoint
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

  public get supportOffline() {
    return this.initConfig.supportOffline
  }

  public get valueTransferConfig() {
    return this.initConfig.valueTransferConfig
  }

  public get valueWitnessConfig() {
    return this.initConfig.valueTransferConfig?.witness
  }

  public get transports() {
    return this.initConfig.transports || []
  }

  public get catchErrors() {
    return this.initConfig.catchErrors || false
  }

  public get onlineTransports() {
    return this.transports.filter((transport) => onlineTransports.includes(transport))
  }

  public get offlineTransports() {
    return this.transports.filter((transport) => offlineTransports.includes(transport))
  }

  public async hasInternetAccess() {
    if (!this.initConfig.supportOffline) return true

    return this.agentDependencies
      .fetch('https://google.com') // FIXME: find better way to detect internet connectivity status
      .then(() => true)
      .catch(() => false)
  }
}
