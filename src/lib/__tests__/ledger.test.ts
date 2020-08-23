/* eslint-disable no-console */
import { Agent, InboundTransporter, OutboundTransporter } from '..';
import { OutboundPackage } from '../types';
import path from 'path';
import indy from 'indy-sdk';
import { DidInfo } from '../wallet/Wallet';
import { DID_IDENTIFIER_REGEX, VERKEY_REGEX, isFullVerkey, isAbbreviatedVerkey } from '../utils/did';

jest.setTimeout(15000);

const faberConfig = {
  label: 'Faber',
  walletConfig: { id: 'faber' },
  walletCredentials: { key: '00000000000000000000000000000Test01' },
  publicDidSeed: process.env.TEST_AGENT_PUBLIC_DID_SEED,
};

describe('ledger', () => {
  let faberAgent: Agent;
  let schemaId: SchemaId;
  let faberAgentPublicDid: DidInfo | Record<string, undefined>;

  beforeAll(async () => {
    faberAgent = new Agent(faberConfig, new DummyInboundTransporter(), new DummyOutboundTransporter(), indy);
    await faberAgent.init();

    const poolName = 'test-pool';
    const poolConfig = {
      genesis_txn: process.env.GENESIS_TXN_PATH
        ? path.resolve(process.env.GENESIS_TXN_PATH)
        : path.join(__dirname, '../../../network/genesis/local-genesis.txn'),
    };

    console.log(`Connecting to ledger pool ${poolName} with config:`, poolConfig);
    await faberAgent.ledger.connect(poolName, poolConfig);
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
    const { did } = faberAgent.getPublicDid();

    if (!did) {
      throw new Error('Agent does not have publid did.');
    }

    const result = await faberAgent.ledger.getPublicDid(did);

    // TLDR: indy createAndStoreMyDid returns verkey "9iRCvQujJqjMDnX23kV64BKX2y9EzQdqLCHoFuge1apJ", ledger returns verkey "~Rn9y1NrwrLuHGYtCKDDRxN". Both are correct (did: GzKBNShs4KiBksKUkAZud2)
    //
    // .NET also abbreviates verkey before sending to ledger:
    // https://github.com/hyperledger/aries-framework-dotnet/blob/f90eaf9db8548f6fc831abea917e906201755763/src/Hyperledger.Aries/Ledger/DefaultLedgerService.cs#L139-L147
    //
    //
    // The verkey is 32 bytes, and by default in Indy the DID is chosen as the first 16 bytes of that key, before base58 encoding.
    // The abbreviated verkey just replaces the first 16 bytes with ~ when it matches the DID.
    //
    // When full verkey is used to register on ledger, this is stored on ledger and also returned as full verkey
    // same applies to abbreviated verkey. If it is used it will be stored abbreviated and returned abbreviated.
    let verkey = faberAgentPublicDid.verkey as string;
    if (isFullVerkey(verkey) && isAbbreviatedVerkey(result.verkey)) {
      verkey = await indy.abbreviateVerkey(faberAgentPublicDid.did as string, verkey);
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
    const schemaName = `test-schema-${Date.now()}`;
    const schemaTemplate = {
      name: schemaName,
      attributes: ['name', 'age'],
      version: '1.0',
    };

    [schemaId] = await faberAgent.ledger.registerCredentialSchema(schemaTemplate);
    const [ledgerSchemaId, ledgerSchema] = await faberAgent.ledger.getSchema(schemaId);

    expect(ledgerSchemaId).toBe(`${faberAgentPublicDid.did}:2:${schemaName}:1.0`);
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
    const [, schema] = await faberAgent.ledger.getSchema(schemaId);
    const credentialDefinitionTemplate = {
      schema: schema,
      tag: 'TAG',
      signatureType: 'CL',
      config: { support_revocation: true },
    };

    const [credDefId] = await faberAgent.ledger.registerCredentialDefinition(credentialDefinitionTemplate);
    const [ledgerCredDefId, ledgerCredDef] = await faberAgent.ledger.getCredentialDefinition(credDefId);

    const credDefIdRegExp = new RegExp(`${faberAgentPublicDid.did}:3:CL:[0-9]+:TAG`);
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
    // Submitting new credential definition can take a while
    // and somtimes exceeds the default 15000ms
  }, 30000);
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
