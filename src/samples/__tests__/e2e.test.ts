/* eslint-disable no-console */
// @ts-ignore
import { poll } from 'await-poll';
import { Agent, InboundTransporter, OutboundTransporter } from '../../lib';
import { WireMessage, OutboundPackage } from '../../lib/types';
import { get, post } from '../http';
import { toBeConnectedWith } from '../../lib/testUtils';
import indy from 'indy-sdk';

jest.setTimeout(15000);

expect.extend({ toBeConnectedWith });

const aliceConfig = {
  label: 'e2e Alice',
  agencyUrl: 'http://localhost:3001',
  walletConfig: { id: 'e2e-alice' },
  walletCredentials: { key: '00000000000000000000000000000Test01' },
};

const bobConfig = {
  label: 'e2e Bob',
  agencyUrl: 'http://localhost:3002',
  walletConfig: { id: 'e2e-bob' },
  walletCredentials: { key: '00000000000000000000000000000Test02' },
};

describe('with agency', () => {
  let aliceAgent: Agent;
  let bobAgent: Agent;
  let aliceAtAliceBobVerkey: Verkey;

  afterAll(async () => {
    (aliceAgent.inboundTransporter as PollingInboundTransporter).stop = true;
    (bobAgent.inboundTransporter as PollingInboundTransporter).stop = true;

    // Wait for messages to flush out
    await new Promise(r => setTimeout(r, 1000));

    await aliceAgent.closeAndDeleteWallet();
    await bobAgent.closeAndDeleteWallet();
  });

  test('Alice and Bob make a connection with agency', async () => {
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
    const aliceKeyAtAliceAgency = aliceInboundConnection && aliceInboundConnection.verkey;
    console.log('aliceInboundConnection', aliceInboundConnection);

    const bobInbound = bobAgent.routing.getInboundConnection();
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

    console.log('agencyConnectionAtAliceAgency', agencyConnectionAtAliceAgency);
    console.log('agencyConnectionAtBobAgency', agencyConnectionAtBobAgency);

    expect(aliceInboundConnection).toBeConnectedWith(agencyConnectionAtAliceAgency);
    expect(bobInboundConnection).toBeConnectedWith(agencyConnectionAtBobAgency);
  });

  test('Alice and Bob make a connection via agency', async () => {
    const aliceConnectionAtAliceBob = await aliceAgent.connections.createConnection();
    const { invitation } = aliceConnectionAtAliceBob;

    if (!invitation) {
      throw new Error('There is no invitation in newly created connection!');
    }

    const bobConnectionAtBobAlice = await bobAgent.connections.acceptInvitation(invitation);

    const aliceConnectionRecordAtAliceBob = await aliceAgent.connections.returnWhenIsConnected(
      aliceConnectionAtAliceBob.connection.verkey
    );
    if (!aliceConnectionRecordAtAliceBob) {
      throw new Error('Connection not found!');
    }

    const bobConnectionRecordAtBobAlice = await bobAgent.connections.returnWhenIsConnected(
      bobConnectionAtBobAlice.verkey
    );
    if (!bobConnectionRecordAtBobAlice) {
      throw new Error('Connection not found!');
    }

    expect(aliceConnectionRecordAtAliceBob).toBeConnectedWith(bobConnectionRecordAtBobAlice);
    expect(bobConnectionRecordAtBobAlice).toBeConnectedWith(aliceConnectionRecordAtAliceBob);

    // We save this verkey to send message via this connection in the following test
    aliceAtAliceBobVerkey = aliceConnectionAtAliceBob.connection.verkey;
  });

  test('Send a message from Alice to Bob via agency', async () => {
    // send message from Alice to Bob
    const aliceConnectionAtAliceBob = await aliceAgent.connections.findConnectionByVerkey(aliceAtAliceBobVerkey);
    if (!aliceConnectionAtAliceBob) {
      throw new Error(`There is no connection for verkey ${aliceAtAliceBobVerkey}`);
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
  stop: boolean;

  constructor() {
    this.stop = false;
  }
  async start(agent: Agent) {
    await this.registerAgency(agent);
  }

  async registerAgency(agent: Agent) {
    const agencyUrl = agent.getAgencyUrl() || '';
    const agencyInvitationUrl = await get(`${agencyUrl}/invitation`);
    const { verkey: agencyVerkey } = JSON.parse(await get(`${agencyUrl}/`));
    await agent.routing.provision({ verkey: agencyVerkey, invitationUrl: agencyInvitationUrl });
    this.pollDownloadMessages(agent);
  }

  pollDownloadMessages(agent: Agent) {
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
  async sendMessage(outboundPackage: OutboundPackage, receiveReply: boolean) {
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
