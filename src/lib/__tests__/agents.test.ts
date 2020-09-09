// eslint-disable-next-line
// @ts-ignore
import { poll } from 'await-poll';
import { Subject } from 'rxjs';
import { Agent } from '..';
import { toBeConnectedWith, SubjectInboundTransporter, SubjectOutboundTransporter } from './helpers';
import { InitConfig, WireMessage } from '../types';
import indy from 'indy-sdk';

expect.extend({ toBeConnectedWith });

const aliceConfig: InitConfig = {
  label: 'Alice',
  walletConfig: { id: 'alice' },
  walletCredentials: { key: '00000000000000000000000000000Test01' },
  autoAcceptConnections: true,
};

const bobConfig: InitConfig = {
  label: 'Bob',
  walletConfig: { id: 'bob' },
  walletCredentials: { key: '00000000000000000000000000000Test02' },
  autoAcceptConnections: true,
};

describe('agents', () => {
  let aliceAgent: Agent;
  let bobAgent: Agent;

  afterAll(async () => {
    await aliceAgent.closeAndDeleteWallet();
    await bobAgent.closeAndDeleteWallet();
  });

  test('make a connection between agents', async () => {
    const aliceMessages = new Subject();
    const bobMessages = new Subject();

    const aliceAgentInbound = new SubjectInboundTransporter(aliceMessages);
    const aliceAgentOutbound = new SubjectOutboundTransporter(bobMessages);
    const bobAgentInbound = new SubjectInboundTransporter(bobMessages);
    const bobAgentOutbound = new SubjectOutboundTransporter(aliceMessages);

    aliceAgent = new Agent(aliceConfig, aliceAgentInbound, aliceAgentOutbound, indy);
    await aliceAgent.init();

    bobAgent = new Agent(bobConfig, bobAgentInbound, bobAgentOutbound, indy);
    await bobAgent.init();

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
  });

  test('send a message to connection', async () => {
    const aliceConnections = await aliceAgent.connections.getAll();
    console.log('aliceConnections', aliceConnections);

    const bobConnections = await bobAgent.connections.getAll();
    console.log('bobConnections', bobConnections);

    // send message from Alice to Bob
    const lastAliceConnection = aliceConnections[aliceConnections.length - 1];
    console.log('lastAliceConnection\n', lastAliceConnection);

    const message = 'hello, world';
    await aliceAgent.basicMessages.sendMessage(lastAliceConnection, message);

    const bobMessages = await poll(
      async () => {
        console.log(`Getting Bob's messages from Alice...`);
        const messages = await bobAgent.basicMessages.findAllByQuery({
          from: lastAliceConnection.did,
          to: lastAliceConnection.theirDid,
        });
        return messages;
      },
      (messages: WireMessage[]) => messages.length < 1
    );
    const lastMessage = bobMessages[bobMessages.length - 1];
    expect(lastMessage.content).toBe(message);
  });
});
