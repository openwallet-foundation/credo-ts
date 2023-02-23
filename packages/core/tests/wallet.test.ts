import { tmpdir } from 'os'
import path from 'path'

import { getIndySdkModules } from '../../indy-sdk/tests/setupIndySdkModule'
import { Agent } from '../src/agent/Agent'
import { BasicMessageRepository, BasicMessageRecord, BasicMessageRole } from '../src/modules/basic-messages'
import { KeyDerivationMethod } from '../src/types'
import { uuid } from '../src/utils/uuid'
import { WalletInvalidKeyError } from '../src/wallet/error'
import { WalletDuplicateError } from '../src/wallet/error/WalletDuplicateError'
import { WalletNotFoundError } from '../src/wallet/error/WalletNotFoundError'

import { getAgentOptions } from './helpers'

const aliceAgentOptions = getAgentOptions('wallet-tests-Alice', {}, getIndySdkModules())
const bobAgentOptions = getAgentOptions('wallet-tests-Bob', {}, getIndySdkModules())

describe('wallet', () => {
  let aliceAgent: Agent
  let bobAgent: Agent

  beforeEach(async () => {
    aliceAgent = new Agent(aliceAgentOptions)
    bobAgent = new Agent(bobAgentOptions)
  })

  afterEach(async () => {
    await aliceAgent.shutdown()
    await bobAgent.shutdown()

    if (aliceAgent.wallet.isProvisioned) {
      await aliceAgent.wallet.delete()
    }

    if (bobAgent.wallet.isProvisioned) {
      await bobAgent.wallet.delete()
    }
  })

  test('open, create and open wallet with different wallet key that it is in agent config', async () => {
    const walletConfig = {
      id: 'mywallet',
      key: 'mysecretwalletkey',
    }

    try {
      await aliceAgent.wallet.open(walletConfig)
    } catch (error) {
      if (error instanceof WalletNotFoundError) {
        await aliceAgent.wallet.create(walletConfig)
        await aliceAgent.wallet.open(walletConfig)
      }
    }

    await aliceAgent.initialize()

    expect(aliceAgent.isInitialized).toBe(true)
  })

  test('when creating already existing wallet throw WalletDuplicateError', async () => {
    const walletConfig = {
      id: 'mywallet',
      key: 'mysecretwalletkey',
    }

    await aliceAgent.wallet.create(walletConfig)

    await expect(aliceAgent.wallet.create(walletConfig)).rejects.toThrowError(WalletDuplicateError)
  })

  test('when opening non-existing wallet throw WalletNotFoundError', async () => {
    const walletConfig = {
      id: 'mywallet',
      key: 'mysecretwalletkey',
    }

    await expect(aliceAgent.wallet.open(walletConfig)).rejects.toThrowError(WalletNotFoundError)
  })

  test('when opening wallet with invalid key throw WalletInvalidKeyError', async () => {
    const walletConfig = {
      id: 'mywallet',
      key: 'mysecretwalletkey',
    }

    await aliceAgent.wallet.create(walletConfig)
    await expect(aliceAgent.wallet.open({ ...walletConfig, key: 'abcd' })).rejects.toThrowError(WalletInvalidKeyError)
  })

  test('when create wallet and shutdown, wallet is closed', async () => {
    const walletConfig = {
      id: 'mywallet',
      key: 'mysecretwalletkey',
    }

    await aliceAgent.wallet.create(walletConfig)

    await aliceAgent.shutdown()

    await expect(aliceAgent.wallet.open(walletConfig)).resolves.toBeUndefined()
  })

  test('create wallet with custom key derivation method', async () => {
    const walletConfig = {
      id: 'mywallet',
      key: 'mysecretwalletkey',
      keyDerivationMethod: KeyDerivationMethod.Argon2IInt,
    }

    await aliceAgent.wallet.createAndOpen(walletConfig)

    expect(aliceAgent.wallet.isInitialized).toBe(true)
  })

  test('when exporting and importing a wallet, content is copied', async () => {
    await bobAgent.initialize()
    const bobBasicMessageRepository = bobAgent.dependencyManager.resolve(BasicMessageRepository)

    const basicMessageRecord = new BasicMessageRecord({
      id: 'some-id',
      connectionId: 'connId',
      content: 'hello',
      role: BasicMessageRole.Receiver,
      sentTime: 'sentIt',
    })

    // Save in wallet
    await bobBasicMessageRepository.save(bobAgent.context, basicMessageRecord)

    if (!bobAgent.config.walletConfig) {
      throw new Error('No wallet config on bobAgent')
    }

    const backupKey = 'someBackupKey'
    const backupWalletName = `backup-${uuid()}`
    const backupPath = path.join(tmpdir(), backupWalletName)

    // Create backup and delete wallet
    await bobAgent.wallet.export({ path: backupPath, key: backupKey })
    await bobAgent.wallet.delete()

    // Initialize the wallet again and assert record does not exist
    // This should create a new wallet
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await bobAgent.wallet.initialize(bobAgentOptions.config.walletConfig!)
    expect(await bobBasicMessageRepository.findById(bobAgent.context, basicMessageRecord.id)).toBeNull()
    await bobAgent.wallet.delete()

    // Import backup with different wallet id and initialize
    await bobAgent.wallet.import({ id: backupWalletName, key: backupWalletName }, { path: backupPath, key: backupKey })
    await bobAgent.wallet.initialize({ id: backupWalletName, key: backupWalletName })

    // Expect same basic message record to exist in new wallet
    expect(await bobBasicMessageRepository.getById(bobAgent.context, basicMessageRecord.id)).toMatchObject(
      basicMessageRecord
    )
  })

  test('changing wallet key', async () => {
    const walletConfig = {
      id: 'mywallet',
      key: 'mysecretwalletkey',
    }

    await aliceAgent.wallet.createAndOpen(walletConfig)
    await aliceAgent.initialize()

    //Close agent
    const walletConfigRekey = {
      id: 'mywallet',
      key: 'mysecretwalletkey',
      rekey: '123',
    }

    await aliceAgent.shutdown()
    await aliceAgent.wallet.rotateKey(walletConfigRekey)
    await aliceAgent.initialize()

    expect(aliceAgent.isInitialized).toBe(true)
  })
})
