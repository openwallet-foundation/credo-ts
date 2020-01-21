/* eslint-disable no-console */
// @ts-ignore
import { Subject } from 'rxjs';
import { Agent, decodeInvitationFromUrl, InboundTransporter, OutboundTransporter } from '..';
import { toBeConnectedWith } from '../testUtils';
import { OutboundPackage, WireMessage, TYPES, InitConfig } from '../types';
import { IndyWallet } from '../wallet/IndyWallet';
import { Container, injectable, inject, named } from 'inversify';
import { WalletConfig, WalletCredentials, Wallet } from '../wallet/Wallet';
import { MessageSender } from '../agent/MessageSender';
import { Context } from '../agent/Context';
import { ContextImpl } from '../agent/Agent';
import { ConnectionService } from '../protocols/connections/ConnectionService';
import { BasicMessageService } from '../protocols/basicmessage/BasicMessageService';
import { ProviderRoutingService } from '../protocols/routing/ProviderRoutingService';
import { ConsumerRoutingService } from '../protocols/routing/ConsumerRoutingService';
import { MessageReceiver } from '../agent/MessageReceiver';
import ContainerHelper from '../agent/ContainerHelper';
import { Dispatcher } from '../agent/Dispatcher';
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

  beforeAll(() => {
    const aliceMessages = new Subject();
    const bobMessages = new Subject();

    aliceContainer = new Container();
    aliceContainer
      .bind<Subject<unknown>>(TYPE_SUBJECT)
      .toConstantValue(aliceMessages)
      .whenTargetNamed('receiver');
    aliceContainer
      .bind<Subject<unknown>>(TYPE_SUBJECT)
      .toConstantValue(bobMessages)
      .whenTargetNamed('sender');

    aliceContainer
      .bind<OutboundTransporter>(TYPES.OutboundTransporter)
      .to(SubjectOutboundTransporter)
      .inSingletonScope();
    aliceContainer
      .bind<InboundTransporter>(TYPES.InboundTransporter)
      .to(SubjectInboundTransporter)
      .inSingletonScope();
    aliceContainer.bind<InitConfig>(TYPES.InitConfig).toConstantValue(aliceConfig);
    aliceContainer.bind<WalletConfig>(TYPES.WalletConfig).toConstantValue({ id: aliceConfig.walletName });
    aliceContainer.bind<WalletCredentials>(TYPES.WalletCredentials).toConstantValue({ key: aliceConfig.walletKey });
    aliceContainer
      .bind<Wallet>(TYPES.Wallet)
      .to(IndyWallet)
      .inSingletonScope();
    aliceContainer.bind<MessageSender>(TYPES.MessageSender).to(MessageSender);
    aliceContainer
      .bind<Context>(TYPES.Context)
      .to(ContextImpl)
      .inSingletonScope();
    aliceContainer
      .bind<ConnectionService>(TYPES.ConnectionService)
      .to(ConnectionService)
      .inSingletonScope();
    aliceContainer.bind<BasicMessageService>(TYPES.BasicMessageService).to(BasicMessageService);
    aliceContainer
      .bind<ProviderRoutingService>(TYPES.ProviderRoutingService)
      .to(ProviderRoutingService)
      .inSingletonScope();
    aliceContainer.bind<ConsumerRoutingService>(TYPES.ConsumerRoutingService).to(ConsumerRoutingService);
    aliceContainer.bind<MessageReceiver>(TYPES.MessageReceiver).to(MessageReceiver);
    ContainerHelper.registerDefaultHandlers(aliceContainer);
    aliceContainer.bind<Dispatcher>(TYPES.Dispatcher).to(Dispatcher);

    aliceContainer
      .bind<Agent>(TYPES.Agent)
      .to(Agent)
      .inSingletonScope();
    aliceAgent = aliceContainer.get<Agent>(TYPES.Agent);

    bobContainer = new Container();
    bobContainer
      .bind<Subject<unknown>>(TYPE_SUBJECT)
      .toConstantValue(bobMessages)
      .whenTargetNamed('receiver');
    bobContainer
      .bind<Subject<unknown>>(TYPE_SUBJECT)
      .toConstantValue(aliceMessages)
      .whenTargetNamed('sender');
    bobContainer
      .bind<OutboundTransporter>(TYPES.OutboundTransporter)
      .to(SubjectOutboundTransporter)
      .inSingletonScope();
    bobContainer
      .bind<InboundTransporter>(TYPES.InboundTransporter)
      .to(SubjectInboundTransporter)
      .inSingletonScope();
    bobContainer.bind<InitConfig>(TYPES.InitConfig).toConstantValue(bobConfig);
    bobContainer.bind<WalletConfig>(TYPES.WalletConfig).toConstantValue({ id: bobConfig.walletName });
    bobContainer.bind<WalletCredentials>(TYPES.WalletCredentials).toConstantValue({ key: bobConfig.walletKey });
    bobContainer
      .bind<Wallet>(TYPES.Wallet)
      .to(IndyWallet)
      .inSingletonScope();
    bobContainer.bind<MessageSender>(TYPES.MessageSender).to(MessageSender);
    bobContainer
      .bind<Context>(TYPES.Context)
      .to(ContextImpl)
      .inSingletonScope();
    bobContainer
      .bind<ConnectionService>(TYPES.ConnectionService)
      .to(ConnectionService)
      .inSingletonScope();
    bobContainer.bind<BasicMessageService>(TYPES.BasicMessageService).to(BasicMessageService);
    bobContainer
      .bind<ProviderRoutingService>(TYPES.ProviderRoutingService)
      .to(ProviderRoutingService)
      .inSingletonScope();
    bobContainer.bind<ConsumerRoutingService>(TYPES.ConsumerRoutingService).to(ConsumerRoutingService);
    bobContainer.bind<MessageReceiver>(TYPES.MessageReceiver).to(MessageReceiver);
    ContainerHelper.registerDefaultHandlers(bobContainer);
    bobContainer.bind<Dispatcher>(TYPES.Dispatcher).to(Dispatcher);

    bobContainer
      .bind<Agent>(TYPES.Agent)
      .to(Agent)
      .inSingletonScope();
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
