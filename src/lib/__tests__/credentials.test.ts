/* eslint-disable no-console */
// @ts-ignore
import { poll } from 'await-poll';
import { Subject } from 'rxjs';
import path from 'path';
import indy from 'indy-sdk';
import { Agent } from '..';
import { SubjectInboundTransporter, SubjectOutboundTransporter } from './helpers';
import { CredentialRecord } from '../storage/CredentialRecord';
import { SchemaTemplate, CredDefTemplate } from '../agent/LedgerService';

jest.setTimeout(15000);

const faberConfig = {
  label: 'Faber',
  walletConfig: { id: 'credentials-test-faber' },
  walletCredentials: { key: '00000000000000000000000000000Test01' },
  publicDidSeed: '000000000000000000000000Steward1',
};

const aliceConfig = {
  label: 'Alice',
  walletConfig: { id: 'credentials-test-alice' },
  walletCredentials: { key: '00000000000000000000000000000Test01' },
};

const poolName = 'test-pool';
const poolConfig = {
  genesis_txn: process.env.GENESIS_TXN_PATH
    ? path.resolve(process.env.GENESIS_TXN_PATH)
    : path.join(__dirname, 'genesis.txn'),
};

describe('credentials', () => {
  let faberAgent: Agent;
  let aliceAgent: Agent;
  let credDefId: CredDefId;

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

    console.log(`Connecting to ledger pool ${poolName} with config:`, poolConfig);
    await faberAgent.ledger.connect(poolName, poolConfig);

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

    const publidDid = 'Th7MpTaRZVRYnPiabds81Y';
    await ensurePublicDidIsOnLedger(faberAgent, publidDid);
    await makeConnection(faberAgent, aliceAgent);
  });

  afterAll(async () => {
    await faberAgent.closeAndDeleteWallet();
    await aliceAgent.closeAndDeleteWallet();
  });

  test(`when faber issues credential then alice gets credential offer`, async () => {
    // We assume that Faber has only one connection and it's a connection with Alice
    const [firstConnection] = await faberAgent.connections.getAll();

    // Issue credential from Faber to Alice
    await faberAgent.credentials.issueCredential(firstConnection, {
      credDefId,
      comment: 'some comment about credential',
    });

    // We assume that Alice has only one credential and it's a credential from Faber
    const [firstCredential] = await poll(
      () => aliceAgent.credentials.getCredentials(),
      (credentials: CredentialRecord[]) => credentials.length < 1,
      100
    );

    expect(firstCredential).toEqual(
      expect.objectContaining({
        createdAt: expect.any(Number),
        id: expect.any(String),
        offer: {
          '@id': expect.any(String),
          '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/issue-credential/1.0/offer-credential',
          comment: 'some comment about credential',
          credential_preview: {},
          'offers~attach': expect.any(Array),
        },
        tags: {},
        type: 'CredentialRecord',
      })
    );
  });
});

async function registerSchema(agent: Agent, schemaTemplate: SchemaTemplate): Promise<[SchemaId, Schema]> {
  const [schemaId] = await agent.ledger.registerCredentialSchema(schemaTemplate);
  console.log('schemaId', schemaId);
  const [ledgerSchemaId, ledgerSchema] = await agent.ledger.getSchema(schemaId);
  console.log('ledgerSchemaId, ledgerSchema', ledgerSchemaId, ledgerSchema);
  return [ledgerSchemaId, ledgerSchema];
}

async function registerDefinition(agent: Agent, definitionTemplate: CredDefTemplate): Promise<[CredDefId, CredDef]> {
  const [credDefId] = await agent.ledger.registerCredentialDefinition(definitionTemplate);
  const [ledgerCredDefId, ledgerCredDef] = await agent.ledger.getCredentialDefinition(credDefId);
  console.log('ledgerCredDefId, ledgerCredDef', ledgerCredDefId, ledgerCredDef);
  return [ledgerCredDefId, ledgerCredDef];
}

async function ensurePublicDidIsOnLedger(agent: Agent, publicDid: Did) {
  try {
    console.log(`Ensure test DID ${publicDid} is written to ledger`);
    const agentPublicDid = await agent.ledger.getPublicDid(publicDid);
    console.log(`Ensure test DID ${publicDid} is written to ledger: Success`, agentPublicDid);
  } catch (error) {
    // Unfortunately, this won't prevent from the test suite running because of Jest runner runs all tests
    // regardless thorwn errors. We're more explicit about the problem with this error handling.
    throw new Error(`Test DID ${publicDid} is not written on ledger or ledger is not available.`);
  }
}

async function makeConnection(agentA: Agent, agentB: Agent) {
  const { connection: aliceConnectionAtAliceBob, invitation } = await agentA.connections.createConnection();

  if (!invitation) {
    throw new Error('There is no invitation in newly created connection!');
  }

  const bobConnectionAtBobAlice = await agentB.connections.acceptInvitation(invitation.toJSON());

  const aliceConnectionRecordAtAliceBob = await agentA.connections.returnWhenIsConnected(aliceConnectionAtAliceBob.id);
  if (!aliceConnectionRecordAtAliceBob) {
    throw new Error('Connection not found!');
  }

  const bobConnectionRecordAtBobAlice = await agentB.connections.returnWhenIsConnected(bobConnectionAtBobAlice.id);
  if (!bobConnectionRecordAtBobAlice) {
    throw new Error('Connection not found!');
  }
}
