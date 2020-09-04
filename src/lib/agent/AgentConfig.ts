import { InitConfig, InboundConnection } from '../types';

export class AgentConfig {
  private initConfig: InitConfig;
  public inboundConnection?: InboundConnection;

  public constructor(initConfig: InitConfig) {
    this.initConfig = initConfig;
  }

  public get label() {
    return this.initConfig.label;
  }

  public get publicDid() {
    return this.initConfig.publicDid;
  }

  public get publicDidSeed() {
    return this.initConfig.publicDidSeed;
  }

  public get agencyUrl() {
    return this.initConfig.agencyUrl;
  }

  public establishInbound(inboundConnection: InboundConnection) {
    this.inboundConnection = inboundConnection;
  }

  public get autoAcceptConnections() {
    return this.initConfig.autoAcceptConnections ?? false;
  }

  public getEndpoint() {
    const connection = this.inboundConnection && this.inboundConnection.connection;
    const endpoint = connection && connection.theirDidDoc && connection.theirDidDoc.service[0].serviceEndpoint;
    return endpoint ?? `${this.initConfig.url}:${this.initConfig.port}/msg`;
  }

  public getRoutingKeys() {
    const verkey = this.inboundConnection?.verkey;
    return verkey ? [verkey] : [];
  }
}
