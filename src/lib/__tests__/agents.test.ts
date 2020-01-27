/* eslint-disable no-console */
// @ts-ignore
import { Subject } from 'rxjs';
import { Agent, decodeInvitationFromUrl, InboundTransporter, OutboundTransporter } from '..';
import { toBeConnectedWith } from '../testUtils';
import { OutboundPackage, WireMessage, TYPES, InitConfig } from '../types';
import { IndyWallet } from '../wallet/IndyWallet';
import { Container, injectable, inject, named } from 'inversify';
import { WalletConfig, WalletCredentials, Wallet } from '../wallet/Wallet';
import { ContainerHelper } from '../agent/ContainerHelper';
import { Poller } from '../helpers';

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

const TYPE_SUBJECT = Symbol.for('Subject');

describe('agents', () => {
  let aliceAgent: Agent;
  let bobAgent: Agent;
  let aliceContainer: Container;
  let bobContainer: Container;

  const newContainer = (config: InitConfig, sender: Subject<unknown>, receiver: Subject<unknown>): Container => {
    const container = new Container();

    container
      .bind<Subject<unknown>>(TYPE_SUBJECT)
      .toConstantValue(receiver)
      .whenTargetNamed('receiver');
    container
      .bind<Subject<unknown>>(TYPE_SUBJECT)
      .toConstantValue(sender)
      .whenTargetNamed('sender');
    container
      .bind<OutboundTransporter>(TYPES.OutboundTransporter)
      .to(SubjectOutboundTransporter)
      .inSingletonScope();
    container
      .bind<InboundTransporter>(TYPES.InboundTransporter)
      .to(SubjectInboundTransporter)
      .inSingletonScope();

    container.bind<InitConfig>(TYPES.InitConfig).toConstantValue(config);
    container.bind<WalletConfig>(TYPES.WalletConfig).toConstantValue({ id: config.walletName });
    container.bind<WalletCredentials>(TYPES.WalletCredentials).toConstantValue({ key: config.walletKey });
    container
      .bind<Wallet>(TYPES.Wallet)
      .to(IndyWallet)
      .inSingletonScope();
    ContainerHelper.registerDefaults(container);
    container
      .bind<Agent>(TYPES.Agent)
      .to(Agent)
      .inSingletonScope();
    return container;
  };

  beforeAll(() => {
    const aliceMessages = new Subject();
    const bobMessages = new Subject();

    aliceContainer = newContainer(aliceConfig, bobMessages, aliceMessages);
    aliceAgent = aliceContainer.get<Agent>(TYPES.Agent);

    bobContainer = newContainer(bobConfig, aliceMessages, bobMessages);
    bobAgent = bobContainer.get<Agent>(TYPES.Agent);
  });

  test('make a connection between agents', async () => {
    await aliceAgent.init();

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

    const poller = new Poller();
    const bobMessages = await poller.poll(
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

@injectable()
class SubjectInboundTransporter implements InboundTransporter {
  subject: Subject<WireMessage>;

  constructor(@inject(TYPE_SUBJECT) @named('receiver') subject: Subject<WireMessage>) {
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

@injectable()
class SubjectOutboundTransporter implements OutboundTransporter {
  subject: Subject<WireMessage>;

  constructor(@inject(TYPE_SUBJECT) @named('sender') subject: Subject<WireMessage>) {
    this.subject = subject;
  }

  sendMessage(outboundPackage: OutboundPackage) {
    console.log('Sending message...');
    const { payload } = outboundPackage;
    console.log(payload);
    this.subject.next(payload);
  }
}
