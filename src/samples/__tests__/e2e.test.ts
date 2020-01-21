/* eslint-disable no-console */
// @ts-ignore
import { Agent, decodeInvitationFromUrl, InboundTransporter, OutboundTransporter, Connection } from '../../lib';
import { IndyWallet } from '../../lib/wallet/IndyWallet';

import { WireMessage, OutboundPackage, TYPES, InitConfig } from '../../lib/types';
import { get, post } from '../http';
import { toBeConnectedWith } from '../../lib/testUtils';
import { Container, injectable, inject } from 'inversify';
import { Wallet, WalletConfig, WalletCredentials } from '../../lib/wallet/Wallet';
import { Context } from '../../lib/agent/Context';
import { ContextImpl } from '../../lib/agent/Agent';
import { ConnectionService } from '../../lib/protocols/connections/ConnectionService';
import { BasicMessageService } from '../../lib/protocols/basicmessage/BasicMessageService';
import { ProviderRoutingService } from '../../lib/protocols/routing/ProviderRoutingService';
import { ConsumerRoutingService } from '../../lib/protocols/routing/ConsumerRoutingService';
import { MessageReceiver } from '../../lib/agent/MessageReceiver';
import ContainerHelper from '../../lib/agent/ContainerHelper';
import { Dispatcher } from '../../lib/agent/Dispatcher';
import { MessageSender } from '../../lib/agent/MessageSender';
import logger from '../../lib/logger';
import { Poller } from '../../lib/helpers';

jest.setTimeout(8000);

expect.extend({ toBeConnectedWith });

const aliceConfig = {
  label: 'e2e Alice',
  walletName: 'e2e-alice',
  walletKey: '00000000000000000000000000000Test01',
  agencyUrl: 'http://localhost:3001',
};

const bobConfig = {
  label: 'e2e Bob',
  walletName: 'e2e-bob',
  walletKey: '00000000000000000000000000000Test02',
  agencyUrl: 'http://localhost:3002',
};

const TYPE_POLLER = Symbol.for('Poller');

