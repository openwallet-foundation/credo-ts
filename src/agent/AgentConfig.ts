import type { Logger } from '../logger'
import type { InitConfig, InboundConnection } from '../types'

import { DID_COMM_TRANSPORT_QUEUE } from '../constants'
import { ConsoleLogger, LogLevel } from '../logger'
import { AutoAcceptCredential, DidCommMimeType } from '../types'

export class AgentConfig {
  private initConfig: InitConfig
  public logger: Logger
  public inboundConnection?: InboundConnection

  public constructor(initConfig: InitConfig) {
    this.initConfig = initConfig
    this.logger = initConfig.logger ?? new ConsoleLogger(LogLevel.off)
  }

  public get indy() {
    return this.initConfig.indy
  }

  public get fileSystem() {
    return this.initConfig.fileSystem
  }

  public get label() {
    return this.initConfig.label
  }

  public get publicDidSeed() {
    return this.initConfig.publicDidSeed
  }

  public get mediatorUrl() {
    return this.initConfig.mediatorUrl
  }

  public get poolName() {
    return this.initConfig.poolName ?? 'default-pool'
  }

  public get genesisPath() {
    return this.initConfig.genesisPath
  }

  public get genesisTransactions() {
    return this.initConfig.genesisTransactions
  }

  public get walletConfig() {
    return this.initConfig.walletConfig
  }

  public get walletCredentials() {
    return this.initConfig.walletCredentials
  }

  public establishInbound(inboundConnection: InboundConnection) {
    this.inboundConnection = inboundConnection
  }

  public get autoAcceptConnections() {
    return this.initConfig.autoAcceptConnections ?? false
  }

  public get autoAcceptCredentials() {
    return this.initConfig.autoAcceptCredentials ?? AutoAcceptCredential.Never
  }

  public get didCommMimeType() {
    return this.initConfig.didCommMimeType ?? DidCommMimeType.V0
  }

  public getEndpoint() {
    // If a mediator is used, always return that as endpoint
    const didCommServices = this.inboundConnection?.connection?.theirDidDoc?.didCommServices
    if (didCommServices && didCommServices?.length > 0) return didCommServices[0].serviceEndpoint

    // Otherwise we check if an endpoint is set
    if (this.initConfig.endpoint) return `${this.initConfig.endpoint}/msg`

    // Otherwise we'll try to construct it from the host/port
    let hostEndpoint = this.initConfig.host
    if (hostEndpoint) {
      if (this.initConfig.port) hostEndpoint += `:${this.initConfig.port}`
      return `${hostEndpoint}/msg`
    }

    // If we still don't have an endpoint, return didcomm:transport/queue
    // https://github.com/hyperledger/aries-rfcs/issues/405#issuecomment-582612875
    return DID_COMM_TRANSPORT_QUEUE
  }

  public getRoutingKeys() {
    const verkey = this.inboundConnection?.verkey
    return verkey ? [verkey] : []
  }
}
