import { DependencyManager } from '@credo-ts/core'
import { DidCommCredentialExchangeRepository } from '@credo-ts/didcomm'

describe('resolveDidCommCredentialExchangeRepository', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doMock('@credo-ts/didcomm', () => ({ DidCommCredentialExchangeRepository }))
  })

  afterEach(() => {
    vi.doUnmock('@credo-ts/didcomm')
  })

  test('resolves a registered repository using the supplied dependency manager', async () => {
    const dependencyManager = new DependencyManager()
    dependencyManager.registerSingleton(DidCommCredentialExchangeRepository)
    const repository = { findByQuery: vi.fn(), update: vi.fn() }
    const resolve = vi.spyOn(dependencyManager, 'resolve').mockReturnValue(repository)
    const { resolveDidCommCredentialExchangeRepository } = await import('../optionalDependencies')

    await expect(resolveDidCommCredentialExchangeRepository(dependencyManager)).resolves.toEqual({
      repository,
      unavailableReason: undefined,
    })
    expect(resolve).toHaveBeenCalledWith(DidCommCredentialExchangeRepository)
  })

  test('distinguishes an unregistered credentials module from a missing package', async () => {
    const { resolveDidCommCredentialExchangeRepository } = await import('../optionalDependencies')

    await expect(resolveDidCommCredentialExchangeRepository(new DependencyManager())).resolves.toEqual({
      repository: undefined,
      unavailableReason: 'the DIDComm credentials module is not registered',
    })
  })

  test.each(['MODULE_NOT_FOUND', 'ERR_MODULE_NOT_FOUND'])('handles a missing DIDComm package (%s)', async (code) => {
    vi.doMock('@credo-ts/didcomm', () => {
      throw Object.assign(new Error("Cannot find package '@credo-ts/didcomm'"), { code })
    })
    const { resolveDidCommCredentialExchangeRepository } = await import('../optionalDependencies')

    await expect(resolveDidCommCredentialExchangeRepository(new DependencyManager())).resolves.toEqual({
      repository: undefined,
      unavailableReason: '@credo-ts/didcomm is not installed',
    })
  })

  test.each([
    new Error('DIDComm initialization failed'),
    Object.assign(new Error("Cannot find package 'transitive-dependency'"), { code: 'ERR_MODULE_NOT_FOUND' }),
  ])('propagates unexpected import errors: %s', async (error) => {
    vi.doMock('@credo-ts/didcomm', () => {
      throw error
    })
    const { resolveDidCommCredentialExchangeRepository } = await import('../optionalDependencies')

    await expect(resolveDidCommCredentialExchangeRepository(new DependencyManager())).rejects.toBeDefined()
  })

  test('propagates repository resolution failures', async () => {
    const dependencyManager = new DependencyManager()
    dependencyManager.registerSingleton(DidCommCredentialExchangeRepository)
    const error = new Error('Repository dependency is unavailable')
    vi.spyOn(dependencyManager, 'resolve').mockImplementation(() => {
      throw error
    })
    const { resolveDidCommCredentialExchangeRepository } = await import('../optionalDependencies')

    await expect(resolveDidCommCredentialExchangeRepository(dependencyManager)).rejects.toBe(error)
  })
})
