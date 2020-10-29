// eslint-disable-next-line
// @ts-ignore
import { poll } from 'await-poll';
import { Agent, InboundTransporter, OutboundTransporter } from '../../lib';
import { WireMessage, OutboundPackage, InitConfig } from '../../lib/types';
import { get, post } from '../http';
import { toBeConnectedWith } from '../../lib/__tests__/helpers';
import indy from 'indy-sdk';

expect.extend({ toBeConnectedWith });

const aliceConfig: InitConfig = {
  label: 'e2e Alice',
  mediatorUrl: 'http://localhost:3001',
  walletConfig: { id: 'e2e-alice' },
  walletCredentials: { key: '00000000000000000000000000000Test01' },
  autoAcceptConnections: true,
};

const bobConfig: InitConfig = {
  label: 'e2e Bob',
  mediatorUrl: 'http://localhost:3002',
  walletConfig: { id: 'e2e-bob' },
  walletCredentials: { key: '00000000000000000000000000000Test02' },
  autoAcceptConnections: true,
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

    aliceAgent = new Agent(aliceConfig, aliceAgentReceiver, aliceAgentSender, indy);
    await aliceAgent.init();

    bobAgent = new Agent(bobConfig, bobAgentReceiver, bobAgentSender, indy);
    await bobAgent.init();

    const aliceInbound = aliceAgent.routing.getInboundConnection();
    const aliceInboundConnection = aliceInbound && aliceInbound.connection;
    const aliceKeyAtAliceMediator = aliceInboundConnection && aliceInboundConnection.verkey;
    console.log('aliceInboundConnection', aliceInboundConnection);

    const bobInbound = bobAgent.routing.getInboundConnection();
    const bobInboundConnection = bobInbound && bobInbound.connection;
    const bobKeyAtBobMediator = bobInboundConnection && bobInboundConnection.verkey;
    console.log('bobInboundConnection', bobInboundConnection);

    // TODO This endpoint currently exists at mediator only for the testing purpose. It returns mediator's part of the pairwise connection.
    const mediatorConnectionAtAliceMediator = JSON.parse(
      await get(`${aliceAgent.getMediatorUrl()}/api/connections/${aliceKeyAtAliceMediator}`)
    );
    const mediatorConnectionAtBobMediator = JSON.parse(
      await get(`${bobAgent.getMediatorUrl()}/api/connections/${bobKeyAtBobMediator}`)
    );

    console.log('mediatorConnectionAtAliceMediator', mediatorConnectionAtAliceMediator);
    console.log('mediatorConnectionAtBobMediator', mediatorConnectionAtBobMediator);

    expect(aliceInboundConnection).toBeConnectedWith(mediatorConnectionAtAliceMediator);
    expect(bobInboundConnection).toBeConnectedWith(mediatorConnectionAtBobMediator);
  });

  test('Alice and Bob make a connection via mediator', async () => {
    const aliceConnectionAtAliceBob = await aliceAgent.connections.createConnection();

    if (!aliceConnectionAtAliceBob.invitation) {
      throw new Error('There is no invitation in newly created connection!');
    }

    const bobConnectionAtBobAlice = await bobAgent.connections.receiveInvitation(
      aliceConnectionAtAliceBob.invitation.toJSON()
    );

    const aliceConnectionRecordAtAliceBob = await aliceAgent.connections.returnWhenIsConnected(
      aliceConnectionAtAliceBob.id
    );
    if (!aliceConnectionRecordAtAliceBob) {
      throw new Error('Connection not found!');
    }

    const bobConnectionRecordAtBobAlice = await bobAgent.connections.returnWhenIsConnected(bobConnectionAtBobAlice.id);
    if (!bobConnectionRecordAtBobAlice) {
      throw new Error('Connection not found!');
    }

    expect(aliceConnectionRecordAtAliceBob).toBeConnectedWith(bobConnectionRecordAtBobAlice);
    expect(bobConnectionRecordAtBobAlice).toBeConnectedWith(aliceConnectionRecordAtAliceBob);

    // We save this verkey to send message via this connection in the following test
    aliceAtAliceBobId = aliceConnectionAtAliceBob.id;
  });

  test('Send a message from Alice to Bob via mediator', async () => {
    // send message from Alice to Bob
    const aliceConnectionAtAliceBob = await aliceAgent.connections.find(aliceAtAliceBobId);
    if (!aliceConnectionAtAliceBob) {
      throw new Error(`There is no connection for id ${aliceAtAliceBobId}`);
    }

    console.log('aliceConnectionAtAliceBob\n', aliceConnectionAtAliceBob);

    const message = 'hello, world';
    await aliceAgent.basicMessages.sendMessage(aliceConnectionAtAliceBob, message);

    const bobMessages = await poll(
      async () => {
        console.log(`Getting Bob's messages from Alice...`);
        const messages = await bobAgent.basicMessages.findAllByQuery({
          from: aliceConnectionAtAliceBob.did,
          to: aliceConnectionAtAliceBob.theirDid,
        });
        return messages;
      },
      (messages: WireMessage[]) => messages.length < 1,
      1000
    );
    const lastMessage = bobMessages[bobMessages.length - 1];
    expect(lastMessage.content).toBe(message);
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
    poll(
      async () => {
        const downloadedMessages = await agent.routing.downloadMessages();
        const messages = [...downloadedMessages];
        console.log('downloaded messges', messages);
        while (messages && messages.length > 0) {
          const message = messages.shift();
          await agent.receiveMessage(message);
        }
      },
      () => !this.stop,
      1000
    );
  }
}

class HttpOutboundTransporter implements OutboundTransporter {
  public async sendMessage(outboundPackage: OutboundPackage, receiveReply: boolean) {
    const { payload, endpoint } = outboundPackage;

    if (!endpoint) {
      throw new Error(`Missing endpoint. I don't know how and where to send the message.`);
    }

    console.log('Sending message...');
    console.log(payload);

    if (receiveReply) {
      const response = await post(`${endpoint}`, JSON.stringify(payload));
      console.log('response', response);
      const wireMessage = JSON.parse(response);
      console.log('wireMessage', wireMessage);
      return wireMessage;
    } else {
      await post(`${endpoint}`, JSON.stringify(payload));
    }
  }
}
