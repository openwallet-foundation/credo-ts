import { Agent, InboundTransporter, OutboundTransporter } from '..';
import path from 'path';
import indy from 'indy-sdk';
import { DidInfo } from '../wallet/Wallet';
import { DID_IDENTIFIER_REGEX, VERKEY_REGEX, isFullVerkey, isAbbreviatedVerkey } from '../utils/did';
import { InitConfig } from '../types';

const genesisPath = process.env.GENESIS_TXN_PATH
  ? path.resolve(process.env.GENESIS_TXN_PATH)
  : path.join(__dirname, '../../../network/genesis/local-genesis.txn');

const faberConfig: InitConfig = {
  label: 'Faber',
  walletConfig: { id: 'faber' },
  walletCredentials: { key: '00000000000000000000000000000Test01' },
  publicDidSeed: process.env.TEST_AGENT_PUBLIC_DID_SEED,
  genesisPath,
  poolName: 'test-pool',
};

describe('ledger', () => {
  let faberAgent: Agent;
  let schemaId: SchemaId;
  let faberAgentPublicDid: DidInfo | undefined;

  beforeAll(async () => {
    faberAgent = new Agent(faberConfig, new DummyInboundTransporter(), new DummyOutboundTransporter(), indy);
    await faberAgent.init();
  });

  afterAll(async () => {
    await faberAgent.closeAndDeleteWallet();
  });

  test(`initialization of agent's public DID`, async () => {
    faberAgentPublicDid = faberAgent.getPublicDid();
    console.log('faberAgentPublicDid', faberAgentPublicDid);

    expect(faberAgentPublicDid).toEqual(
      expect.objectContaining({
        did: expect.stringMatching(DID_IDENTIFIER_REGEX),
        verkey: expect.stringMatching(VERKEY_REGEX),
      })
    );
  });

  test('get public DID from ledger', async () => {
    if (!faberAgentPublicDid) {
      throw new Error('Agent does not have publid did.');
    }

    const result = await faberAgent.ledger.getPublicDid(faberAgentPublicDid.did);

    let { verkey } = faberAgentPublicDid;
    // Agent’s public did stored locally in Indy wallet and created from public did seed during
    // its initialization always returns full verkey. Therefore we need to align that here.
    if (isFullVerkey(verkey) && isAbbreviatedVerkey(result.verkey)) {
      verkey = await indy.abbreviateVerkey(faberAgentPublicDid.did, verkey);
    }

    expect(result).toEqual(
      expect.objectContaining({
        did: faberAgentPublicDid.did,
        verkey: verkey,
        role: '101',
      })
    );
  });

  test('register schema on ledger', async () => {
    if (!faberAgentPublicDid) {
      throw new Error('Agent does not have publid did.');
    }

    const schemaName = `test-schema-${Date.now()}`;
    const schemaTemplate = {
      name: schemaName,
      attributes: ['name', 'age'],
      version: '1.0',
    };

    [schemaId] = await faberAgent.ledger.registerCredentialSchema(schemaTemplate);
    const ledgerSchema = await faberAgent.ledger.getSchema(schemaId);

    expect(schemaId).toBe(`${faberAgentPublicDid.did}:2:${schemaName}:1.0`);
    expect(ledgerSchema).toEqual(
      expect.objectContaining({
        attrNames: expect.arrayContaining(['name', 'age']),
        id: `${faberAgentPublicDid.did}:2:${schemaName}:1.0`,
        name: schemaName,
        seqNo: expect.any(Number),
        ver: '1.0',
        version: '1.0',
      })
    );
  });

  test('register definition on ledger', async () => {
    if (!faberAgentPublicDid) {
      throw new Error('Agent does not have publid did.');
    }
    const schema = await faberAgent.ledger.getSchema(schemaId);
    const credentialDefinitionTemplate = {
      schema: schema,
      tag: 'TAG',
      signatureType: 'CL',
      config: { support_revocation: true },
    };

    const [credDefId] = await faberAgent.ledger.registerCredentialDefinition(credentialDefinitionTemplate);
    const ledgerCredDef = await faberAgent.ledger.getCredentialDefinition(credDefId);

    const credDefIdRegExp = new RegExp(`${faberAgentPublicDid.did}:3:CL:[0-9]+:TAG`);
    expect(credDefId).toEqual(expect.stringMatching(credDefIdRegExp));
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
  public start() {
    console.log('Starting agent...');
  }
}

class DummyOutboundTransporter implements OutboundTransporter {
  public async sendMessage() {
    console.log('Sending message...');
  }
}
