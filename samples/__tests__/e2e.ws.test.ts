// eslint-disable-next-line
// @ts-ignore
import io from 'socket.io-client';
import { Agent, InboundTransporter, OutboundTransporter } from '../../src';
import { OutboundPackage, InitConfig, WireMessage } from '../../src/types';
import { get, post } from '../http';
import { toBeConnectedWith, waitForBasicMessage } from '../../src/__tests__/helpers';
import indy from 'indy-sdk';
// import logger from '../../src/__tests__/logger';
import { ConsoleLogger, LogLevel } from '../../src/logger';
import { Socket } from 'socket.io';
import { HttpTransport, WebSocketTransport } from '../../src/agent/TransportService';

const logger = new ConsoleLogger(LogLevel.test);

expect.extend({ toBeConnectedWith });

const aliceConfig: InitConfig = {
  label: 'e2e Alice',
  mediatorUrl: 'http://localhost:3001',
  walletConfig: { id: 'e2e-alice-ws' },
  walletCredentials: { key: '00000000000000000000000000000Test01' },
  autoAcceptConnections: true,
  logger,
  indy,
};

const bobConfig: InitConfig = {
  label: 'e2e Bob',
  mediatorUrl: 'http://localhost:3002',
  walletConfig: { id: 'e2e-bob-ws' },
  walletCredentials: { key: '00000000000000000000000000000Test02' },
  autoAcceptConnections: true,
  logger,
  indy,
};

describe('with mediator via websockets', () => {
  let aliceAgent: Agent;
  let bobAgent: Agent;
  let aliceAtAliceBobId: string;

  afterAll(async () => {
    (aliceAgent.inboundTransporter as WsInboundTransporter).stop();
    (bobAgent.inboundTransporter as WsInboundTransporter).stop();

    // Wait for messages to flush out
    await new Promise(r => setTimeout(r, 1000));

    await aliceAgent.closeAndDeleteWallet();
    await bobAgent.closeAndDeleteWallet();
  });

  test('Alice and Bob make a connection with mediator', async () => {
    console.log('Connection to WebSocket');
    const socket: any = await createSocketConnection(aliceConfig.mediatorUrl);
    const socket2: any = await createSocketConnection(bobConfig.mediatorUrl);

    const aliceAgentReceiver = new WsInboundTransporter(socket);
    const aliceAgentSender = new WsOutboundTransporter();
    const bobAgentReceiver = new WsInboundTransporter(socket2);
    const bobAgentSender = new WsOutboundTransporter();

    aliceAgent = new Agent(aliceConfig, aliceAgentReceiver, aliceAgentSender);
    await aliceAgent.init();

    bobAgent = new Agent(bobConfig, bobAgentReceiver, bobAgentSender);
    await bobAgent.init();

    const aliceInbound = aliceAgent.routing.getInboundConnection();
    const aliceInboundConnection = aliceInbound?.connection;
    const aliceKeyAtAliceMediator = aliceInboundConnection?.verkey;
    logger.test('aliceInboundConnection', aliceInboundConnection);

    const bobInbound = bobAgent.routing.getInboundConnection();
    const bobInboundConnection = bobInbound?.connection;
    const bobKeyAtBobMediator = bobInboundConnection?.verkey;
    logger.test('bobInboundConnection', bobInboundConnection);

    // TODO This endpoint currently exists at mediator only for the testing purpose. It returns mediator's part of the pairwise connection.
    const mediatorConnectionAtAliceMediator = JSON.parse(
      await get(`${aliceAgent.getMediatorUrl()}/api/connections/${aliceKeyAtAliceMediator}`)
    );
    const mediatorConnectionAtBobMediator = JSON.parse(
      await get(`${bobAgent.getMediatorUrl()}/api/connections/${bobKeyAtBobMediator}`)
    );

    logger.test('mediatorConnectionAtAliceMediator', mediatorConnectionAtAliceMediator);
    logger.test('mediatorConnectionAtBobMediator', mediatorConnectionAtBobMediator);

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

    logger.test('aliceConnectionAtAliceBob\n', aliceConnectionAtAliceBob);

    const message = 'hello, world';
    await aliceAgent.basicMessages.sendMessage(aliceConnectionAtAliceBob, message);

    const basicMessage = await waitForBasicMessage(bobAgent, {
      content: message,
    });

    expect(basicMessage.content).toBe(message);
  });
});

