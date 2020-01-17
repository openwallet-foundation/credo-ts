import express, { Express } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import config from './config';
import logger from '../lib/logger';
import { Agent, InboundTransporter, OutboundTransporter } from '../lib';
import { OutboundPackage } from '../lib/types';
import { IndyWallet } from '../lib/wallet/IndyWallet';

class HttpInboundTransporter implements InboundTransporter {
  app: Express;

  constructor(app: Express) {
    this.app = app;
  }

  start(agent: Agent) {
    this.app.post('/msg', async (req, res) => {
      const message = req.body;
      const packedMessage = JSON.parse(message);
      await agent.receiveMessage(packedMessage);
      res.status(200).end();
    });
  }
}

class StorageOutboundTransporter implements OutboundTransporter {
  messages: { [key: string]: any } = {};

  async sendMessage(outboundPackage: OutboundPackage) {
    const { connection, payload } = outboundPackage;

    if (!connection) {
      throw new Error(`Missing connection. I don't know how and where to send the message.`);
    }

    if (!connection.theirKey) {
      throw new Error('Trying to save message without theirKey!');
    }

    if (!this.messages[connection.theirKey]) {
      this.messages[connection.theirKey] = [];
    }

    logger.logJson('Storing message', { connection, payload });

    this.messages[connection.theirKey].push(payload);
  }

  takeFirstMessage(verkey: Verkey) {
    if (this.messages[verkey]) {
      return this.messages[verkey].shift();
    }
    return null;
  }
}

const PORT = config.port;
const app = express();

app.use(cors());
app.use(bodyParser.text());
app.set('json spaces', 2);

const messageSender = new StorageOutboundTransporter();
const messageReceiver = new HttpInboundTransporter(app);
const wallet = new IndyWallet({ id: config.walletName }, { key: config.walletKey })
const agent = new Agent(config, messageReceiver, messageSender, wallet);

app.get('/', async (req, res) => {
  const agentDid = agent.getPublicDid();
  res.send(agentDid);
});

// Create new invitation as inviter to invitee
app.get('/invitation', async (req, res) => {
  const invitationUrl = await agent.createInvitationUrl();
  res.send(invitationUrl);
});

app.get('/api/connections/:verkey/message', async (req, res) => {
  const verkey = req.params.verkey;
  const message = messageSender.takeFirstMessage(verkey);
  res.send(message);
});

app.get('/api/connections/:verkey', async (req, res) => {
  // TODO This endpoint is for testing purpose only. Return agency connection by their verkey.
  const verkey = req.params.verkey;
  const connection = agent.findConnectionByTheirKey(verkey);
  res.send(connection);
});

app.get('/api/connections', async (req, res) => {
  // TODO This endpoint is for testing purpose only. Return agency connection by their verkey.
  const connections = agent.getConnections();
  res.json(connections);
});

app.get('/api/routes', async (req, res) => {
  // TODO This endpoint is for testing purpose only. Return agency connection by their verkey.
  const routes = agent.getRoutes();
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
