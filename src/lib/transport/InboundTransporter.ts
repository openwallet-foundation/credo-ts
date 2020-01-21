import { Agent } from '../agent/Agent';

export interface InboundTransporter {
  start(agent: Agent): void;
  // start(agencyUrl: string): void
}
