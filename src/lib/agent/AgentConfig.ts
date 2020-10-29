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

  public get mediatorUrl() {
    return this.initConfig.mediatorUrl;
  }

  public get poolName() {
    return this.initConfig.poolName ?? 'default-pool';
  }

  public get genesisPath() {
    return this.initConfig.genesisPath;
  }

  public establishInbound(inboundConnection: InboundConnection) {
    this.inboundConnection = inboundConnection;
  }

  public get autoAcceptConnections() {
    return this.initConfig.autoAcceptConnections ?? false;
  }

  public getEndpoint() {
    const endpoint = this.inboundConnection?.connection?.theirDidDoc?.service[0].serviceEndpoint;
    return endpoint ?? `${this.initConfig.url}:${this.initConfig.port}/msg`;
  }

  public getRoutingKeys() {
    const verkey = this.inboundConnection?.verkey;
    return verkey ? [verkey] : [];
  }
}
