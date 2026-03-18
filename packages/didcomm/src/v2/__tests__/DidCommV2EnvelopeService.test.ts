import type { AgentContext } from '@credo-ts/core'
import { getAgentConfig, getAgentContext } from '../../../../core/tests/helpers'
import { InjectionSymbols, JsonEncoder, Kms, TypedArrayEncoder } from '@credo-ts/core'
import { randomBytes } from 'node:crypto'
import { NodeInMemoryKeyManagementStorage, NodeKeyManagementService } from '../../../../node/src'
import { DidCommV2EnvelopeService } from '../DidCommV2EnvelopeService'
import type { DidCommV2EncryptedMessage, DidCommV2PlaintextMessage } from '../types'
import testLogger from '../../../../core/tests/logger'

function supportsX25519Ecdh(): boolean {
  try {
    require('node:crypto').createECDH('x25519')
    return true
  } catch {
    return false
  }
}

/**
 * Mock KMS that performs pass-through "encryption" for ECDH-1PU+A256KW and ECDH-ES+A256KW.
 * Used when Node crypto lacks X25519 support (e.g. older OpenSSL).
 */
class MockEcdh1PuKeyManagementService implements Kms.KeyManagementService {
  readonly backend = 'mock-ecdh1pu'
  private keys = new Map<string, Kms.KmsJwkPublicOkp & { crv: 'X25519' }>()

  isOperationSupported(_ctx: AgentContext, operation: Kms.KmsOperation): boolean {
    if (operation.operation === 'createKey')
      return operation.type.kty === 'OKP' && operation.type.crv === 'X25519'
    if (operation.operation === 'encrypt') {
      const alg = operation.keyAgreement?.algorithm
      return (
        operation.encryption?.algorithm === 'A256GCM' &&
        (alg === 'ECDH-1PU+A256KW' || alg === 'ECDH-ES+A256KW')
      )
    }
    if (operation.operation === 'decrypt') {
      const alg = operation.keyAgreement?.algorithm
      return (
        operation.decryption?.algorithm === 'A256GCM' &&
        (alg === 'ECDH-1PU+A256KW' || alg === 'ECDH-ES+A256KW')
      )
    }
    if (operation.operation === 'randomBytes') return true
    if (operation.operation === 'deleteKey') return true
    return false
  }

  async getPublicKey(_ctx: AgentContext, keyId: string): Promise<Kms.KmsJwkPublic | null> {
    return this.keys.get(keyId) ?? null
  }

  async createKey(ctx: AgentContext, options: Kms.KmsCreateKeyOptions<Kms.KmsCreateKeyTypeOkp>) {
    if (options.type.kty !== 'OKP' || options.type.crv !== 'X25519') {
      throw new Kms.KeyManagementAlgorithmNotSupportedError('Only OKP X25519 supported', this.backend)
    }
    const keyId = options.keyId ?? `mock-key-${randomBytes(8).toString('hex')}`
    const x = TypedArrayEncoder.toBase64URL(randomBytes(32))
    const publicJwk = {
      kty: 'OKP' as const,
      crv: 'X25519' as const,
      x,
      kid: keyId,
    }
    this.keys.set(keyId, publicJwk)
    return { keyId, publicJwk }
  }

  async importKey(): Promise<Kms.KmsImportKeyReturn<never>> {
    throw new Error('Mock KMS does not support importKey')
  }

  async deleteKey(): Promise<boolean> {
    return true
  }

  async sign(): Promise<Kms.KmsSignReturn> {
    throw new Error('Mock KMS does not support sign')
  }

  async verify(): Promise<Kms.KmsVerifyReturn> {
    throw new Error('Mock KMS does not support verify')
  }

  async encrypt(ctx: AgentContext, options: Kms.KmsEncryptOptions): Promise<Kms.KmsEncryptReturn> {
    const keyAgreement = options.key.keyAgreement
    if (
      !keyAgreement ||
      (keyAgreement.algorithm !== 'ECDH-1PU+A256KW' && keyAgreement.algorithm !== 'ECDH-ES+A256KW')
    ) {
      throw new Error('Mock only supports ECDH-1PU+A256KW and ECDH-ES+A256KW')
    }
    const iv = randomBytes(12)
    const tag = randomBytes(16)
    const epkX = TypedArrayEncoder.toBase64URL(randomBytes(32))
    const ephemeralPublicKey = { kty: 'OKP' as const, crv: 'X25519' as const, x: epkX }
    return {
      encrypted: new Uint8Array(options.data),
      iv,
      tag,
      encryptedKey: {
        encrypted: new Uint8Array(options.data),
        ephemeralPublicKey,
      },
    }
  }

