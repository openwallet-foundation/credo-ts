/* eslint-disable no-console */
import { Agent, InboundTransporter, OutboundTransporter } from '..';
import { OutboundPackage } from '../types';
import path from 'path';
import indy from 'indy-sdk';

jest.setTimeout(10000);

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
      genesis_txn: path.join(__dirname, 'genesis.txn'),
    };

    console.log(`Connection to ledger pool ${poolName}`);
    await faberAgent.connectToLedger(poolName, poolConfig);
  });

  afterAll(async () => {
    await faberAgent.closeAndDeleteWallet();
  });

  test(`initialization of agent's public DID`, async () => {
    // We're pretending we have Steward DID to have the write permission to the ledger. This is a small simplification
    // because, in the real world, the agent doesn't necessarily need the write permission and could just create and
    // sign request, send it to another agent that has the permission and ask him to write it on its behalf.
    const stewardDid = 'Th7MpTaRZVRYnPiabds81Y';
    const stewardDidInfo = { seed: '000000000000000000000000Steward1' };

    await faberAgent.initPublicDid(stewardDid, stewardDidInfo.seed);
    const faberAgentPublicDid = faberAgent.getPublicDid();
    console.log('faberAgentPublicDid', faberAgentPublicDid);

    expect(faberAgentPublicDid).toEqual({
      did: 'Th7MpTaRZVRYnPiabds81Y',
      verkey: 'FYmoFw55GeQH7SRFa37dkx1d2dZ3zUF8ckg7wmL7ofN4',
    });
  });

  test('get public DID from ledger', async () => {
    const agentPublicDid = faberAgent.getPublicDid();

    // @ts-ignore
    if (!agentPublicDid.did) {
      throw new Error('Agent does not have publid did.');
    }
    console.log('faberAgentPublicDid', agentPublicDid);

    // @ts-ignore
    const result = await faberAgent.getPublicDidFromLedger(agentPublicDid.did);
    expect(result).toEqual({
      did: 'Th7MpTaRZVRYnPiabds81Y',
      verkey: '~7TYfekw4GUagBnBVCqPjiC',
      role: '2',
    });
  });

  test('register schema on ledger', async () => {
    const myDid = 'Th7MpTaRZVRYnPiabds81Y';
    const schemaName = `test-schema-${Date.now()}`;
    const schemaTemplate = {
      name: schemaName,
      attributes: ['name', 'age'],
      version: '1.0',
    };

    [schemaId] = await faberAgent.registerSchema(myDid, schemaTemplate);
    const [ledgerSchemaId, ledgerSchema] = await faberAgent.getSchemaFromLedger(myDid, schemaId);

    expect(ledgerSchemaId).toBe(`Th7MpTaRZVRYnPiabds81Y:2:${schemaName}:1.0`);
    expect(ledgerSchema).toEqual(
      expect.objectContaining({
        attrNames: expect.arrayContaining(['name', 'age']),
        id: `Th7MpTaRZVRYnPiabds81Y:2:${schemaName}:1.0`,
        name: schemaName,
        seqNo: expect.any(Number),
        ver: '1.0',
        version: '1.0',
      })
    );
  });

  test('register definition on ledger', async () => {
    const myDid = 'Th7MpTaRZVRYnPiabds81Y';
    const [, ledgerSchema] = await faberAgent.getSchemaFromLedger(myDid, schemaId);
    const credentialDefinitionTemplate = {
      schema: ledgerSchema,
      tag: 'TAG',
      signatureType: 'CL',
      config: { support_revocation: true },
    };

    const [credDefId] = await faberAgent.registerDefinition(myDid, credentialDefinitionTemplate);
    const [ledgerCredDefId, ledgerCredDef] = await faberAgent.getDefinitionFromLedger(myDid, credDefId);

    const credDefIdRegExp = new RegExp(`${myDid}:3:CL:[0-9]+:TAG`);
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
