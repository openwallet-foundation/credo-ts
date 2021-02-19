/* eslint-disable no-console */
import { Subject } from 'rxjs';
import path from 'path';
import indy from 'indy-sdk';
import { Agent, ConnectionRecord } from '..';
import {
  ensurePublicDidIsOnLedger,
  makeConnection,
  registerDefinition,
  registerSchema,
  SubjectInboundTransporter,
  SubjectOutboundTransporter,
  waitForCredentialRecord,
} from './helpers';
import { CredentialRecord } from '../storage/CredentialRecord';
import { CredentialPreview, CredentialPreviewAttribute, CredentialState } from '../protocols/issue-credential';
import { InitConfig } from '../types';
import logger from '../logger';

const genesisPath = process.env.GENESIS_TXN_PATH
  ? path.resolve(process.env.GENESIS_TXN_PATH)
  : path.join(__dirname, '../../../network/genesis/local-genesis.txn');

const faberConfig: InitConfig = {
  label: 'Faber',
  walletConfig: { id: 'credentials-test-faber' },
  walletCredentials: { key: '00000000000000000000000000000Test01' },
  publicDidSeed: process.env.TEST_AGENT_PUBLIC_DID_SEED,
  autoAcceptConnections: true,
  genesisPath,
  poolName: 'credentials-test-faber-pool',
};

const aliceConfig: InitConfig = {
  label: 'Alice',
  walletConfig: { id: 'credentials-test-alice' },
  walletCredentials: { key: '00000000000000000000000000000Test01' },
  autoAcceptConnections: true,
  genesisPath,
  poolName: 'credentials-test-alice-pool',
};

const credentialPreview = new CredentialPreview({
  attributes: [
    new CredentialPreviewAttribute({
      name: 'name',
      mimeType: 'text/plain',
      value: 'John',
    }),
    new CredentialPreviewAttribute({
      name: 'age',
      mimeType: 'text/plain',
      value: '99',
    }),
  ],
});

