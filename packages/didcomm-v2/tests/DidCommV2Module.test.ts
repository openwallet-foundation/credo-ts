import type { DependencyManager } from '@aries-framework/core'

// import { DidCommV2EnvelopeServiceToken } from '@aries-framework/core'
import { default as didcomm } from 'didcomm-node'

import { DIDCommV2LibraryToken, DidCommV2Module } from '../src'

const dependencyManager = {
  registerInstance: jest.fn(),
  registerSingleton: jest.fn(),
  registerContextScoped: jest.fn(),
} as unknown as DependencyManager

describe('DidCommV2Module', () => {
  test('registers dependencies on the dependency manager', () => {
    const didCommV2Module = new DidCommV2Module({ didcomm })
    didCommV2Module.register(dependencyManager)

    expect(dependencyManager.registerInstance).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(DIDCommV2LibraryToken, didcomm)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(1)
    // expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(
    //   DidCommV2EnvelopeServiceToken,
    //   DidCommV2EnvelopeServiceImpl
    // )
  })
})
