/* eslint-disable no-console */
// @ts-ignore
import { poll } from 'await-poll';
import { Agent, decodeInvitationFromUrl, InboundTransporter, OutboundTransporter } from '../../lib';
import { Connection, WireMessage, OutboundPackage } from '../../lib/types';
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

    expect(aliceInboundConnection).toBeConnectedWith(agencyConnectionAtAliceAgency);
    expect(bobInboundConnection).toBeConnectedWith(agencyConnectionAtBobAgency);
  });

  test('make a connection via agency', async () => {
    const invitationUrl = await aliceAgent.createInvitationUrl();
    await bobAgent.acceptInvitationUrl(invitationUrl);

    // We need to decode invitation URL to get keys from invitation
    // It can be maybe better to get connection ID instead of invitationUrl from the previous step and work with that
    const invitation = decodeInvitationFromUrl(invitationUrl);
    const aliceKeyAtAliceBob = invitation.recipientKeys[0];

    const aliceConnectionAtAliceBob = await poll(
      () => aliceAgent.findConnectionByMyKey(aliceKeyAtAliceBob),
      (connection: Connection) => connection.state !== 4,
      200
    );
    console.log('aliceConnectionAtAliceBob\n', aliceConnectionAtAliceBob);

    const bobKeyAtBobAlice = aliceConnectionAtAliceBob.theirKey;
    const bobConnectionAtBobAlice = await poll(
      () => bobAgent.findConnectionByMyKey(bobKeyAtBobAlice),
      (connection: Connection) => connection.state !== 4,
      200
    );
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
  async start(agent: Agent) {
    await this.registerAgency(agent);
  }

  async registerAgency(agent: Agent) {
    const agencyUrl = agent.getAgencyUrl() || '';
    const agencyInvitationUrl = await get(`${agencyUrl}/invitation`);
    const agentKeyAtAgency = await agent.acceptInvitationUrl(agencyInvitationUrl);

    this.pollMessages(agent, agencyUrl, agentKeyAtAgency);

    const agentConnectionAtAgency = await poll(
      () => agent.findConnectionByMyKey(agentKeyAtAgency),
      (connection: Connection) => connection.state !== 4,
      100
    );

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
      () => true,
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