  async decrypt(ctx: AgentContext, options: Kms.KmsDecryptOptions): Promise<Kms.KmsDecryptReturn> {
    const keyAgreement = options.key.keyAgreement
    if (
      !keyAgreement ||
      (keyAgreement.algorithm !== 'ECDH-1PU+A256KW' && keyAgreement.algorithm !== 'ECDH-ES+A256KW')
    ) {
      throw new Error('Mock only supports ECDH-1PU+A256KW and ECDH-ES+A256KW')
    }
    return { data: options.encrypted }
  }

  randomBytes(_ctx: AgentContext, options: Kms.KmsRandomBytesOptions): Kms.KmsRandomBytesReturn {
    return randomBytes(options.length)
  }
}

function getKmsBackends(): Kms.KeyManagementService[] {
  if (supportsX25519Ecdh()) {
    return [new NodeKeyManagementService(new NodeInMemoryKeyManagementStorage())]
  }
  return [new MockEcdh1PuKeyManagementService()]
}

describe('DidCommV2EnvelopeService', () => {
  const agentConfig = getAgentConfig('DidCommV2EnvelopeService')
  const agentContext = getAgentContext({
    agentConfig,
    kmsBackends: getKmsBackends(),
    registerInstances: [[InjectionSymbols.Logger, testLogger]],
  })
  let envelopeService: DidCommV2EnvelopeService
  let senderKey: Kms.PublicJwk<Kms.X25519PublicJwk>
  let recipientKey: Kms.PublicJwk<Kms.X25519PublicJwk>

  beforeAll(async () => {
    agentContext.dependencyManager.registerSingleton(DidCommV2EnvelopeService)
    envelopeService = agentContext.dependencyManager.resolve(DidCommV2EnvelopeService)

    const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
    const sender = await kms.createKey({
      type: { kty: 'OKP', crv: 'X25519' },
    })
    const recipient = await kms.createKey({
      type: { kty: 'OKP', crv: 'X25519' },
    })

    senderKey = Kms.PublicJwk.fromPublicJwk(sender.publicJwk) as Kms.PublicJwk<Kms.X25519PublicJwk>
    senderKey.keyId = sender.keyId
    recipientKey = Kms.PublicJwk.fromPublicJwk(recipient.publicJwk) as Kms.PublicJwk<Kms.X25519PublicJwk>
    recipientKey.keyId = recipient.keyId
  })

  it('packs and unpacks a plaintext message', async () => {
    const plaintext: DidCommV2PlaintextMessage = {
      id: 'test-msg-1',
      type: 'https://didcomm.org/trust-ping/1.0/ping',
      from: 'did:example:alice',
      to: ['did:example:bob'],
      body: { response_requested: true },
    }

    const encrypted = await envelopeService.pack(agentContext, plaintext, {
      senderKey,
      recipientKey,
    })

    expect(encrypted).toMatchObject({
      protected: expect.any(String),
      iv: expect.any(String),
      ciphertext: expect.any(String),
      tag: expect.any(String),
    })

    const protectedJson = JsonEncoder.fromBase64(encrypted.protected) as { recipients?: Array<{ header?: { kid?: string } }> }
    const matchedKid = protectedJson.recipients?.[0]?.header?.kid ?? recipientKey.keyId
    const { plaintext: decrypted } = await envelopeService.unpack(agentContext, encrypted, {
      recipientKey,
      matchedKid,
      resolveSenderKey: async (skid) => (skid === senderKey.keyId ? senderKey : null),
    })

    expect(decrypted).toEqual(plaintext)
  })

  it('packs and unpacks anoncrypt message', async () => {
    const plaintext: DidCommV2PlaintextMessage = {
      id: 'test-msg-2',
      type: 'https://didcomm.org/routing/2.0/forward',
      to: ['did:example:mediator'],
      body: { next: 'did:example:bob' },
      attachments: [],
    }

    const encrypted = await envelopeService.packAnoncrypt(agentContext, plaintext, {
      recipientKey,
    })

    expect(encrypted).toMatchObject({
      protected: expect.any(String),
      iv: expect.any(String),
      ciphertext: expect.any(String),
      tag: expect.any(String),
    })

    const protectedJson = JsonEncoder.fromBase64(encrypted.protected) as {
      alg?: string
      recipients?: Array<{ header?: { kid?: string } }>
    }
    expect(protectedJson.alg).toBe('ECDH-ES+A256KW')
    expect(protectedJson.recipients).toHaveLength(1)
    const matchedKid = protectedJson.recipients?.[0]?.header?.kid ?? recipientKey.keyId
    const { plaintext: decrypted, senderKey } = await envelopeService.unpack(agentContext, encrypted, {
      recipientKey,
      matchedKid,
      resolveSenderKey: async () => null,
    })

    expect(decrypted).toEqual(plaintext)
    expect(senderKey).toBeNull()
  })
})
