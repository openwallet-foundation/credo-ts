/* eslint-disable no-console */
import { Agent } from '..';
import { Subject } from 'rxjs';
import path from 'path';
import indy from 'indy-sdk';
import { DidInfo } from '../wallet/Wallet';
import { SubjectInboundTransporter, SubjectOutboundTransporter } from './helpers';

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
  let schemaId: SchemaId;
  let faberAgentPublicDid: DidInfo | Record<string, undefined>;

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

    const schemaName = `test-schema-${Date.now()}`;
    const schemaTemplate = {
      name: schemaName,
      attributes: ['name', 'age'],
      version: '1.0',
    };

    [schemaId] = await faberAgent.ledger.registerCredentialSchema(schemaTemplate);
    console.log('schemaId', schemaId);
    const [ledgerSchemaId, ledgerSchema] = await faberAgent.ledger.getSchema(schemaId);
    console.log('ledgerSchemaId, ledgerSchema', ledgerSchemaId, ledgerSchema);

    const credentialDefinitionTemplate = {
      schema: ledgerSchema,
      tag: 'TAG',
      signatureType: 'CL',
      config: { support_revocation: false },
    };

    const [credDefId] = await faberAgent.ledger.registerCredentialDefinition(credentialDefinitionTemplate);
    const [ledgerCredDefId, ledgerCredDef] = await faberAgent.ledger.getCredentialDefinition(credDefId);
    console.log('ledgerCredDefId, ledgerCredDef', ledgerCredDefId, ledgerCredDef);

    await makeConnection(faberAgent, aliceAgent);
  });

  afterAll(async () => {
    await faberAgent.closeAndDeleteWallet();
    await aliceAgent.closeAndDeleteWallet();
  });

  test(`initialization of agent's public DID`, async () => {
    faberAgentPublicDid = await faberAgent.ledger.getPublicDid('Th7MpTaRZVRYnPiabds81Y');
    console.log('faberAgentPublicDid', faberAgentPublicDid);

    expect({}).toEqual(null);
  });
});

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
