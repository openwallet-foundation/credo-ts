import express, { Express } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import config from './config';
import logger from '../lib/logger';
import { Agent, InboundTransporter, OutboundTransporter, encodeInvitationToUrl } from '../lib';
import { OutboundPackage } from '../lib/types';
import indy from 'indy-sdk';
import { MessageRepository } from '../lib/storage/MessageRepository';
import { InMemoryMessageRepository } from '../lib/storage/InMemoryMessageRepository';

class HttpInboundTransporter implements InboundTransporter {
  private app: Express;

  public constructor(app: Express) {
    this.app = app;
  }

  public start(agent: Agent) {
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

class StorageOutboundTransporter implements OutboundTransporter {
  public messages: { [key: string]: any } = {};
  private messageRepository: MessageRepository;

  public constructor(messageRepository: MessageRepository) {
    this.messageRepository = messageRepository;
  }

  public async sendMessage(outboundPackage: OutboundPackage) {
    const { connection, payload } = outboundPackage;

    if (!connection) {
      throw new Error(`Missing connection. I don't know how and where to send the message.`);
    }

    if (!connection.theirKey) {
      throw new Error('Trying to save message without theirKey!');
    }

    logger.logJson('Storing message', { connection, payload });

    this.messageRepository.save(connection.theirKey, payload);
  }
}

const PORT = config.port;
const app = express();

app.use(cors());
app.use(bodyParser.text());
app.set('json spaces', 2);

const messageRepository = new InMemoryMessageRepository();
const messageSender = new StorageOutboundTransporter(messageRepository);
const messageReceiver = new HttpInboundTransporter(app);
const agent = new Agent(config, messageReceiver, messageSender, indy, messageRepository);

app.get('/', async (req, res) => {
  const agentDid = agent.getPublicDid();
  res.send(agentDid);
});

// Create new invitation as inviter to invitee
app.get('/invitation', async (req, res) => {
  const connection = await agent.connections.createConnection();
  const { invitation } = connection;

  if (!invitation) {
    throw new Error('There is no invitation in newly created connection!');
  }

  const invitationUrl = encodeInvitationToUrl(invitation);
  res.send(invitationUrl);
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

app.listen(PORT, async () => {
  await agent.init();
  messageReceiver.start(agent);
  logger.log(`Application started on port ${PORT}`);
});