describe('with agency', () => {
  let aliceContainer: Container;
  let bobContainer: Container;

  beforeAll(() => {
    aliceContainer = new Container();
    aliceContainer.bind<Poller>(TYPE_POLLER).to(Poller);
    aliceContainer
      .bind<OutboundTransporter>(TYPES.OutboundTransporter)
      .to(HttpOutboundTransporter)
      .inSingletonScope();
    aliceContainer
      .bind<InboundTransporter>(TYPES.InboundTransporter)
      .to(PollingInboundTransporter)
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

    bobContainer = new Container();
    bobContainer.bind<Poller>(TYPE_POLLER).to(Poller);
    bobContainer
      .bind<OutboundTransporter>(TYPES.OutboundTransporter)
      .to(HttpOutboundTransporter)
      .inSingletonScope();
    bobContainer
      .bind<InboundTransporter>(TYPES.InboundTransporter)
      .to(PollingInboundTransporter)
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
  });

  afterAll(async () => {
    const aliceInboundTransport = aliceContainer.get<PollingInboundTransporter>(TYPES.InboundTransporter);
    aliceInboundTransport.stop();

    const bobInboundTransport = bobContainer.get<PollingInboundTransporter>(TYPES.InboundTransporter);
    bobInboundTransport.stop();

    // to flush out existing polls
    await new Promise(r => setTimeout(r, 1000));
  });

  test('make a connection with agency', async () => {
    const aliceAgent = aliceContainer.get<Agent>(TYPES.Agent);
    await aliceAgent.init();

    const bobAgent = bobContainer.get<Agent>(TYPES.Agent);
    await bobAgent.init();

    const aliceInbound = aliceAgent.getInboundConnection();
    const aliceInboundConnection = aliceInbound && aliceInbound.connection;
    const aliceKeyAtAliceAgency = aliceInboundConnection && aliceInboundConnection.verkey;

    console.log('aliceInboundConnection', aliceInboundConnection);

    const bobInbound = bobAgent.getInboundConnection();
    const bobInboundConnection = bobInbound && bobInbound.connection;
    const bobKeyAtBobAgency = bobInboundConnection && bobInboundConnection.verkey;

    console.log('bobInboundConnection', bobInboundConnection);

    // TODO This endpoint currently exists at agency only for the testing purpose. It returns agency's part of the pairwise connection.
    const agencyConnectionAtAliceAgency = JSON.parse(
      await get(`${aliceAgent.getAgencyUrl()}/api/connections/${aliceKeyAtAliceAgency}`)
    );
    const agencyConnectionAtBobAgency = JSON.parse(
      await get(`${bobAgent.getAgencyUrl()}/api/connections/${bobKeyAtBobAgency}`)
    );

    // Here I'm creating instance based on JSON response to be able to call methods on connection. Matcher calls
    // `theirKey` which is getter method to access verkey in DidDoc If this will become a problem we can consider to add
    // some (de)serialization mechanism.
    expect(aliceInboundConnection).toBeConnectedWith(new Connection(agencyConnectionAtAliceAgency));
    expect(bobInboundConnection).toBeConnectedWith(new Connection(agencyConnectionAtBobAgency));
  });

  test('make a connection via agency', async () => {
    const aliceAgent = aliceContainer.get<Agent>(TYPES.Agent);
    const invitationUrl = await aliceAgent.createInvitationUrl();

    const bobAgent = bobContainer.get<Agent>(TYPES.Agent);
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

  test('send a message to connection via agency', async () => {
    const aliceAgent = aliceContainer.get<Agent>(TYPES.Agent);
    const bobAgent = bobContainer.get<Agent>(TYPES.Agent);

    const aliceConnections = await aliceAgent.getConnections();
    console.log('aliceConnections', JSON.stringify(aliceConnections, null, 2));

    const bobConnections = await bobAgent.getConnections();
    console.log('bobConnections', JSON.stringify(bobConnections, null, 2));

    // send message from Alice to Bob
    const message = 'hello, world';
    await aliceAgent.sendMessageToConnection(aliceConnections[1], message);

    const poller = bobContainer.get<Poller>(TYPE_POLLER);
    const bobMessages = await poller.poll(
      () => {
        console.log(`Getting Bob's connection messages...`);
        const connections = bobAgent.getConnections();
        return connections[1].messages;
      },
      (messages: WireMessage[]) => messages.length < 1,
      100
    );
    console.log(bobMessages);
    expect(bobMessages[0].content).toBe(message);
  });
});

@injectable()
class PollingInboundTransporter implements InboundTransporter {
  poller: Poller;

  constructor(@inject(TYPE_POLLER) poller: Poller) {
    this.poller = poller;
  }

  async start(agent: Agent) {
    await this.registerAgency(agent);
  }

  async registerAgency(agent: Agent) {
    const agencyUrl = (await agent.getAgencyUrl()) || '';
    const agencyInvitationUrl = await get(`${agencyUrl}/invitation`);
    const agentKeyAtAgency = await agent.acceptInvitationUrl(agencyInvitationUrl);

    const agentConnectionAtAgency = agent.findConnectionByMyKey(agentKeyAtAgency);
    if (!agentConnectionAtAgency) {
      throw new Error('Connection not found!');
    }

    this.pollMessages(agent, agencyUrl, agentKeyAtAgency);

    await agentConnectionAtAgency.isConnected();
    console.log('agentConnectionAtAgency\n', agentConnectionAtAgency);

    const { verkey: agencyVerkey } = JSON.parse(await get(`${agencyUrl}/`));
    agent.establishInbound(agencyVerkey, agentConnectionAtAgency);
  }

  pollMessages(agent: Agent, agencyUrl: string, verkey: Verkey) {
    this.poller.poll(
      async () => {
        const message = await get(`${agencyUrl}/api/connections/${verkey}/message`);
        if (message && message.length > 0) {
          const parsedMessage = JSON.parse(message);
          logger.logJson('Polled Message', parsedMessage);
          agent.receiveMessage(parsedMessage);
        }
      },
      () => true,
      100
    );
  }

  stop() {
    this.poller.stop();
  }
}

@injectable()
class HttpOutboundTransporter implements OutboundTransporter {
  async sendMessage(outboundPackage: OutboundPackage) {
    const { payload, endpoint } = outboundPackage;

    if (!endpoint) {
      throw new Error(`Missing endpoint. I don't know how and where to send the message.`);
    }

    console.log('Sending message...');
    console.log(payload);
    await post(`${endpoint}`, JSON.stringify(payload));
  }
}
