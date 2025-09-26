import { tmpdir } from 'os'
import path from 'path'
import { Agent, utils } from '@credo-ts/core'

import { DidCommBasicMessageRecord, DidCommBasicMessageRepository, DidCommBasicMessageRole } from '../../didcomm/src'

import { AskarStoreDuplicateError, AskarStoreInvalidKeyError, AskarStoreNotFoundError } from '../src/error'
import { getAskarSqliteAgentOptions } from './helpers'

const aliceAgentOptions = getAskarSqliteAgentOptions('AgentsAlice')
const bobAgentOptions = getAskarSqliteAgentOptions('AgentsBob')

describe('Askar SQLite agents', () => {
  let aliceAgent: Agent<(typeof aliceAgentOptions)['modules']>
  let bobAgent: Agent<(typeof bobAgentOptions)['modules']>

  beforeEach(async () => {
    aliceAgent = new Agent(aliceAgentOptions)
    bobAgent = new Agent(bobAgentOptions)
  })

  afterEach(async () => {
    if (aliceAgent.modules.askar.isStoreOpen) {
      await aliceAgent.shutdown()
      await aliceAgent.modules.askar.deleteStore()
    }

    if (bobAgent.modules.askar.isStoreOpen) {
      await bobAgent.shutdown()
      await bobAgent.modules.askar.deleteStore()
    }
  })

  test('when opening non-existing store throw AskarStoreNotFoundError', async () => {
    // @ts-expect-error
    aliceAgentOptions.modules.askar.config.options.store = {
      id: 'mywallet',
      key: 'mysecretwalletkey-0',
    }

    await expect(aliceAgent.modules.askar.openStore()).rejects.toThrow(AskarStoreNotFoundError)
  })

  test('when create store and shutdown, store is closed', async () => {
    // @ts-expect-error
    aliceAgentOptions.modules.askar.config.options.store = {
      id: 'mywallet',
      key: 'mysecretwalletkey-0',
    }

    await aliceAgent.modules.askar.provisionStore()
    await aliceAgent.shutdown()

    await expect(aliceAgent.modules.askar.openStore()).resolves.toBeUndefined()

    await aliceAgent.modules.askar.deleteStore()
  })

  test('create store with custom key derivation method', async () => {
    // @ts-expect-error
    aliceAgentOptions.modules.askar.config.options.store = {
      id: 'mywallet',
      key: 'mysecretwalletkey-0',
      keyDerivationMethod: 'kdf:argon2i:int',
    }

    await aliceAgent.modules.askar.provisionStore()

    expect(aliceAgent.modules.askar.isStoreOpen).toBe(true)

    await aliceAgent.modules.askar.deleteStore()
  })

  test('when exporting and importing a store, content is copied', async () => {
    await bobAgent.initialize()
    const bobBasicMessageRepository = bobAgent.dependencyManager.resolve(DidCommBasicMessageRepository)

    const basicMessageRecord = new DidCommBasicMessageRecord({
      id: 'some-id',
      connectionId: 'connId',
      content: 'hello',
      role: DidCommBasicMessageRole.Receiver,
      sentTime: 'sentIt',
    })

    // Save in wallet
    await bobBasicMessageRepository.save(bobAgent.context, basicMessageRecord)

    const backupKey = 'someBackupKey'
    const backupWalletName = `backup-${utils.uuid()}`
    const backupPath = path.join(tmpdir(), backupWalletName)

    // Create backup and delete wallet
    await bobAgent.modules.askar.exportStore({
      exportToStore: { id: 'newwallet', key: backupKey, database: { type: 'sqlite', config: { path: backupPath } } },
    })
    await bobAgent.modules.askar.deleteStore()

    // Initialize the wallet again and assert record does not exist
    // This should create a new wallet
    await bobAgent.modules.askar.provisionStore()
    expect(await bobBasicMessageRepository.findById(bobAgent.context, basicMessageRecord.id)).toBeNull()
    await bobAgent.modules.askar.deleteStore()

    // Import backup with SAME wallet id and initialize
    await bobAgent.modules.askar.importStore({
      importFromStore: { id: 'newwallet', key: backupKey, database: { type: 'sqlite', config: { path: backupPath } } },
    })
    await bobAgent.modules.askar.openStore()

    // Expect same basic message record to exist in new wallet
    expect(await bobBasicMessageRepository.getById(bobAgent.context, basicMessageRecord.id)).toMatchObject({
      id: basicMessageRecord.id,
      connectionId: basicMessageRecord.connectionId,
      content: basicMessageRecord.content,
      createdAt: basicMessageRecord.createdAt,
      updatedAt: basicMessageRecord.updatedAt,
      type: basicMessageRecord.type,
    })
    await aliceAgent.modules.askar.deleteStore()
  })

  test('throws error when attempting to export and import to existing paths', async () => {
    await bobAgent.initialize()

    const backupKey = 'someBackupKey'
    const backupWalletName = `backup-${utils.uuid()}`
    const backupPath = path.join(tmpdir(), backupWalletName)

    // Create backup and try to export it again to the same path
    await bobAgent.modules.askar.exportStore({
      exportToStore: {
        key: backupKey,
        id: 'new-wallet-id',
        database: {
          type: 'sqlite',
          config: {
            path: backupPath,
          },
        },
      },
    })
    await expect(
      bobAgent.modules.askar.exportStore({
        exportToStore: {
          key: backupKey,
          id: 'new-wallet-id',
          database: {
            type: 'sqlite',
            config: {
              path: backupPath,
            },
          },
        },
      })
    ).rejects.toThrow(/Unable to create export/)

    await bobAgent.modules.askar.deleteStore()

    // Import backup with different wallet id and initialize
    await bobAgent.modules.askar.importStore({
      importFromStore: {
        key: backupKey,
        id: 'new-wallet-id',
        database: {
          type: 'sqlite',
          config: {
            path: backupPath,
          },
        },
      },
    })
    await bobAgent.modules.askar.openStore()
    await bobAgent.modules.askar.closeStore()

    // Try to import again an existing wallet
    await expect(
      bobAgent.modules.askar.importStore({
        importFromStore: {
          key: backupKey,
          id: 'new-wallet-id',
          database: {
            type: 'sqlite',
            config: {
              path: backupPath,
            },
          },
        },
      })
    ).rejects.toThrow(/Unable to import store/)

    await aliceAgent.modules.askar.deleteStore()
  })

  test('throws error when attempting to import using wrong key', async () => {
    await bobAgent.initialize()

    const backupKey = 'someBackupKey'
    const wrongBackupKey = 'wrongBackupKey'
    const backupWalletName = `backup-${utils.uuid()}`
    const backupPath = path.join(tmpdir(), backupWalletName)

    // Create backup and try to export it again to the same path
    await bobAgent.modules.askar.exportStore({
      exportToStore: {
        key: backupKey,
        id: 'new-wallet-id',
        database: {
          type: 'sqlite',
          config: {
            path: backupPath,
          },
        },
      },
    })
    await bobAgent.modules.askar.deleteStore()

    // Try to import backup with wrong key
    await expect(
      bobAgent.modules.askar.importStore({
        importFromStore: {
          key: wrongBackupKey,
          id: 'new-wallet-id',
          database: {
            type: 'sqlite',
            config: {
              path: backupPath,
            },
          },
        },
      })
    ).rejects.toThrow()

    // Try to import again using the correct key
    await bobAgent.modules.askar.importStore({
      importFromStore: {
        key: backupKey,
        id: 'new-wallet-id',
        database: {
          type: 'sqlite',
          config: {
            path: backupPath,
          },
        },
      },
    })
    await bobAgent.modules.askar.openStore()
    await bobAgent.modules.askar.closeStore()
    await aliceAgent.modules.askar.deleteStore()
  })

  test('changing store key', async () => {
    await aliceAgent.modules.askar.provisionStore()
    await aliceAgent.initialize()

    await aliceAgent.modules.askar.rotateStoreKey({ newKey: 'mysecretwalletkey' })

    expect(aliceAgent.isInitialized).toBe(true)

    await aliceAgent.modules.askar.deleteStore()
  })

  test('when creating already existing store throw AskarStoreDuplicateError', async () => {
    await aliceAgent.modules.askar.provisionStore()
    await aliceAgent.modules.askar.closeStore()
    await expect(aliceAgent.modules.askar.provisionStore()).rejects.toThrow(AskarStoreDuplicateError)

    await aliceAgent.modules.askar.deleteStore()
  })

  test('when opening store with invalid key throw AskarStoreInvalidKeyError', async () => {
    await aliceAgent.modules.askar.provisionStore()
    await aliceAgent.modules.askar.closeStore()

    // @ts-expect-error
    aliceAgentOptions.modules.askar.config.options.store = {
      // @ts-expect-error
      ...aliceAgentOptions.modules.askar.config.options.store,
      key: 'some-random-key',
    }

    await expect(aliceAgent.modules.askar.openStore()).rejects.toThrow(AskarStoreInvalidKeyError)

    await aliceAgent.modules.askar.deleteStore()
  })
})
