import { InitConfig, InboundConnection } from '../types';

export class AgentConfig {
  initConfig: InitConfig;
  inboundConnection?: InboundConnection;

  constructor(initConfig: InitConfig) {
    this.initConfig = initConfig;
  }

  get label() {
    return this.initConfig.label;
  }

  get publicDid() {
    return this.initConfig.publicDid;
  }

  get publicDidSeed() {
    return this.initConfig.publicDidSeed;
  }

  get agencyUrl() {
    return this.initConfig.agencyUrl;
  }

  establishInbound(inboundConnection: InboundConnection) {
    this.inboundConnection = inboundConnection;
  }

  getEndpoint() {
    const connection = this.inboundConnection && this.inboundConnection.connection;
    const endpoint = connection && connection.theirDidDoc && connection.theirDidDoc.service[0].serviceEndpoint;
    return endpoint ? `${endpoint}` : `${this.initConfig.url}:${this.initConfig.port}/msg`;
  }

  getRoutingKeys() {
    const verkey = this.inboundConnection && this.inboundConnection.verkey;
    return verkey ? [verkey] : [];
  }
}