describe('credentials', () => {
  let faberAgent: Agent;
  let aliceAgent: Agent;
  let credDefId: CredDefId;
  let faberConnection: ConnectionRecord;
  let aliceConnection: ConnectionRecord;
  let faberCredentialRecord: CredentialRecord;
  let aliceCredentialRecord: CredentialRecord;

  beforeAll(async () => {
    const faberMessages = new Subject();
    const aliceMessages = new Subject();

    const faberAgentInbound = new SubjectInboundTransporter(faberMessages);
    const faberAgentOutbound = new SubjectOutboundTransporter(aliceMessages);
    const aliceAgentInbound = new SubjectInboundTransporter(aliceMessages);
    const aliceAgentOutbound = new SubjectOutboundTransporter(faberMessages);

    faberAgent = new Agent(faberConfig, faberAgentInbound, faberAgentOutbound, indy);
    aliceAgent = new Agent(aliceConfig, aliceAgentInbound, aliceAgentOutbound, indy);
    await faberAgent.init();
    await aliceAgent.init();

    const schemaTemplate = {
      name: `test-schema-${Date.now()}`,
      attributes: ['name', 'age'],
      version: '1.0',
    };
    const [, ledgerSchema] = await registerSchema(faberAgent, schemaTemplate);

    const definitionTemplate = {
      schema: ledgerSchema,
      tag: 'TAG',
      signatureType: 'CL',
      config: { support_revocation: false },
    };
    const [ledgerCredDefId] = await registerDefinition(faberAgent, definitionTemplate);
    credDefId = ledgerCredDefId;

    const publicDid = faberAgent.getPublicDid()?.did;
    await ensurePublicDidIsOnLedger(faberAgent, publicDid!);
    const { agentAConnection, agentBConnection } = await makeConnection(faberAgent, aliceAgent);
    faberConnection = agentAConnection;
    aliceConnection = agentBConnection;
  });

  afterAll(async () => {
    await faberAgent.closeAndDeleteWallet();
    await aliceAgent.closeAndDeleteWallet();
  });

  test('Alice starts with credential proposal to Faber', async () => {
    logger.log('Alice sends credential proposal to Faber');
    let aliceCredentialRecord = await aliceAgent.credentials.proposeCredential(aliceConnection.id, {
      credentialProposal: credentialPreview,
      credentialDefinitionId: credDefId,
    });

    logger.log('Faber waits for credential proposal from Alice');
    let faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
      threadId: aliceCredentialRecord.tags.threadId,
      state: CredentialState.ProposalReceived,
    });

    logger.log('Faber sends credential offer to Alice');
    faberCredentialRecord = await faberAgent.credentials.acceptProposal(faberCredentialRecord.id, {
      comment: 'some comment about credential',
    });

    logger.log('Alice waits for credential offer from Faber');
    aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
      threadId: faberCredentialRecord.tags.threadId,
      state: CredentialState.OfferReceived,
    });

    // FIXME: expect below expects json, so we do a refetch because the current
    // returns class instance
    aliceCredentialRecord = await aliceAgent.credentials.getById(aliceCredentialRecord.id);

    expect(aliceCredentialRecord).toMatchObject({
      createdAt: expect.any(Number),
      id: expect.any(String),
      offerMessage: {
        '@id': expect.any(String),
        '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/issue-credential/1.0/offer-credential',
        comment: 'some comment about credential',
        credential_preview: {
          '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/issue-credential/1.0/credential-preview',
          attributes: [
            {
              name: 'name',
              'mime-type': 'text/plain',
              value: 'John',
            },
            {
              name: 'age',
              'mime-type': 'text/plain',
              value: '99',
            },
          ],
        },
        'offers~attach': expect.any(Array),
      },
      tags: { threadId: faberCredentialRecord.tags.threadId },
      type: CredentialRecord.name,
      state: CredentialState.OfferReceived,
    });

    logger.log('Alice sends credential request to Faber');
    aliceCredentialRecord = await aliceAgent.credentials.acceptOffer(aliceCredentialRecord.id);

    logger.log('Faber waits for credential request from Alice');
    faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
      threadId: aliceCredentialRecord.tags.threadId,
      state: CredentialState.RequestReceived,
    });

    logger.log('Faber sends credential to Alice');
    faberCredentialRecord = await faberAgent.credentials.acceptRequest(faberCredentialRecord.id);

    logger.log('Alice waits for credential from Faber');
    aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
      threadId: faberCredentialRecord.tags.threadId,
      state: CredentialState.CredentialReceived,
    });

    logger.log('Alice sends credential ack to Faber');
    aliceCredentialRecord = await aliceAgent.credentials.acceptCredential(aliceCredentialRecord.id);

    logger.log('Faber waits for credential ack from Alice');
    faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
      threadId: faberCredentialRecord.tags.threadId,
      state: CredentialState.Done,
    });

    expect(aliceCredentialRecord).toMatchObject({
      type: CredentialRecord.name,
      id: expect.any(String),
      createdAt: expect.any(Number),
      tags: {
        threadId: expect.any(String),
      },
      offerMessage: expect.any(Object),
      requestMessage: expect.any(Object),
      requestMetadata: expect.any(Object),
      credentialId: expect.any(String),
      state: CredentialState.Done,
    });

    expect(faberCredentialRecord).toMatchObject({
      type: CredentialRecord.name,
      id: expect.any(String),
      createdAt: expect.any(Number),
      tags: {
        threadId: expect.any(String),
      },
      offerMessage: expect.any(Object),
      requestMessage: expect.any(Object),
      requestMetadata: undefined,
      credentialId: undefined,
      state: CredentialState.Done,
    });
  });

  test('Faber starts with credential offer to Alice', async () => {
    logger.log('Faber sends credential offer to Alice');
    faberCredentialRecord = await faberAgent.credentials.offerCredential(faberConnection.id, {
      preview: credentialPreview,
      credentialDefinitionId: credDefId,
      comment: 'some comment about credential',
    });

    logger.log('Alice waits for credential offer from Faber');
    aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
      threadId: faberCredentialRecord.tags.threadId,
      state: CredentialState.OfferReceived,
    });

    // FIXME: expect below expects json, so we do a refetch because the current
    // returns class instance
    aliceCredentialRecord = await aliceAgent.credentials.getById(aliceCredentialRecord.id);

    expect(aliceCredentialRecord).toMatchObject({
      createdAt: expect.any(Number),
      id: expect.any(String),
      offerMessage: {
        '@id': expect.any(String),
        '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/issue-credential/1.0/offer-credential',
        comment: 'some comment about credential',
        credential_preview: {
          '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/issue-credential/1.0/credential-preview',
          attributes: [
            {
              name: 'name',
              'mime-type': 'text/plain',
              value: 'John',
            },
            {
              name: 'age',
              'mime-type': 'text/plain',
              value: '99',
            },
          ],
        },
        'offers~attach': expect.any(Array),
      },
      tags: { threadId: faberCredentialRecord.tags.threadId },
      type: CredentialRecord.name,
      state: CredentialState.OfferReceived,
    });

    logger.log('Alice sends credential request to Faber');
    aliceCredentialRecord = await aliceAgent.credentials.acceptOffer(aliceCredentialRecord.id);

    logger.log('Faber waits for credential request from Alice');
    faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
      threadId: aliceCredentialRecord.tags.threadId,
      state: CredentialState.RequestReceived,
    });

    logger.log('Faber sends credential to Alice');
    faberCredentialRecord = await faberAgent.credentials.acceptRequest(faberCredentialRecord.id);

    logger.log('Alice waits for credential from Faber');
    aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
      threadId: faberCredentialRecord.tags.threadId,
      state: CredentialState.CredentialReceived,
    });

    logger.log('Alice sends credential ack to Faber');
    aliceCredentialRecord = await aliceAgent.credentials.acceptCredential(aliceCredentialRecord.id);

    logger.log('Faber waits for credential ack from Alice');
    faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
      threadId: faberCredentialRecord.tags.threadId,
      state: CredentialState.Done,
    });

    expect(aliceCredentialRecord).toMatchObject({
      type: CredentialRecord.name,
      id: expect.any(String),
      createdAt: expect.any(Number),
      tags: {
        threadId: expect.any(String),
      },
      offerMessage: expect.any(Object),
      requestMessage: expect.any(Object),
      requestMetadata: expect.any(Object),
      credentialId: expect.any(String),
      state: CredentialState.Done,
    });

    expect(faberCredentialRecord).toMatchObject({
      type: CredentialRecord.name,
      id: expect.any(String),
      createdAt: expect.any(Number),
      tags: {
        threadId: expect.any(String),
      },
      offerMessage: expect.any(Object),
      requestMessage: expect.any(Object),
      requestMetadata: undefined,
      credentialId: undefined,
      state: CredentialState.Done,
    });
  });
});
