/* eslint-disable no-console */
// @ts-ignore
import { poll } from 'await-poll';
import { Subject } from 'rxjs';
import { Agent, decodeInvitationFromUrl, InboundTransporter, OutboundTransporter } from '..';
import { toBeConnectedWith } from '../testUtils';
import { OutboundPackage, WireMessage } from '../types';

jest.setTimeout(10000);

expect.extend({ toBeConnectedWith });

const aliceConfig = {
  label: 'Alice',
  walletName: 'alice',
  walletKey: '00000000000000000000000000000Test01',
};

const bobConfig = {
  label: 'Bob',
  walletName: 'bob',
  walletKey: '00000000000000000000000000000Test02',
};

describe('agents', () => {
  let aliceAgent: Agent;
  let bobAgent: Agent;

  test('make a connection between agents', async () => {
    const aliceMessages = new Subject();
    const bobMessages = new Subject();

    const aliceAgentInbound = new SubjectInboundTransporter(aliceMessages);
    const aliceAgentOutbound = new SubjectOutboundTransporter(bobMessages);

    const bobAgentInbound = new SubjectInboundTransporter(bobMessages);
    const bobAgentOutbound = new SubjectOutboundTransporter(aliceMessages);

    aliceAgent = new Agent(aliceConfig, aliceAgentInbound, aliceAgentOutbound);
    await aliceAgent.init();

    bobAgent = new Agent(bobConfig, bobAgentInbound, bobAgentOutbound);
    await bobAgent.init();

    const invitationUrl = await aliceAgent.createInvitationUrl();
    await bobAgent.acceptInvitationUrl(invitationUrl);

    // We need to decode invitation URL to get keys from invitation
    // It can be maybe better to get connection ID instead of invitationUrl from the previous step and work with that
    const invitation = decodeInvitationFromUrl(invitationUrl);
    const aliceKeyAtAliceBob = invitation.recipientKeys[0];

    const aliceConnectionAtAliceBob = aliceAgent.findConnectionByMyKey(aliceKeyAtAliceBob);
    if (!aliceConnectionAtAliceBob) {
      throw new Error('Connection not found!');
    }

    await aliceConnectionAtAliceBob.isConnected();
    console.log('aliceConnectionAtAliceBob\n', aliceConnectionAtAliceBob);

    if (!aliceConnectionAtAliceBob.theirKey) {
      throw new Error('Connection has not been initialized correctly!');
    }

    const bobKeyAtBobAlice = aliceConnectionAtAliceBob.theirKey;
    const bobConnectionAtBobAlice = bobAgent.findConnectionByMyKey(bobKeyAtBobAlice);
    if (!bobConnectionAtBobAlice) {
      throw new Error('Connection not found!');
    }

    await bobConnectionAtBobAlice.isConnected();
    console.log('bobConnectionAtAliceBob\n', bobConnectionAtBobAlice);

    expect(aliceConnectionAtAliceBob).toBeConnectedWith(bobConnectionAtBobAlice);
    expect(bobConnectionAtBobAlice).toBeConnectedWith(aliceConnectionAtAliceBob);
  });

  test('send a message to connection', async () => {
    const aliceConnections = await aliceAgent.getConnections();
    console.log('aliceConnections', aliceConnections);

    const bobConnections = await bobAgent.getConnections();
    console.log('bobConnections', bobConnections);

    // send message from Alice to Bob
    const message = 'hello, world';
    await aliceAgent.sendMessageToConnection(aliceConnections[0], message);

    const bobMessages = await poll(
      () => {
        console.log(`Getting Bob's connection messages...`);
        const connections = bobAgent.getConnections();
        return connections[0].messages;
      },
      (messages: WireMessage[]) => messages.length < 1
    );
    console.log(bobMessages);
    expect(bobMessages[0].content).toBe(message);
  });
});

class SubjectInboundTransporter implements InboundTransporter {
  subject: Subject<WireMessage>;

  constructor(subject: Subject<WireMessage>) {
    this.subject = subject;
  }

  start(agent: Agent) {
    this.subscribe(agent, this.subject);
  }

  subscribe(agent: Agent, subject: Subject<WireMessage>) {
    subject.subscribe({
      next: (message: WireMessage) => agent.receiveMessage(message),
    });
  }
}

class SubjectOutboundTransporter implements OutboundTransporter {
  subject: Subject<WireMessage>;

  constructor(subject: Subject<WireMessage>) {
    this.subject = subject;
  }

  async sendMessage(outboundPackage: OutboundPackage, receive_reply: boolean) {
    console.log('Sending message...');
    const { payload } = outboundPackage;
    console.log(payload);
    this.subject.next(payload);
  }
}
