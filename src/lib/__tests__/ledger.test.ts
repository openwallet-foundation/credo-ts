/* eslint-disable no-console */
import { Agent, InboundTransporter, OutboundTransporter } from '..';
import { OutboundPackage } from '../types';
import path from 'path';
import indy from 'indy-sdk';

jest.setTimeout(15000);

const faberConfig = {
  label: 'Faber',
  walletConfig: { id: 'faber' },
  walletCredentials: { key: '00000000000000000000000000000Test01' },
};

describe('ledger', () => {
  let faberAgent: Agent;
  let schemaId: SchemaId;

  beforeAll(async () => {
    faberAgent = new Agent(faberConfig, new DummyInboundTransporter(), new DummyOutboundTransporter(), indy);
    await faberAgent.init();

    const poolName = 'test-pool';
    const poolConfig = {
      genesis_txn: path.join(__dirname, 'builder-net-genesis.txn'),
    };

    console.log(`Connection to ledger pool ${poolName}`);
    await faberAgent.ledger.connect(poolName, poolConfig);
  });

  afterAll(async () => {
    await faberAgent.closeAndDeleteWallet();
  });

  test(`initialization of agent's public DID`, async () => {
    // We're pretending we have Steward DID to have the write permission to the ledger. This is a small simplification
    // because, in the real world, the agent doesn't necessarily need the write permission and could just create and
    // sign request, send it to another agent that has the permission and ask him to write it on its behalf.
    const didInfo = { seed: 'ENTER_SEED' };

    await faberAgent.initPublicDid(didInfo.seed);
    const faberAgentPublicDid = faberAgent.getPublicDid();
    console.log('faberAgentPublicDid', faberAgentPublicDid);

    expect(faberAgentPublicDid).toEqual({
      did: 'TygUVyv8Je7GRPL9o1nJm2',
      verkey: 'Fhoe1CzB6zJsfX2VcnvvpzhzRoL2JE2v253scM6Bm43z',
    });
  });

  test('test taa', async () => {
    const { did } = faberAgent.getPublicDid();

    if (!did) {
      throw new Error('Agent does not have publid did.');
    }

    const result = await faberAgent.ledger.getTransactionAuthorAgreement();
    expect(result).toEqual(
      expect.objectContaining({
        digest: expect.any(String),
        ratification_ts: expect.any(Number),
        text: expect.any(String),
      })
    );
  });

  test('get public DID from ledger', async () => {
    const { did } = faberAgent.getPublicDid();

    if (!did) {
      throw new Error('Agent does not have publid did.');
    }

    const result = await faberAgent.ledger.getPublicDid(did);
    expect(result).toEqual({
      did: 'TygUVyv8Je7GRPL9o1nJm2',
      verkey: 'Fhoe1CzB6zJsfX2VcnvvpzhzRoL2JE2v253scM6Bm43z',
      role: '101',
    });
  });

  test('register schema on ledger', async () => {
    const schemaName = `test-schema-${Date.now()}`;
    const schemaTemplate = {
      name: schemaName,
      attributes: ['name', 'age'],
      version: '1.0',
    };

    [schemaId] = await faberAgent.ledger.registerCredentialSchema(schemaTemplate);
    const [ledgerSchemaId, ledgerSchema] = await faberAgent.ledger.getSchema(schemaId);

    expect(ledgerSchemaId).toBe(`TygUVyv8Je7GRPL9o1nJm2:2:${schemaName}:1.0`);
    expect(ledgerSchema).toEqual(
      expect.objectContaining({
        attrNames: expect.arrayContaining(['name', 'age']),
        id: `TygUVyv8Je7GRPL9o1nJm2:2:${schemaName}:1.0`,
        name: schemaName,
        seqNo: expect.any(Number),
        ver: '1.0',
        version: '1.0',
      })
    );
  });

  test('register definition on ledger', async () => {
    const [, schema] = await faberAgent.ledger.getSchema(schemaId);
    const credentialDefinitionTemplate = {
      schema: schema,
      tag: 'TAG',
      signatureType: 'CL',
      config: { support_revocation: true },
    };

    const [credDefId] = await faberAgent.ledger.registerCredentialDefinition(credentialDefinitionTemplate);
    const [ledgerCredDefId, ledgerCredDef] = await faberAgent.ledger.getCredentialDefinition(credDefId);

    const credDefIdRegExp = new RegExp(`TygUVyv8Je7GRPL9o1nJm2:3:CL:[0-9]+:TAG`);
    expect(ledgerCredDefId).toEqual(expect.stringMatching(credDefIdRegExp));
    expect(ledgerCredDef).toEqual(
      expect.objectContaining({
        id: expect.stringMatching(credDefIdRegExp),
        schemaId: expect.any(String),
        type: 'CL',
        tag: 'TAG',
        ver: '1.0',
        value: expect.objectContaining({
          primary: expect.anything(),
          revocation: expect.anything(),
        }),
      })
    );
  });
});

class DummyInboundTransporter implements InboundTransporter {
  start(agent: Agent) {
    console.log('Starting agent...');
  }
}

class DummyOutboundTransporter implements OutboundTransporter {
  async sendMessage(outboundPackage: OutboundPackage) {
    console.log('Sending message...');
  }
}
