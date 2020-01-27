/* eslint-disable no-console */
// @ts-ignore
import { poll } from 'await-poll';
import { Agent, decodeInvitationFromUrl, InboundTransporter, OutboundTransporter, Connection } from '../../lib';
import { WireMessage, OutboundPackage } from '../../lib/types';
import { get, post } from '../http';
import { toBeConnectedWith } from '../../lib/testUtils';

jest.setTimeout(15000);

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

describe('with agency', () => {
  let aliceAgent: Agent;
  let bobAgent: Agent;

  afterAll(async () => {
    (aliceAgent.inboundTransporter as PollingInboundTransporter).stop = true;
    (bobAgent.inboundTransporter as PollingInboundTransporter).stop = true;

    // Wait for messages to flush out
    await new Promise(r => setTimeout(r, 1000));
  });

  test('make a connection with agency', async () => {
    const aliceAgentSender = new HttpOutboundTransporter();
    const aliceAgentReceiver = new PollingInboundTransporter();
    const bobAgentSender = new HttpOutboundTransporter();
    const bobAgentReceiver = new PollingInboundTransporter();

    aliceAgent = new Agent(aliceConfig, aliceAgentReceiver, aliceAgentSender);
    await aliceAgent.init();

    bobAgent = new Agent(bobConfig, bobAgentReceiver, bobAgentSender);
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

  test('send a message to connection via agency', async () => {
    const aliceConnections = await aliceAgent.getConnections();
    console.log('aliceConnections', JSON.stringify(aliceConnections, null, 2));

    const bobConnections = await bobAgent.getConnections();
    console.log('bobConnections', JSON.stringify(bobConnections, null, 2));

    // send message from Alice to Bob
    const message = 'hello, world';
    await aliceAgent.sendMessageToConnection(aliceConnections[1], message);

    const bobMessages = await poll(
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
    const agentKeyAtAgency = await agent.acceptInvitationUrl(agencyInvitationUrl);

    this.pollMessages(agent, agencyUrl, agentKeyAtAgency);

    const agentConnectionAtAgency = agent.findConnectionByMyKey(agentKeyAtAgency);
    if (!agentConnectionAtAgency) {
      throw new Error('Connection not found!');
    }
    await agentConnectionAtAgency.isConnected();
    console.log('agentConnectionAtAgency\n', agentConnectionAtAgency);

    const { verkey: agencyVerkey } = JSON.parse(await get(`${agencyUrl}/`));
    agent.establishInbound(agencyVerkey, agentConnectionAtAgency);
  }

  pollMessages(agent: Agent, agencyUrl: string, verkey: Verkey) {
    poll(
      async () => {
        const message = await get(`${agencyUrl}/api/connections/${verkey}/message`);
        if (message && message.length > 0) {
          agent.receiveMessage(JSON.parse(message));
        }
      },
      () => !this.stop,
      100
    );
  }
}

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
