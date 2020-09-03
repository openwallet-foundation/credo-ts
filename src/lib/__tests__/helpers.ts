/* eslint-disable no-console */
import { Subject } from 'rxjs';
import { ConnectionRecord } from '../storage/ConnectionRecord';
import { Agent, InboundTransporter, OutboundTransporter } from '..';
import { OutboundPackage, WireMessage } from '../types';

// Custom matchers which can be used to extend Jest matchers via extend, e. g. `expect.extend({ toBeConnectedWith })`.

export function toBeConnectedWith(received: ConnectionRecord, connection: ConnectionRecord) {
  const pass = received.theirDid === connection.did && received.theirKey === connection.verkey;
  if (pass) {
    return {
      message: () =>
        `expected connection ${received.did}, ${received.verkey} not to be connected to with ${connection.did}, ${connection.verkey}`,
      pass: true,
    };
  } else {
    return {
      message: () =>
        `expected connection ${received.did}, ${received.verkey} to be connected to with ${connection.did}, ${connection.verkey}`,
      pass: false,
    };
  }
}

export class SubjectInboundTransporter implements InboundTransporter {
  private subject: Subject<WireMessage>;

  public constructor(subject: Subject<WireMessage>) {
    this.subject = subject;
  }

  public start(agent: Agent) {
    this.subscribe(agent, this.subject);
  }

  private subscribe(agent: Agent, subject: Subject<WireMessage>) {
    subject.subscribe({
      next: (message: WireMessage) => agent.receiveMessage(message),
    });
  }
}

export class SubjectOutboundTransporter implements OutboundTransporter {
  private subject: Subject<WireMessage>;

  public constructor(subject: Subject<WireMessage>) {
    this.subject = subject;
  }

  public async sendMessage(outboundPackage: OutboundPackage) {
    console.log('Sending message...');
    const { payload } = outboundPackage;
    console.log(payload);
    this.subject.next(payload);
  }
}
