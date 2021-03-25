import { Agent, InboundTransporter, OutboundTransporter } from '../../src';
import { OutboundPackage, InitConfig } from '../../src/types';
import { get, post } from '../http';
import { sleep, toBeConnectedWith, waitForBasicMessage } from '../../src/__tests__/helpers';
import indy from 'indy-sdk';
import testLogger from '../../src/__tests__/logger';

expect.extend({ toBeConnectedWith });

const aliceConfig: InitConfig = {
  label: 'e2e Alice',
  mediatorUrl: 'http://localhost:3001',
  walletConfig: { id: 'e2e-alice' },
  walletCredentials: { key: '00000000000000000000000000000Test01' },
  autoAcceptConnections: true,
  logger: testLogger,
  indy,
};

const bobConfig: InitConfig = {
  label: 'e2e Bob',
  mediatorUrl: 'http://localhost:3002',
  walletConfig: { id: 'e2e-bob' },
  walletCredentials: { key: '00000000000000000000000000000Test02' },
  autoAcceptConnections: true,
  logger: testLogger,
  indy,
};

describe('with mediator', () => {
  let aliceAgent: Agent;
  let bobAgent: Agent;
  let aliceAtAliceBobId: string;

  afterAll(async () => {
    (aliceAgent.inboundTransporter as PollingInboundTransporter).stop = true;
    (bobAgent.inboundTransporter as PollingInboundTransporter).stop = true;

    // Wait for messages to flush out
    await new Promise(r => setTimeout(r, 1000));

    await aliceAgent.closeAndDeleteWallet();
    await bobAgent.closeAndDeleteWallet();
  });

  test('Alice and Bob make a connection with mediator', async () => {
    const aliceAgentSender = new HttpOutboundTransporter();
    const aliceAgentReceiver = new PollingInboundTransporter();
    const bobAgentSender = new HttpOutboundTransporter();
    const bobAgentReceiver = new PollingInboundTransporter();

    aliceAgent = new Agent(aliceConfig, aliceAgentReceiver, aliceAgentSender);
    await aliceAgent.init();

    bobAgent = new Agent(bobConfig, bobAgentReceiver, bobAgentSender);
    await bobAgent.init();

    const aliceInbound = aliceAgent.routing.getInboundConnection();
    const aliceInboundConnection = aliceInbound?.connection;
    const aliceKeyAtAliceMediator = aliceInboundConnection?.verkey;
    testLogger.test('aliceInboundConnection', aliceInboundConnection);

    const bobInbound = bobAgent.routing.getInboundConnection();
    const bobInboundConnection = bobInbound?.connection;
    const bobKeyAtBobMediator = bobInboundConnection?.verkey;
    testLogger.test('bobInboundConnection', bobInboundConnection);

    // TODO This endpoint currently exists at mediator only for the testing purpose. It returns mediator's part of the pairwise connection.
    const mediatorConnectionAtAliceMediator = JSON.parse(
      await get(`${aliceAgent.getMediatorUrl()}/api/connections/${aliceKeyAtAliceMediator}`)
    );
    const mediatorConnectionAtBobMediator = JSON.parse(
      await get(`${bobAgent.getMediatorUrl()}/api/connections/${bobKeyAtBobMediator}`)
    );

    testLogger.test('mediatorConnectionAtAliceMediator', mediatorConnectionAtAliceMediator);
    testLogger.test('mediatorConnectionAtBobMediator', mediatorConnectionAtBobMediator);

    expect(aliceInboundConnection).toBeConnectedWith(mediatorConnectionAtAliceMediator);
    expect(bobInboundConnection).toBeConnectedWith(mediatorConnectionAtBobMediator);
  });

  test('Alice and Bob make a connection via mediator', async () => {
    // eslint-disable-next-line prefer-const
    let { invitation, connectionRecord: aliceAgentConnection } = await aliceAgent.connections.createConnection();

    let bobAgentConnection = await bobAgent.connections.receiveInvitation(invitation);

    aliceAgentConnection = await aliceAgent.connections.returnWhenIsConnected(aliceAgentConnection.id);

    bobAgentConnection = await bobAgent.connections.returnWhenIsConnected(bobAgentConnection.id);

    expect(aliceAgentConnection).toBeConnectedWith(bobAgentConnection);
    expect(bobAgentConnection).toBeConnectedWith(aliceAgentConnection);

    // We save this verkey to send message via this connection in the following test
    aliceAtAliceBobId = aliceAgentConnection.id;
  });

  test('Send a message from Alice to Bob via mediator', async () => {
    // send message from Alice to Bob
    const aliceConnectionAtAliceBob = await aliceAgent.connections.find(aliceAtAliceBobId);
    if (!aliceConnectionAtAliceBob) {
      throw new Error(`There is no connection for id ${aliceAtAliceBobId}`);
    }

    testLogger.test('aliceConnectionAtAliceBob\n', aliceConnectionAtAliceBob);

    const message = 'hello, world';
    await aliceAgent.basicMessages.sendMessage(aliceConnectionAtAliceBob, message);

    const basicMessage = await waitForBasicMessage(bobAgent, {
      content: message,
    });

    expect(basicMessage.content).toBe(message);
  });
});

class PollingInboundTransporter implements InboundTransporter {
  public stop: boolean;

  public constructor() {
    this.stop = false;
  }
  public async start(agent: Agent) {
    await this.registerMediator(agent);
  }

  public async registerMediator(agent: Agent) {
    const mediatorUrl = agent.getMediatorUrl() || '';
    const mediatorInvitationUrl = await get(`${mediatorUrl}/invitation`);
    const { verkey: mediatorVerkey } = JSON.parse(await get(`${mediatorUrl}/`));
    await agent.routing.provision({ verkey: mediatorVerkey, invitationUrl: mediatorInvitationUrl });
    this.pollDownloadMessages(agent);
  }

  private pollDownloadMessages(agent: Agent) {
    new Promise(async () => {
      while (!this.stop) {
        const downloadedMessages = await agent.routing.downloadMessages();
        const messages = [...downloadedMessages];
        testLogger.test('downloaded messages', messages);
        while (messages && messages.length > 0) {
          const message = messages.shift();
          await agent.receiveMessage(message);
        }

        await sleep(1000);
      }
    });
  }
}

class HttpOutboundTransporter implements OutboundTransporter {
  public async sendMessage(outboundPackage: OutboundPackage, receiveReply: boolean) {
    const { payload, endpoint } = outboundPackage;

    if (!endpoint) {
      throw new Error(`Missing endpoint. I don't know how and where to send the message.`);
    }

    testLogger.test(`Sending outbound message to connection ${outboundPackage.connection.id}`, outboundPackage.payload);

    if (receiveReply) {
      const response = await post(`${endpoint}`, JSON.stringify(payload));
      const wireMessage = JSON.parse(response);
      testLogger.test('received response', wireMessage);
      return wireMessage;
    } else {
      await post(`${endpoint}`, JSON.stringify(payload));
    }
  }
}
