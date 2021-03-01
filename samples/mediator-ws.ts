import { createServer } from 'http';
import Server, { Socket } from 'socket.io';
import express, { Express } from 'express';
import cors from 'cors';
import config from './config';
// import logger from '../../src/__tests__/logger';
import { ConsoleLogger, LogLevel } from '../src/logger';
import { Agent, ConnectionRecord, InboundTransporter, OutboundTransporter } from '../src';
import { OutboundPackage, WireMessage } from '../src/types';
import { MessageRepository } from '../src/storage/MessageRepository';
import { InMemoryMessageRepository } from '../src/storage/InMemoryMessageRepository';
import { Transport } from '../src/agent/TransportService';

const logger = new ConsoleLogger(LogLevel.trace);

class WsInboundTransporter implements InboundTransporter {
  private io: any;
  private app: Express;

  public constructor(io: any, app: Express) {
    this.io = io;
    this.app = app;
  }

  public start(agent: Agent): void {
    // websocket transport
    this.io.on('connection', (socket: any) => {
      logger.debug('Socket connected.');

      socket.on('agentMessage', async (payload: any, callback: (args: any) => any) => {
        logger.debug('on agentMessage', payload);
        const transport = {
          type: 'ws',
          socket,
        } as const;
        const outboundMessage = await agent.receiveMessage(payload, transport);
        if (outboundMessage) {
          callback(outboundMessage.payload);
        }
      });

      socket.on('disconnect', () => {
        logger.debug('Socket disconnected.');
      });
    });

    // http transport
    this.app.post('/msg', async (req, res) => {
      const message = req.body;
      const packedMessage = JSON.parse(message);
      const outboundMessage = await agent.receiveMessage(packedMessage);
      if (outboundMessage) {
        res.status(200).json(outboundMessage.payload).end();
      } else {
        res.status(200).end();
      }
    });
  }
}

class WsOutboundTransporter implements OutboundTransporter {
  public messages: { [key: string]: any } = {};
  private messageRepository: MessageRepository;

  public constructor(messageRepository: MessageRepository) {
    this.messageRepository = messageRepository;
  }

  public async sendMessage(outboundPackage: OutboundPackage, receiveReply: boolean) {
    const { connection, payload, transport } = outboundPackage;
    logger.debug('WsOutboundTransporter sendMessage', {
      connection,
      payload,
      transport: { type: transport?.type, socketId: transport?.socket?.id },
    });

    if (transport?.socket?.connected) {
      return this.sendViaWebSocket(transport, payload, receiveReply);
    } else {
      return this.storeMessageForPickup(connection, payload);
    }
  }

  private async sendViaWebSocket(transport: Transport, payload: WireMessage, receiveReply: boolean) {
    logger.debug('Sending message over ws...');
    const { socket } = transport;

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
      logger.debug('emit agentMessage', payload);
      socket.emit('agentMessage', payload, (response: any) => {
        resolve(response);
      });
    });
  }

  private storeMessageForPickup(connection: ConnectionRecord, payload: WireMessage) {
    if (!connection) {
      throw new Error(`Missing connection. I don't know where to send the message.`);
    }

    if (!connection.theirKey) {
      throw new Error('Trying to save message without theirKey!');
    }

    logger.debug('No socket connected. Saving message for batch download...');
    this.messageRepository.save(connection.theirKey, payload);
  }
}

const PORT = config.port;
const app = express();

const httpServer = createServer(app);
const io = Server(httpServer);

app.use(cors());
app.use(
  express.text({
    type: ['application/ssi-agent-wire', 'text/plain'],
  })
);
app.set('json spaces', 2);

const messageRepository = new InMemoryMessageRepository();
const messageSender = new WsOutboundTransporter(messageRepository);
const messageReceiver = new WsInboundTransporter(io, app);
const agent = new Agent(config, messageReceiver, messageSender, messageRepository);

app.get('/', async (req, res) => {
  const agentDid = agent.publicDid;
  res.send(agentDid);
});

// Create new invitation as inviter to invitee
app.get('/invitation', async (req, res) => {
  const { invitation } = await agent.connections.createConnection();

  res.send(invitation.toUrl());
});

app.get('/api/connections/:verkey', async (req, res) => {
  // TODO This endpoint is for testing purpose only. Return mediator connection by their verkey.
  const verkey = req.params.verkey;
  const connection = await agent.connections.findConnectionByTheirKey(verkey);
  res.send(connection);
});

app.get('/api/connections', async (req, res) => {
  // TODO This endpoint is for testing purpose only. Return mediator connection by their verkey.
  const connections = await agent.connections.getAll();
  res.json(connections);
});

app.get('/api/routes', async (req, res) => {
  // TODO This endpoint is for testing purpose only. Return mediator connection by their verkey.
  const routes = agent.routing.getRoutingTable();
  res.send(routes);
});

app.get('/api/messages', async (req, res) => {
  // TODO This endpoint is for testing purpose only.
  res.send(messageSender.messages);
});

httpServer.listen(PORT, async () => {
  await agent.init();
  messageReceiver.start(agent);
  logger.debug(`Application started on port ${PORT}`);
});
