import express, { Express } from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import {
  Agent,
  InboundTransporter,
  OutboundTransporter,
  OutboundPackage,
  InitConfig,
  ConnectionEventType,
  ConnectionStateChangedEvent,
  LogLevel,
} from '../src';
import testLogger, { TestLogger } from '../src/__tests__/logger';
import indy from 'indy-sdk';
import { resolve } from 'path';
import { MediationEventType, MediationStateChangedEvent } from '../src/modules/routing/services/MediationService';
import { MediationState } from '../src/modules/routing/models/MediationState';
import { InMemoryMessageRepository } from '../src/storage/InMemoryMessageRepository';
import { MessageRepository } from '../src/storage/MessageRepository';

class HttpInboundTransporter implements InboundTransporter {
  private app: Express;

  public constructor(app: Express) {
    this.app = app;
  }

  public start(agent: Agent) {
    this.app.post('/msg', async (req, res) => {
      const message = req.body;
      const packedMessage = JSON.parse(message);

      try {
        const outboundMessage = await agent.receiveMessage(packedMessage);
        if (outboundMessage) {
          res.status(200).json(outboundMessage.payload).end();
        } else {
          res.status(200).end();
        }
      } catch (e) {
        testLogger.debug('Error: ' + e);
        res.status(200).end();
      }
    });
  }
}

class HttpOutboundTransporter implements OutboundTransporter {
  private messageRepository: MessageRepository;

  public constructor(messageRepository: MessageRepository) {
    this.messageRepository = messageRepository;
  }

  public async sendMessage(outboundPackage: OutboundPackage, receiveReply: boolean) {
    const { connection, payload, endpoint } = outboundPackage;

    if (!endpoint) {
      throw new Error(`Missing endpoint. I don't know how and where to send the message.`);
    }

    try {
      if (endpoint == 'didcomm:transport/queue') {
        testLogger.debug('Storing message for queue: ', { connection, payload });
        this.messageRepository.save(connection.theirKey!, payload);
        return;
      }

      if (receiveReply) {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/ssi-agent-wire',
          },
          body: JSON.stringify(payload),
        });

        const data = await response.text();
        const wireMessage = JSON.parse(data);
        return wireMessage;
      } else {
      }
    } catch (e) {
      testLogger.debug('error sending message', e);
      throw e;
    }
  }
}

const agentConfig: InitConfig = {
  host: process.env.AGENT_HOST,
  port: process.env.AGENT_PORT || 3001,
  poolName: 'local-js',
  genesisPath: resolve(process.env.GENESIS_TXN_PATH!),
  endpoint: process.env.AGENT_ENDPOINT,
  label: process.env.AGENT_LABEL || '',
  walletConfig: { id: process.env.WALLET_NAME || '' },
  walletCredentials: { key: process.env.WALLET_KEY || '' },
  publicDid: process.env.PUBLIC_DID || '',
  publicDidSeed: process.env.PUBLIC_DID_SEED || '',
  mediatorRecordId: process.env.MEDIATOR_RECORD_ID || '',
  autoAcceptConnections: true,
  logger: new TestLogger(LogLevel.debug),
  indy: indy,
};

const PORT = Number(agentConfig.port);
const app = express();

app.use(cors());
app.use(express.json());
app.use(
  express.text({
    type: ['application/ssi-agent-wire', 'text/plain'],
  })
);
app.set('json spaces', 2);

const messageRepository = new InMemoryMessageRepository();
const messageSender = new HttpOutboundTransporter(messageRepository);
const messageReceiver = new HttpInboundTransporter(app);

const agent = new Agent(agentConfig, messageReceiver, messageSender, messageRepository);

agent.connections.events.on(ConnectionEventType.StateChanged, async (event: ConnectionStateChangedEvent) => {
  testLogger.info('Connection state changed for ' + event.connectionRecord.id);
  testLogger.debug('Previous state: ' + event.previousState + ' New state: ' + event.connectionRecord.state);
});

agent.routing.mediationEvents.on(MediationEventType.StateChanged, async (event: MediationStateChangedEvent) => {
  testLogger.info('Mediation state changed for ' + event.mediationRecord.id);
  testLogger.debug('Previous state: ' + event.previousState + ' New state: ' + event.mediationRecord.state);

  if (event.mediationRecord.state == MediationState.Requested) {
    const connectionRecord = await agent.connections.getById(event.mediationRecord.connectionId);
    if (connectionRecord) {
      testLogger.info('Mediation blindly granted');
    }
  }
});

// Create new invitation as inviter to invitee
app.get('/invitation', async (req, res) => {
  const { invitation } = await agent.connections.createConnection();
  res.send(invitation.toJSON());
});

// Receive invitation and assign an alias
app.post('/receive-invitation', async (req, res) => {
  try {
    const invitation = req.body.invitation;
    const alias = req.body.alias;

    if (!alias || !invitation) {
      throw new Error('Missing parameter in body. Format: {"alias": ..., "invitation": ... }');
    }

    const result = await agent.connections.receiveInvitation(invitation, { autoAcceptConnection: true, alias: alias });

    res.send(result);
  } catch (e) {
    res.status(500);
    testLogger.debug('Error: ' + e);
    res.send('Error: ' + e);
  }
});

app.get('/connections', async (req, res) => {
  const connections = await agent.connections.getAll();
  res.json(connections);
});

app.get('/credentials', async (req, res) => {
  const credentials = await agent.credentials.getAll();
  res.json(credentials);
});

app.listen(PORT, '0.0.0.0', 0, async () => {
  await agent.init();
  messageReceiver.start(agent);
  testLogger.debug(`JavaScript Edge Agent started on port ${PORT}`);
});