function createSocketConnection(mediatorUrl: string | undefined) {
  if (!mediatorUrl) {
    throw new Error('Mediator URL is missing.');
  }
  return new Promise((resolve, reject) => {
    console.log('Connecting to mediator via WebSocket');
    const socket = io(mediatorUrl);
    socket.on('connect', () => {
      console.log('Client connected');
      resolve(socket);
    });
    socket.on('connect_error', (e: Error) => {
      console.log('Client connection failed');
      reject(e);
    });
  });
}

class WsInboundTransporter implements InboundTransporter {
  private socket: any;

  public constructor(socket: any) {
    this.socket = socket;
  }

  public async start(agent: Agent) {
    // TODO align edge agent inbound tranporters
    const mediatorUrl = agent.getMediatorUrl() || '';
    const mediatorInvitationUrl = await get(`${mediatorUrl}/invitation`);
    const { verkey: mediatorVerkey } = JSON.parse(await get(`${mediatorUrl}/`));

    const transport = new WebSocketTransport(this.socket);
    await agent.routing.provision({
      verkey: mediatorVerkey,
      invitationUrl: mediatorInvitationUrl,
      transport,
    });

    this.socket.on('agentMessage', (payload: any) => {
      console.log('on agentMessage', payload);
      agent.receiveMessage(payload);
    });
  }

  public stop() {
    this.socket.close();
  }
}

class WsOutboundTransporter implements OutboundTransporter {
  public async sendMessage(outboundPackage: OutboundPackage, receiveReply: boolean) {
    logger.debug('WsOutboundTransporter sendMessage');
    const { payload, transport } = outboundPackage;

    // TODO Replace this logic with multiple transporters
    if (transport instanceof WebSocketTransport && transport?.socket?.connected) {
      return this.sendViaWebSocket(transport, payload, receiveReply);
    } else if (transport instanceof HttpTransport) {
      return this.sendViaHttp(transport, payload, receiveReply);
    } else {
      throw new Error(`Unhandled transport ${transport}.`);
    }
  }

  private async sendViaWebSocket(transport: WebSocketTransport, payload: WireMessage, receiveReply: boolean) {
    const { socket } = transport;
    logger.debug('Sending message over ws...', { transport: { type: transport?.type, socketId: socket?.id } });

    if (!socket?.connected) {
      throw new Error('Socket is not available or connected.');
    }

    if (receiveReply) {
      const response: any = await this.emitMessage(socket, payload);
      logger.debug('response', response);
      const wireMessage = response;
      logger.debug('wireMessage', wireMessage);
      return wireMessage;
    } else {
      this.emitMessage(socket, payload);
    }
  }

  private async emitMessage(socket: Socket, payload: any) {
    return new Promise((resolve, reject) => {
      console.log('emit agentMessage', payload);
      socket.emit('agentMessage', payload, (response: any) => {
        resolve(response);
      });
    });
  }

  private async sendViaHttp(transport: HttpTransport, payload: WireMessage, receiveReply: boolean) {
    const { endpoint } = transport;
    logger.debug('Sending message over http...', { transport: { type: transport?.type, endpoint } });

    if (!endpoint) {
      throw new Error(`Missing endpoint. I don't know how and where to send the message.`);
    }

    if (receiveReply) {
      const response = await post(`${endpoint}`, JSON.stringify(payload));
      const wireMessage = JSON.parse(response);
      logger.debug('received response', wireMessage);
      return wireMessage;
    } else {
      await post(`${endpoint}`, JSON.stringify(payload));
    }
  }
}
