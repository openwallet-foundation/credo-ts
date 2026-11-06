import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { InjectionSymbols, utils } from '@credo-ts/core'
import { NativeAskar } from '@openwallet-foundation/askar-nodejs'
import { Store } from '@openwallet-foundation/askar-shared'
import { getAgentConfig, getAgentContext } from '../../../core/tests'
import { NodeFileSystem } from '../../../node/src/NodeFileSystem'
import { AskarModuleConfig, type AskarModuleConfigStoreOptions } from '../AskarModuleConfig'
import { AskarStoreManager } from '../AskarStoreManager'
import { AskarStoreAlreadyRegisteredError } from '../error'

function getStoreManagerAndContext(store: AskarModuleConfigStoreOptions) {
  const config = new AskarModuleConfig({ askar: NativeAskar, store })
  const agentContext = getAgentContext({
    agentConfig: getAgentConfig('AskarStoreManager'),
    registerInstances: [
      [InjectionSymbols.FileSystem, new NodeFileSystem()],
      [AskarModuleConfig, config],
    ],
  })

  return { agentContext, storeManager: new AskarStoreManager(new NodeFileSystem(), config) }
}

describe('AskarStoreManager', () => {
  const storeDirectory = path.join(tmpdir(), 'credo-askar-store-manager', utils.uuid())

  afterEach(() => {
    vi.restoreAllMocks()
  })

  afterAll(async () => {
    await rm(storeDirectory, { recursive: true, force: true })
  })

  it('opens the store once when sessions are opened concurrently', async () => {
    const { agentContext, storeManager } = getStoreManagerAndContext({
      id: 'concurrent-sessions',
      key: 'CwNJroKHTSSj3XvE7ZAnuKiTn2C4QkFvxEqfm5rzhNrb',
      keyDerivationMethod: 'raw',
      database: { type: 'sqlite', config: { inMemory: true } },
    })

    const openSpy = vi.spyOn(Store, 'open')
    const provisionSpy = vi.spyOn(Store, 'provision')

    await Promise.all([
      storeManager.withSession(agentContext, () => undefined),
      storeManager.withSession(agentContext, () => undefined),
    ])

    expect(openSpy).toHaveBeenCalledTimes(1)
    expect(provisionSpy).toHaveBeenCalledTimes(1)

    await storeManager.closeStore(agentContext)
  })

  it('closes the store that loses a concurrent open', async () => {
    const { agentContext, storeManager } = getStoreManagerAndContext({
      id: 'concurrent-open',
      key: 'CwNJroKHTSSj3XvE7ZAnuKiTn2C4QkFvxEqfm5rzhNrb',
      keyDerivationMethod: 'raw',
      database: {
        type: 'sqlite',
        config: { path: path.join(storeDirectory, utils.uuid(), 'sqlite.db') },
      },
    })

    await storeManager.provisionStore(agentContext)
    await storeManager.closeStore(agentContext)

    const closeSpy = vi.spyOn(Store.prototype, 'close')
    const results = await Promise.allSettled([
      storeManager.openStore(agentContext),
      storeManager.openStore(agentContext),
    ])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.find((result) => result.status === 'rejected')).toEqual({
      status: 'rejected',
      reason: expect.any(AskarStoreAlreadyRegisteredError),
    })
    expect(closeSpy).toHaveBeenCalledTimes(1)
    expect(storeManager.isStoreOpen(agentContext)).toBe(true)

    await storeManager.deleteStore(agentContext)
  })

  it('uses the store opened by openStore while a session is opening the store', async () => {
    const { agentContext, storeManager } = getStoreManagerAndContext({
      id: 'concurrent-session-and-open',
      key: 'CwNJroKHTSSj3XvE7ZAnuKiTn2C4QkFvxEqfm5rzhNrb',
      keyDerivationMethod: 'raw',
      database: {
        type: 'sqlite',
        config: { path: path.join(storeDirectory, utils.uuid(), 'sqlite.db') },
      },
    })

    await storeManager.provisionStore(agentContext)
    await storeManager.closeStore(agentContext)

    // Hold the open started by the session until openStore has registered its store
    const openStore = Store.open.bind(Store)
    let onSessionOpenStarted!: () => void
    const sessionOpenStarted = new Promise<void>((resolve) => {
      onSessionOpenStarted = resolve
    })
    let onReleaseSessionOpen!: () => void
    const releaseSessionOpen = new Promise<void>((resolve) => {
      onReleaseSessionOpen = resolve
    })
    vi.spyOn(Store, 'open').mockImplementationOnce(async (options) => {
      onSessionOpenStarted()
      await releaseSessionOpen
      return openStore(options)
    })
    const closeSpy = vi.spyOn(Store.prototype, 'close')

    const session = storeManager.withSession(agentContext, () => 'session result')
    await sessionOpenStarted
    const store = await storeManager.openStore(agentContext)
    onReleaseSessionOpen()

    await expect(session).resolves.toBe('session result')
    expect(closeSpy).toHaveBeenCalledTimes(1)
    expect(closeSpy.mock.contexts[0]).not.toBe(store)
    expect(storeManager.isStoreOpen(agentContext)).toBe(true)

    await storeManager.deleteStore(agentContext)
  })

  it('throws the error from losing a concurrent provision without wrapping it', async () => {
    const { agentContext, storeManager } = getStoreManagerAndContext({
      id: 'concurrent-provision',
      key: 'CwNJroKHTSSj3XvE7ZAnuKiTn2C4QkFvxEqfm5rzhNrb',
      keyDerivationMethod: 'raw',
      database: { type: 'sqlite', config: { inMemory: true } },
    })

    // Hold the first provision until the second one has registered its store
    const provisionStore = Store.provision.bind(Store)
    let onReleaseFirstProvision!: () => void
    const releaseFirstProvision = new Promise<void>((resolve) => {
      onReleaseFirstProvision = resolve
    })
    vi.spyOn(Store, 'provision').mockImplementationOnce(async (options) => {
      await releaseFirstProvision
      return provisionStore(options)
    })

    const firstProvision = storeManager.provisionStore(agentContext)
    await storeManager.provisionStore(agentContext)
    onReleaseFirstProvision()

    await expect(firstProvision).rejects.toBeInstanceOf(AskarStoreAlreadyRegisteredError)

    await storeManager.closeStore(agentContext)
  })

  it('throws AskarStoreAlreadyRegisteredError when closing the store that loses a concurrent provision fails', async () => {
    const { agentContext, storeManager } = getStoreManagerAndContext({
      id: 'concurrent-provision-close-error',
      key: 'CwNJroKHTSSj3XvE7ZAnuKiTn2C4QkFvxEqfm5rzhNrb',
      keyDerivationMethod: 'raw',
      database: { type: 'sqlite', config: { inMemory: true } },
    })

    // Hold the first provision until the second one has registered its store
    const provisionStore = Store.provision.bind(Store)
    let onReleaseFirstProvision!: () => void
    const releaseFirstProvision = new Promise<void>((resolve) => {
      onReleaseFirstProvision = resolve
    })
    vi.spyOn(Store, 'provision').mockImplementationOnce(async (options) => {
      await releaseFirstProvision
      return provisionStore(options)
    })

    const firstProvision = storeManager.provisionStore(agentContext)
    await storeManager.provisionStore(agentContext)

    const closeStore = Store.prototype.close
    vi.spyOn(Store.prototype, 'close').mockImplementationOnce(async function (this: Store) {
      await closeStore.call(this)
      throw new Error('close failed')
    })
    onReleaseFirstProvision()

    await expect(firstProvision).rejects.toBeInstanceOf(AskarStoreAlreadyRegisteredError)
    expect(storeManager.isStoreOpen(agentContext)).toBe(true)

    await storeManager.closeStore(agentContext)
  })
})
