/* eslint-disable no-console */
// @ts-ignore
import {
  Agent,
  decodeInvitationFromUrl,
  InboundTransporter,
  OutboundTransporter,
  Connection,
  ContainerHelper,
} from '../../lib';
import { IndyWallet } from '../../lib/wallet/IndyWallet';

import { WireMessage, OutboundPackage, TYPES, InitConfig } from '../../lib/types';
import { get, post } from '../http';
import { toBeConnectedWith } from '../../lib/testUtils';
import { Container, injectable, inject } from 'inversify';
import { Wallet, WalletConfig, WalletCredentials } from '../../lib/wallet/Wallet';
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

  const newContainer = (config: InitConfig): Container => {
    const container = new Container();
    container.bind<Poller>(TYPE_POLLER).to(Poller);
    container
      .bind<OutboundTransporter>(TYPES.OutboundTransporter)
      .to(HttpOutboundTransporter)
      .inSingletonScope();
    container
      .bind<InboundTransporter>(TYPES.InboundTransporter)
      .to(PollingInboundTransporter)
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
    aliceContainer = newContainer(aliceConfig);
    bobContainer = newContainer(bobConfig);
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
