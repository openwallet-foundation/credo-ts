import { InjectionSymbols, Kms } from '@credo-ts/core'
import { ariesAskar, Store } from '@hyperledger/aries-askar-shared'

import { getAgentConfig, getAgentContext } from '../../../../core/tests'
import { NodeFileSystem } from '../../../../node/src/NodeFileSystem'
import { AskarModuleConfig, AskarMultiWalletDatabaseScheme } from '../../AskarModuleConfig'
import { AskarStoreManager } from '../../AskarStoreManager'
import { AksarKeyManagementService } from '../AskarKeyManagementService'

const agentContext = getAgentContext({
  contextCorrelationId: 'default',
  agentConfig: getAgentConfig('AskarKeyManagementService'),
  registerInstances: [
    [InjectionSymbols.FileSystem, new NodeFileSystem()],
    [
      AskarModuleConfig,
      new AskarModuleConfig({
        multiWalletDatabaseScheme: AskarMultiWalletDatabaseScheme.ProfilePerWallet,
        ariesAskar: ariesAskar,
        store: {
          id: 'default',
          key: 'CwNJroKHTSSj3XvE7ZAnuKiTn2C4QkFvxEqfm5rzhNrb',
          keyDerivationMethod: 'raw',
          database: {
            type: 'sqlite',
            config: {
              inMemory: true,
            },
          },
        },
      }),
    ],
  ],
})
const agentContextTenant = getAgentContext({
  contextCorrelationId: '1a2eb2ed-49e4-43bf-bbca-de1cfbf1d890',
  dependencyManager: agentContext.dependencyManager.createChild(),
})
const service = new AksarKeyManagementService()

