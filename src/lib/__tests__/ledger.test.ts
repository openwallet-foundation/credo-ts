/* eslint-disable no-console */
import { Agent, InboundTransporter, OutboundTransporter } from '..';
import { OutboundPackage } from '../types';
import fs from 'fs';
import indy from 'indy-sdk';

const faberConfig = {
  label: 'Faber',
  walletConfig: { id: 'faber' },
  walletCredentials: { key: '00000000000000000000000000000Test01' },
};

describe('ledger', () => {
  let faberAgent: Agent;

  afterAll(async () => {
    await faberAgent.closeAndDeleteWallet();
  });

  test('faber can register public DID on ledger', async () => {
    faberAgent = new Agent(faberConfig, new DummyInboundTransporter(), new DummyOutboundTransporter(), indy);
    await faberAgent.init();

    const poolName = 'pool1';
    console.log(`Open Pool Ledger: ${poolName}`);
    const poolConfig = {
      genesis_txn: '/Users/abjk833/projects/_forks/aries-framework-javascript/src/lib/__tests__/genesis.txn',
    };

    const fileExists = fs.existsSync(poolConfig.genesis_txn);
    console.log(fileExists);

    await faberAgent.connectToLedger(poolName, poolConfig);

    // const stewardDid = await getStewardDid();
    const stewardDid = 'Th7MpTaRZVRYnPiabds81Y';
    console.log('stewardDid', stewardDid);

    const result = await faberAgent.getPublicDidFromLedger(stewardDid);
    expect(result).toEqual({
      did: 'Th7MpTaRZVRYnPiabds81Y',
      verkey: '~7TYfekw4GUagBnBVCqPjiC',
      role: '2',
    });
  });

  // test('faber can register schema on ledger', async () => {
  //   expect(true).toBe(false);
  // });

  // test('faber can register definition on ledger', async () => {
  //   expect(true).toBe(false);
  // });
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

async function getStewardDid() {
  const stewardWalletConfig = { id: 'stewardWalletName' };
  const stewardWalletCredentials = { key: 'steward_key' };
  try {
    await indy.createWallet(stewardWalletConfig, stewardWalletCredentials);
  } catch (e) {
    if (e.message !== 'WalletAlreadyExistsError') {
      throw e;
    }
  }

  const stewardWallet = await indy.openWallet(stewardWalletConfig, stewardWalletCredentials);

  console.log('"Sovrin Steward" -> Create and store in Wallet DID from seed');
  const stewardDidInfo = { seed: '000000000000000000000000Steward1' };

  const [stewardDid] = await indy.createAndStoreMyDid(stewardWallet, stewardDidInfo);
  return stewardDid;
}
