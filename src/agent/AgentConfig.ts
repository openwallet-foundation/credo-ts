import { ConsoleLogger, Logger, LogLevel } from '../logger'
import { InitConfig, InboundConnection } from '../types'

export class AgentConfig {
  private initConfig: InitConfig
  public logger: Logger

  public constructor(initConfig: InitConfig) {
    this.initConfig = initConfig
    this.logger = initConfig.logger ?? new ConsoleLogger(LogLevel.off)
  }

  public get indy() {
    return this.initConfig.indy
  }

  public get label() {
    return this.initConfig.label
  }

  public get publicDid() {
    return this.initConfig.publicDid
  }

  public get publicDidSeed() {
    return this.initConfig.publicDidSeed
  }

  public get poolName() {
    return this.initConfig.poolName ?? 'default-pool'
  }

  public get genesisPath() {
    return this.initConfig.genesisPath
  }

  public get walletConfig() {
    return this.initConfig.walletConfig
  }

  public get walletCredentials() {
    return this.initConfig.walletCredentials
  }

  public get autoAcceptConnections() {
    return this.initConfig.autoAcceptConnections ?? false
  }

  public getEndpoint() {
    // Otherwise we check if an endpoint is set
    if (this.initConfig.endpoint) return `${this.initConfig.endpoint}/msg`

    // Otherwise we'll try to construct it from the host/port
    let hostEndpoint = this.initConfig.host
    if (hostEndpoint) {
      if (this.initConfig.port) hostEndpoint += `:${this.initConfig.port}`
      return `${hostEndpoint}/msg`
    }

    // If we still don't have an endpoint, return didcomm:transport/queue
    // https://github.c om/hyperledger/aries-rfcs/issues/405#issuecomment-582612875
    return 'didcomm:transport/queue'
  }

  public get mediatorInvitation(){
    return this.initConfig.mediatorInvitation
  }

  public get openMediation(){
    return this.initConfig.openMediation ?? false
  }
  public get defaultMediatorId(){
    return this.initConfig.defaultMediatorId
  }

  public get clearDefaultMediator(){
    return this.initConfig.clearDefaultMediator ?? false
  }
}