describe('AskarKeyManagementService', () => {
  it('correctly identifies backend as askar', () => {
    expect(service.backend).toBe('askar')
  })

  describe('profiles', () => {
    it('uses the default profile for the default agent context', async () => {
      await service.createKey(agentContext, {
        type: { kty: 'EC', crv: 'P-256' },
        keyId: 'key-1',
      })

      const askarStoreManager = agentContext.dependencyManager.resolve(AskarStoreManager)
      const sessionKey = await askarStoreManager.withSession(agentContext, (session) =>
        session.fetchKey({ name: 'key-1' })
      )
      expect(sessionKey).toEqual({
        algorithm: 'p256',
        key: expect.any(Object),
        metadata: null,
        name: 'key-1',
        tags: {},
      })
    })

    it("automatically creates a profile if it doesn't exist yet", async () => {
      const store = agentContextTenant.dependencyManager.resolve(Store)
      expect(await store.listProfiles()).toEqual(['default'])

      await service.createKey(agentContextTenant, {
        type: { kty: 'EC', crv: 'P-256' },
        keyId: 'key-2',
      })

      expect(await store.listProfiles()).toEqual(['default', `wallet-${agentContextTenant.contextCorrelationId}`])
      const session = await store.session(`wallet-${agentContextTenant.contextCorrelationId}`).open()
      expect(await session.fetchKey({ name: 'key-2' })).toEqual({
        algorithm: 'p256',
        key: expect.any(Object),
        metadata: null,
        name: 'key-2',
        tags: {},
      })
      await session.close()
    })
  })

  describe('createKey', () => {
    it('throws error if key id already exists', async () => {
      const keyId = 'test-key'
      await service.createKey(agentContext, {
        type: { kty: 'EC', crv: 'P-256' },
        keyId,
      })

      await expect(
        service.createKey(agentContext, {
          type: { kty: 'EC', crv: 'P-256' },
          keyId,
        })
      ).rejects.toThrow(new Kms.KeyManagementKeyExistsError('test-key', service.backend))
    })

    it('creates EC P-256 key successfully', async () => {
      const result = await service.createKey(agentContext, {
        type: { kty: 'EC', crv: 'P-256' },
      })

      const publicJwk = await service.getPublicKey(agentContext, result.keyId)
      expect(result.publicJwk).toEqual(publicJwk)

      expect(result).toEqual({
        keyId: result.keyId,
        publicJwk: {
          kty: 'EC',
          crv: 'P-256',
          x: expect.any(String),
          y: expect.any(String),
          kid: result.keyId,
        },
      })
    })

    it('creates EC P-384 key successfully', async () => {
      const result = await service.createKey(agentContext, {
        type: { kty: 'EC', crv: 'P-384' },
      })

      const publicJwk = await service.getPublicKey(agentContext, result.keyId)
      expect(result.publicJwk).toEqual(publicJwk)

      expect(result).toEqual({
        keyId: result.keyId,
        publicJwk: {
          kty: 'EC',
          crv: 'P-384',
          x: expect.any(String),
          y: expect.any(String),
          kid: result.keyId,
        },
      })
    })

    it('throws error for unsupported EC key P-521', async () => {
      await expect(
        service.createKey(agentContext, {
          type: { kty: 'EC', crv: 'P-521' },
        })
      ).rejects.toThrow(new Kms.KeyManagementAlgorithmNotSupportedError(`crv 'P-521' for kty 'EC'`, service.backend))
    })

    it('creates EC secp256k1 key successfully', async () => {
      const result = await service.createKey(agentContext, {
        type: { kty: 'EC', crv: 'secp256k1' },
      })

      const publicJwk = await service.getPublicKey(agentContext, result.keyId)
      expect(result.publicJwk).toEqual(publicJwk)

      expect(result).toEqual({
        keyId: result.keyId,
        publicJwk: {
          kty: 'EC',
          crv: 'secp256k1',
          x: expect.any(String),
          y: expect.any(String),
          kid: result.keyId,
        },
      })
    })

    it('throws error for unsupported EC key BLS12381G1', async () => {
      await expect(
        service.createKey(agentContext, {
          type: { kty: 'EC', crv: 'BLS12381G1' },
        })
      ).rejects.toThrow(
        new Kms.KeyManagementAlgorithmNotSupportedError(`crv 'BLS12381G1' for kty 'EC'`, service.backend)
      )
    })

    it('throws error for unsupported EC key BLS12381G2', async () => {
      await expect(
        service.createKey(agentContext, {
          type: { kty: 'EC', crv: 'BLS12381G2' },
        })
      ).rejects.toThrow(
        new Kms.KeyManagementAlgorithmNotSupportedError(`crv 'BLS12381G2' for kty 'EC'`, service.backend)
      )
    })

    it('throws error for unsupported key type RSA', async () => {
      await expect(
        service.createKey(agentContext, {
          type: { kty: 'RSA', modulusLength: 2048 },
        })
      ).rejects.toThrow(new Kms.KeyManagementAlgorithmNotSupportedError(`kty 'RSA'`, service.backend))
    })

    it('creates OKP Ed25519 key successfully', async () => {
      const result = await service.createKey(agentContext, {
        type: { kty: 'OKP', crv: 'Ed25519' },
      })

      const publicJwk = await service.getPublicKey(agentContext, result.keyId)
      expect(result.publicJwk).toEqual(publicJwk)

      expect(result).toEqual({
        keyId: result.keyId,
        publicJwk: {
          kty: 'OKP',
          crv: 'Ed25519',
          x: expect.any(String),
          kid: result.keyId,
        },
      })
    })

    it('creates OKP X25519 key successfully', async () => {
      const result = await service.createKey(agentContext, {
        type: { kty: 'OKP', crv: 'X25519' },
      })

      const publicJwk = await service.getPublicKey(agentContext, result.keyId)
      expect(result.publicJwk).toEqual(publicJwk)

      expect(result).toEqual({
        keyId: result.keyId,
        publicJwk: {
          kty: 'OKP',
          crv: 'X25519',
          x: expect.any(String),
          kid: result.keyId,
        },
      })
    })

    it('creates oct aes key successfully', async () => {
      const result = await service.createKey(agentContext, {
        type: { kty: 'oct', algorithm: 'aes', length: 256 },
      })

      const publicJwk = await service.getPublicKey(agentContext, result.keyId)
      expect(result.publicJwk).toEqual(publicJwk)

      expect(result).toEqual({
        keyId: result.keyId,
        publicJwk: {
          kty: 'oct',
          kid: result.keyId,
        },
      })
    })

    it('creates oct c20p key successfully', async () => {
      const result = await service.createKey(agentContext, {
        type: { kty: 'oct', algorithm: 'c20p' },
      })

      const publicJwk = await service.getPublicKey(agentContext, result.keyId)
      expect(result.publicJwk).toEqual(publicJwk)

      expect(result).toEqual({
        keyId: result.keyId,
        publicJwk: {
          kty: 'oct',
          kid: result.keyId,
        },
      })
    })

    it('throw error for unsupported oct hmac key', async () => {
      await expect(
        service.createKey(agentContext, {
          type: { kty: 'oct', algorithm: 'hmac', length: 512 },
        })
      ).rejects.toThrow(
        new Kms.KeyManagementAlgorithmNotSupportedError(`algorithm 'hmac' for kty 'oct'`, service.backend)
      )
    })

    it('throws error for unsupported key type', async () => {
      await expect(
        service.createKey(agentContext, {
          // @ts-expect-error Testing invalid type
          type: { kty: 'INVALID' },
        })
      ).rejects.toThrow(new Kms.KeyManagementAlgorithmNotSupportedError(`kty 'INVALID'`, service.backend))
    })
  })

  describe('sign', () => {
    it('throws error if key is not found', async () => {
      await expect(
        service.sign(agentContext, {
          keyId: 'nonexistent',
          algorithm: 'RS256',
          data: new Uint8Array([1, 2, 3]),
        })
      ).rejects.toThrow(new Kms.KeyManagementKeyNotFoundError('nonexistent', service.backend))
    })

    it('signs with ES256', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'EC', crv: 'P-256' },
      })

      const result = await service.sign(agentContext, {
        keyId,
        algorithm: 'ES256',
        data: new Uint8Array([1, 2, 3]),
      })

      expect(result).toEqual({
        signature: expect.any(Uint8Array),
      })
    })

    it('signs with EC ES384', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'EC', crv: 'P-384' },
      })

      const result = await service.sign(agentContext, {
        keyId,
        algorithm: 'ES384',
        data: new Uint8Array([1, 2, 3]),
      })

      expect(result).toEqual({
        signature: expect.any(Uint8Array),
      })
    })

    it('signs with ES256K', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'EC', crv: 'secp256k1' },
      })

      const result = await service.sign(agentContext, {
        keyId,
        algorithm: 'ES256K',
        data: new Uint8Array([1, 2, 3]),
      })

      expect(result).toEqual({
        signature: expect.any(Uint8Array),
      })
    })

    it('signs with EdDSA', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'OKP', crv: 'Ed25519' },
      })

      const result = await service.sign(agentContext, {
        keyId,
        algorithm: 'EdDSA',
        data: new Uint8Array([1, 2, 3]),
      })

      expect(result).toEqual({
        signature: expect.any(Uint8Array),
      })
    })

    it('throws error if algorithm is not supprted by backend', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'EC', crv: 'P-256' },
      })

      await expect(
        service.sign(agentContext, {
          keyId,
          algorithm: 'RS256',
          data: new Uint8Array([1, 2, 3]),
        })
      ).rejects.toThrow(
        new Kms.KeyManagementAlgorithmNotSupportedError(
          `signing and verification with algorithm 'RS256'`,
          service.backend
        )
      )
    })

    it('throws error if key type does not match algorithm', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'EC', crv: 'P-256' },
      })

      await expect(
        service.sign(agentContext, {
          keyId,
          algorithm: 'ES384',
          data: new Uint8Array([1, 2, 3]),
        })
      ).rejects.toThrow(
        new Kms.KeyManagementError(
          `EC key with crv 'P-256' cannot be used with algorithm 'ES384' for signature creation or verification. Allowed algs are 'ES256'`
        )
      )
    })

    it('throws error when signing with x25519 key', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'OKP', crv: 'X25519' },
      })

      await expect(
        service.sign(agentContext, {
          keyId,
          algorithm: 'EdDSA',
          data: new Uint8Array([1, 2, 3]),
        })
      ).rejects.toThrow(
        new Kms.KeyManagementError(
          `OKP key with crv 'X25519' cannot be used with algorithm 'EdDSA' for signature creation or verification.`
        )
      )
    })
  })

  describe('verify', () => {
    it('throws error if key is not found', async () => {
      await expect(
        service.verify(agentContext, {
          key: 'nonexistent',
          algorithm: 'ES256',
          data: new Uint8Array([1, 2, 3]),
          signature: new Uint8Array([1, 2, 3]),
        })
      ).rejects.toThrow(new Kms.KeyManagementKeyNotFoundError('nonexistent', service.backend))
    })

    it('verifies ES256 signature', async () => {
      const { keyId, publicJwk } = await service.createKey(agentContext, {
        type: { kty: 'EC', crv: 'P-256' },
      })

      const data = new Uint8Array([1, 2, 3])
      const { signature } = await service.sign(agentContext, {
        keyId,
        algorithm: 'ES256',
        data,
      })

      const result = await service.verify(agentContext, {
        key: publicJwk,
        algorithm: 'ES256',
        data,
        signature,
      })

      expect(result).toEqual({ verified: true, publicJwk })

      // Test invalid signature
      const invalidSignature = new Uint8Array(signature.length)
      signature.forEach((byte, i) => {
        invalidSignature[i] = byte ^ 0xff
      })

      const invalidResult = await service.verify(agentContext, {
        key: keyId,
        algorithm: 'ES256',
        data,
        signature: invalidSignature,
      })

      expect(invalidResult).toEqual({ verified: false })
    })

    it('verifies ES384 signature', async () => {
      const { keyId, publicJwk } = await service.createKey(agentContext, {
        type: { kty: 'EC', crv: 'P-384' },
      })

      const data = new Uint8Array([1, 2, 3])
      const { signature } = await service.sign(agentContext, {
        keyId,
        algorithm: 'ES384',
        data,
      })

      const result = await service.verify(agentContext, {
        key: publicJwk,
        algorithm: 'ES384',
        data,
        signature,
      })

      expect(result).toEqual({ verified: true, publicJwk })

      // Test invalid signature
      const invalidSignature = new Uint8Array(signature.length)
      signature.forEach((byte, i) => {
        invalidSignature[i] = byte ^ 0xff
      })

      const invalidResult = await service.verify(agentContext, {
        key: keyId,
        algorithm: 'ES384',
        data,
        signature: invalidSignature,
      })

      expect(invalidResult).toEqual({ verified: false })
    })

    it('verifies EdDSA Ed25519 signature', async () => {
      const { keyId, publicJwk } = await service.createKey(agentContext, {
        type: { kty: 'OKP', crv: 'Ed25519' },
      })

      const data = new Uint8Array([1, 2, 3])
      const { signature } = await service.sign(agentContext, {
        keyId,
        algorithm: 'EdDSA',
        data,
      })

      const result = await service.verify(agentContext, {
        key: keyId,
        algorithm: 'EdDSA',
        data,
        signature,
      })

      expect(result).toEqual({ verified: true, publicJwk })

      // Test invalid signature
      const invalidSignature = new Uint8Array(signature.length)
      signature.forEach((byte, i) => {
        invalidSignature[i] = byte ^ 0xff
      })

      const invalidResult = await service.verify(agentContext, {
        key: keyId,
        algorithm: 'EdDSA',
        data,
        signature: invalidSignature,
      })

      expect(invalidResult).toEqual({ verified: false })
    })

    it('throws error if key type does not match algorithm', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'EC', crv: 'P-256' },
      })

      await expect(
        service.verify(agentContext, {
          key: keyId,
          algorithm: 'ES384',
          data: new Uint8Array([1, 2, 3]),
          signature: new Uint8Array([1, 2, 3]),
        })
      ).rejects.toThrow(
        new Kms.KeyManagementError(
          `EC key with crv 'P-256' cannot be used with algorithm 'ES384' for signature creation or verification. Allowed algs are 'ES256'`
        )
      )
    })

    it('throws error for X25519 key', async () => {
      const { publicJwk } = await service.createKey(agentContext, {
        type: { kty: 'OKP', crv: 'X25519' },
      })

      await expect(
        service.verify(agentContext, {
          key: publicJwk,
          algorithm: 'EdDSA',
          data: new Uint8Array([1, 2, 3]),
          signature: new Uint8Array([1, 2, 3]),
        })
      ).rejects.toThrow(
        new Kms.KeyManagementError(
          `OKP key with crv 'X25519' cannot be used with algorithm 'EdDSA' for signature creation or verification.`
        )
      )
    })

    it('returns false for modified data', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'EC', crv: 'P-384' },
      })

      const data = new Uint8Array([1, 2, 3])
      const { signature } = await service.sign(agentContext, {
        keyId,
        algorithm: 'ES384',
        data,
      })

      const modifiedData = new Uint8Array([1, 2, 4])
      const result = await service.verify(agentContext, {
        key: keyId,
        algorithm: 'ES384',
        data: modifiedData,
        signature,
      })

      expect(result).toEqual({ verified: false })
    })
  })

  describe('getPublicKey', () => {
    it('returns null if key does not exist', async () => {
      const result = await service.getPublicKey(agentContext, 'nonexistent')
      expect(result).toBeNull()
    })

    it('returns public key for EC key pair', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'EC', crv: 'P-256' },
      })

      const publicKey = await service.getPublicKey(agentContext, keyId)

      // Should not contain private key (d) component
      expect(publicKey).toEqual({
        kid: keyId,
        kty: 'EC',
        crv: 'P-256',
        // Public key should have x and y coordinates
        x: expect.any(String),
        y: expect.any(String),
      })
    })

    it('returns public key for Ed25519 key pair', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'OKP', crv: 'Ed25519' },
      })

      const publicKey = await service.getPublicKey(agentContext, keyId)

      // Should not contain private key (d) component
      expect(publicKey).toEqual({
        kid: keyId,
        kty: 'OKP',
        crv: 'Ed25519',
        // Public key should have x coordinate
        x: expect.any(String),
      })
    })

    it('returns no key matterial for symmetric keys', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'oct', algorithm: 'aes', length: 256 },
      })

      const key = await service.getPublicKey(agentContext, keyId)

      // Should not contain private key (k) component
      expect(key).toEqual({
        kid: keyId,
        kty: 'oct',
      })
    })
  })

  describe('importKey', () => {
    it('throws error when importing RSA key', async () => {
      await expect(
        service.importKey(agentContext, {
          privateJwk: {
            kty: 'RSA',
            n: 'test-n',
            e: 'AQAB',
            d: 'test-d',
            p: 'test-p',
            q: 'test-q',
            dp: 'test-dp',
            dq: 'test-dq',
            qi: 'test-qi',
          },
        })
      ).rejects.toThrow(new Kms.KeyManagementAlgorithmNotSupportedError(`kty 'RSA'`, service.backend))
    })

    it('imports EC P-256 key pair with provided keyId', async () => {
      const keyId = 'test-key-id'

      const result = await service.importKey(agentContext, {
        privateJwk: {
          kid: keyId,
          kty: 'EC',
          d: '58pb2cKWs0VmIXtHz3ayrZCGKRUnWrb9QvbfbAkGI3c',
          crv: 'P-256',
          x: 'wPuEY7sKE2x2rp96_QtnRhSswV2AgBk_cX5TCmvLxPs',
          y: 'OG0Lm7begM02Vikg2iI70nknoWNygwlUoBGLLFDT3Zs',
        },
      })

      expect(result).toEqual({
        keyId,
        publicJwk: {
          kid: keyId,
          kty: 'EC',
          crv: 'P-256',
          x: 'wPuEY7sKE2x2rp96_QtnRhSswV2AgBk_cX5TCmvLxPs',
          y: 'OG0Lm7begM02Vikg2iI70nknoWNygwlUoBGLLFDT3Zs',
        },
      })

      // Verify key was stored
      const storedKey = await service.getPublicKey(agentContext, keyId)
      expect(storedKey).toEqual({
        kid: keyId,
        kty: 'EC',
        crv: 'P-256',
        x: 'wPuEY7sKE2x2rp96_QtnRhSswV2AgBk_cX5TCmvLxPs',
        y: 'OG0Lm7begM02Vikg2iI70nknoWNygwlUoBGLLFDT3Zs',
      })
    })

    it('imports EC P-384 key pair', async () => {
      const result = await service.importKey(agentContext, {
        privateJwk: {
          kty: 'EC',
          d: 'O2WHQQDOvifmepR3kxDRJh1TBd-LaEww5lYzrd14lzfi4IVIVm__ZQVoUQ0ws56e',
          crv: 'P-384',
          x: 'Vvlf4tmvKT1qTOptwSelZBoazQmrsKvg1poITeOoxqbZEgNvfa9cUObhQlbhHjGP',
          y: 'gTMFQKmXdcK31ycnDULFEtCLF3vsXNnAcQcFbeapxqBpo_wMdSP-G8pN9jPMDPYS',
        },
      })

      expect(result).toEqual({
        keyId: result.keyId,
        publicJwk: {
          kid: result.keyId,
          kty: 'EC',
          crv: 'P-384',
          x: 'Vvlf4tmvKT1qTOptwSelZBoazQmrsKvg1poITeOoxqbZEgNvfa9cUObhQlbhHjGP',
          y: 'gTMFQKmXdcK31ycnDULFEtCLF3vsXNnAcQcFbeapxqBpo_wMdSP-G8pN9jPMDPYS',
        },
      })

      // Verify key was stored
      const storedKey = await service.getPublicKey(agentContext, result.keyId)
      expect(storedKey).toEqual({
        kid: result.keyId,
        kty: 'EC',
        crv: 'P-384',
        x: 'Vvlf4tmvKT1qTOptwSelZBoazQmrsKvg1poITeOoxqbZEgNvfa9cUObhQlbhHjGP',
        y: 'gTMFQKmXdcK31ycnDULFEtCLF3vsXNnAcQcFbeapxqBpo_wMdSP-G8pN9jPMDPYS',
      })
    })

    it('throws error when importing EC P-521 key pair', async () => {
      await expect(
        service.importKey(agentContext, {
          privateJwk: {
            kty: 'EC',
            d: 'Af8IOTaFSKF65L6vI-UTAhUpO0LbtiK-2W-Qs5-jvpLAnmalTUNX3r7mZhH1zioq26NayCFTgEZVWAwMgeEqindK',
            crv: 'P-521',
            x: 'AfenCyIa_2pnNYybfgdhy19fVnrBksaHgQUy4bCu3kiA8_cZujnsO6RgpIWx2ip3cdXsi2ujK-mShjIveNwdwiBF',
            y: 'AVKOcCI-Zg_0IlhpCJ77wwMFjXuVpt-nilcSQY9E0JADcXQGaWSAWKWpAbCAeeevoBHepELbIJ5bX3EnU3yKMMQL',
          },
        })
      ).rejects.toThrow(new Kms.KeyManagementAlgorithmNotSupportedError(`crv 'P-521' for kty 'EC'`, service.backend))
    })

    it('imports EC secp256k1 key pair', async () => {
      const result = await service.importKey(agentContext, {
        privateJwk: {
          kty: 'EC',
          d: 'eGYeYMILykL1YnAZde1aSo9uQtKe-HeALQu2Yv-ZcQ0',
          crv: 'secp256k1',
          x: 'ZLRfyFqy_hVG_SWH7SlErOCMkztJNoZZHdJvMt6yPSE',
          y: 'O89repvsgjOY9qAOZcmdIiITHU4Frk00ryKGDw7OefQ',
        },
      })

      expect(result).toEqual({
        keyId: result.keyId,
        publicJwk: {
          kid: result.keyId,
          kty: 'EC',
          crv: 'secp256k1',
          x: 'ZLRfyFqy_hVG_SWH7SlErOCMkztJNoZZHdJvMt6yPSE',
          y: 'O89repvsgjOY9qAOZcmdIiITHU4Frk00ryKGDw7OefQ',
        },
      })

      // Verify key was stored
      const storedKey = await service.getPublicKey(agentContext, result.keyId)
      expect(storedKey).toEqual({
        kid: result.keyId,
        kty: 'EC',
        crv: 'secp256k1',
        x: 'ZLRfyFqy_hVG_SWH7SlErOCMkztJNoZZHdJvMt6yPSE',
        y: 'O89repvsgjOY9qAOZcmdIiITHU4Frk00ryKGDw7OefQ',
      })
    })

    it('imports OKP Ed25519 key pair', async () => {
      const result = await service.importKey(agentContext, {
        privateJwk: {
          kty: 'OKP',
          d: 'IbJKmlKmRDoSkO0xM_DkeorvBz--1O_qGlmrb6_1Cms',
          crv: 'Ed25519',
          x: '4-CJ6REW9mUtp2ouh5rhQ9wvfsZE278NnPffTkLeNYI',
        },
      })

      expect(result).toEqual({
        keyId: result.keyId,
        publicJwk: {
          kid: result.keyId,
          kty: 'OKP',
          crv: 'Ed25519',
          x: '4-CJ6REW9mUtp2ouh5rhQ9wvfsZE278NnPffTkLeNYI',
        },
      })

      // Verify key was stored
      const storedKey = await service.getPublicKey(agentContext, result.keyId)
      expect(storedKey).toEqual({
        kid: result.keyId,
        kty: 'OKP',
        crv: 'Ed25519',
        x: '4-CJ6REW9mUtp2ouh5rhQ9wvfsZE278NnPffTkLeNYI',
      })
    })

    it('imports OKP X25519 key pair', async () => {
      const result = await service.importKey(agentContext, {
        privateJwk: {
          kty: 'OKP',
          d: '7LL0_o4FsS4w-mCFhcKlbaX8qsqgeNjTxzDV4lVj0us',
          crv: 'X25519',
          x: 'DdYl5R2IpY7VwLr88mgG9PBjK7jICuipVYhOzz8F3Fs',
        },
      })

      expect(result).toEqual({
        keyId: result.keyId,
        publicJwk: {
          kid: result.keyId,
          kty: 'OKP',
          crv: 'X25519',
          x: 'DdYl5R2IpY7VwLr88mgG9PBjK7jICuipVYhOzz8F3Fs',
        },
      })

      // Verify key was stored
      const storedKey = await service.getPublicKey(agentContext, result.keyId)
      expect(storedKey).toEqual({
        kid: result.keyId,
        kty: 'OKP',
        crv: 'X25519',
        x: 'DdYl5R2IpY7VwLr88mgG9PBjK7jICuipVYhOzz8F3Fs',
      })
    })

    // NOTE: we need to tweak the API here a bit I think. Just the JWK is not enough
    // we need something of an alg.
    it('throws error when importing oct key pair', async () => {
      await expect(
        service.importKey(agentContext, {
          privateJwk: {
            kty: 'oct',
            k: 'something',
          },
        })
      ).rejects.toThrow(
        new Kms.KeyManagementAlgorithmNotSupportedError(`importing keys with kty 'oct'`, service.backend)
      )
    })

    it('generates random keyId when not provided', async () => {
      const privateJwk: Kms.KmsJwkPrivate = {
        kty: 'EC',
        d: 'ESGpJ7SIi3H7h9pkIkr-M8QDWamtiewze5_U_nP2fJg',
        crv: 'P-256',
        x: 'HlwSCoy8jWXx_KifMEnt4zDjPb0eyi0eH9C9awOdR70',
        y: 's-Drm_bZ4eVV_UkGnLr62sI2TWibkdLFFc0dAT6ASL8',
      }

      const result = await service.importKey(agentContext, { privateJwk })
      expect(result).toEqual({
        keyId: expect.any(String),
        publicJwk: {
          kid: expect.any(String),
          kty: 'EC',
          crv: 'P-256',
          x: 'HlwSCoy8jWXx_KifMEnt4zDjPb0eyi0eH9C9awOdR70',
          y: 's-Drm_bZ4eVV_UkGnLr62sI2TWibkdLFFc0dAT6ASL8',
        },
      })
    })

    it('throws error if invalid key data provided', async () => {
      const privateJwk: Kms.KmsJwkPrivate = {
        kty: 'EC',
        crv: 'P-256',
        x: 'test-x',
        y: 'test-y',
        d: 'test-d',
      }

      await expect(service.importKey(agentContext, { privateJwk })).rejects.toThrow(
        new Kms.KeyManagementError('Error importing key', { cause: new Error('Base64 decoding error') })
      )
    })

    it('throws error if key with same id already exists', async () => {
      const keyId = 'existing-key'
      const privateJwk: Kms.KmsJwkPrivate = {
        kid: keyId,
        kty: 'EC',
        d: '_jBF0d-pZB_Os3CrJsPthA-CDXSy17vCdyRzuAIFbaM',
        crv: 'P-256',
        x: 'IcwG4MdHi8u59kc5h-cQC31ZVC50g7qlJvWkzh_j9zw',
        y: 'iY57CM0fuBNx5ef2iviA2OiUtfExERAFLyYD1yno6Xo',
      }

      // First import succeeds
      await service.importKey(agentContext, { privateJwk })

      // Second import with same keyId fails
      await expect(service.importKey(agentContext, { privateJwk })).rejects.toThrow(
        new Kms.KeyManagementKeyExistsError('existing-key', service.backend)
      )
    })

    it('throws error when key is provided with unknown kty', async () => {
      await expect(
        service.importKey(agentContext, {
          privateJwk: {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            kty: 'something',
          },
        })
      ).rejects.toThrow(new Kms.KeyManagementAlgorithmNotSupportedError(`kty 'something'`, service.backend))
    })
  })

  describe('deleteKey', () => {
    it('deletes existing key', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'EC', crv: 'P-256' },
      })

      // Verify key exists
      expect(await service.getPublicKey(agentContext, keyId)).toBeTruthy()

      // Delete key
      expect(await service.deleteKey(agentContext, { keyId })).toBe(true)

      // Verify key no longer exists
      expect(await service.getPublicKey(agentContext, keyId)).toBeNull()
    })

    it('succeeds when deleting non-existent key', async () => {
      expect(await service.deleteKey(agentContext, { keyId: 'nonexistent' })).toBe(false)
    })

    it('removes key from storage completely', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'EC', crv: 'P-256' },
      })

      await service.deleteKey(agentContext, { keyId })

      // Verify we can't use the deleted key
      await expect(
        service.sign(agentContext, {
          keyId,
          algorithm: 'ES256',
          data: new Uint8Array([1, 2, 3]),
        })
      ).rejects.toThrow(new Kms.KeyManagementKeyNotFoundError(keyId, service.backend))
    })
  })
})
