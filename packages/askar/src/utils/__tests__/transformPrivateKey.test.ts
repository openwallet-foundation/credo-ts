import '@openwallet-foundation/askar-nodejs'
import { TypedArrayEncoder } from '@credo-ts/core'
import { LocalKeyHandle } from '@openwallet-foundation/askar-shared'
import { transformPrivateKeyToPrivateJwk, transformSeedToPrivateJwk } from '../transformPrivateKey'

describe('transformPrivateKey', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('frees the key created by transformPrivateKeyToPrivateJwk', () => {
    const freeKeySpy = vi.spyOn(LocalKeyHandle.prototype, 'free')

    const { privateJwk } = transformPrivateKeyToPrivateJwk({
      type: { kty: 'EC', crv: 'P-256' },
      privateKey: TypedArrayEncoder.fromUtf8String('00000000000000000000000000000My1'),
    })

    expect(privateJwk).toEqual({
      kty: 'EC',
      crv: 'P-256',
      x: expect.any(String),
      y: expect.any(String),
      d: expect.any(String),
    })
    expect(freeKeySpy).toHaveBeenCalledTimes(1)
  })

  it('frees the key created by transformSeedToPrivateJwk', () => {
    const freeKeySpy = vi.spyOn(LocalKeyHandle.prototype, 'free')

    const { privateJwk } = transformSeedToPrivateJwk({
      type: { kty: 'OKP', crv: 'Ed25519' },
      seed: TypedArrayEncoder.fromUtf8String('00000000000000000000000000000My1'),
    })

    expect(privateJwk).toEqual({ kty: 'OKP', crv: 'Ed25519', x: expect.any(String), d: expect.any(String) })
    expect(freeKeySpy).toHaveBeenCalledTimes(1)
  })
})
