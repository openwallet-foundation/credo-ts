import {
  DidDocument,
  type DidResolverService,
  InjectionSymbols,
  JsonEncoder,
  Kms,
  TypedArrayEncoder,
  VerificationMethod,
} from '@credo-ts/core'
import { askar } from '@openwallet-foundation/askar-nodejs'

import { AskarModuleConfig, AskarMultiWalletDatabaseScheme } from '../../../../askar/src/AskarModuleConfig'
import { AskarKeyManagementService } from '../../../../askar/src/kms/AskarKeyManagementService'
import { getAgentConfig, getAgentContext } from '../../../../core/tests/helpers'
import testLogger from '../../../../core/tests/logger'
import { NodeInMemoryKeyManagementStorage } from '../../../../node/src/kms/NodeInMemoryKeyManagementStorage'
import { NodeKeyManagementService } from '../../../../node/src/kms/NodeKeyManagementService'
import { NodeFileSystem } from '../../../../node/src/NodeFileSystem'

import { isDidCommV2EncryptedMessage } from '../../util/didcommVersion'
import { computeApu, computeApv } from '../apuApv'
import { DidCommV2EnvelopeService } from '../DidCommV2EnvelopeService'
import { DidCommV2KeyResolver } from '../resolveV2Keys'
import type {
  DidCommV2AnoncryptContentEncryptionAlgorithm,
  DidCommV2AuthcryptContentEncryptionAlgorithm,
  DidCommV2EncryptedMessage,
  DidCommV2PlaintextMessage,
} from '../types'

describe('DidCommV2EnvelopeService (Askar round-trip)', () => {
  const agentContext = getAgentContext({
    contextCorrelationId: 'v2-envelope-askar-roundtrip',
    agentConfig: getAgentConfig('V2EnvelopeAskarRoundTrip'),
    kmsBackends: [new AskarKeyManagementService()],
    registerInstances: [
      [InjectionSymbols.Logger, testLogger],
      [InjectionSymbols.FileSystem, new NodeFileSystem()],
      [
        AskarModuleConfig,
        new AskarModuleConfig({
          multiWalletDatabaseScheme: AskarMultiWalletDatabaseScheme.ProfilePerWallet,
          askar,
          store: {
            id: 'v2-envelope-askar-roundtrip',
            key: 'CwNJroKHTSSj3XvE7ZAnuKiTn2C4QkFvxEqfm5rzhNrb',
            keyDerivationMethod: 'raw',
            database: { type: 'sqlite', config: { inMemory: true } },
          },
        }),
      ],
    ],
  })

  let envelopeService: DidCommV2EnvelopeService
  let senderKey: Kms.PublicJwk<Kms.X25519PublicJwk>
  let recipientKey: Kms.PublicJwk<Kms.X25519PublicJwk>
  const senderKid = 'did:example:alice#key-x25519-1'
  const recipientKid = 'did:example:bob#key-x25519-1'

  beforeAll(async () => {
    agentContext.dependencyManager.registerSingleton(DidCommV2EnvelopeService)
    envelopeService = agentContext.dependencyManager.resolve(DidCommV2EnvelopeService)

    const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
    const sender = await kms.createKey({ type: { kty: 'OKP', crv: 'X25519' } })
    const recipient = await kms.createKey({ type: { kty: 'OKP', crv: 'X25519' } })

    senderKey = Kms.PublicJwk.fromPublicJwk(sender.publicJwk) as Kms.PublicJwk<Kms.X25519PublicJwk>
    senderKey.keyId = sender.keyId
    recipientKey = Kms.PublicJwk.fromPublicJwk(recipient.publicJwk) as Kms.PublicJwk<Kms.X25519PublicJwk>
    recipientKey.keyId = recipient.keyId
  })

  const plaintext: DidCommV2PlaintextMessage = {
    id: 'roundtrip-1',
    type: 'https://didcomm.org/trust-ping/1.0/ping',
    from: 'did:example:alice',
    to: ['did:example:bob'],
    body: { response_requested: true },
  }

  describe('authcrypt', () => {
    it.each<DidCommV2AuthcryptContentEncryptionAlgorithm>(['A256CBC-HS512'])(
      'round-trips with %s content encryption',
      async (enc) => {
        const encrypted = await envelopeService.pack(agentContext, plaintext, {
          senderKey,
          senderKeySkid: senderKid,
          recipients: [{ key: recipientKey, kid: recipientKid }],
          contentEncryptionAlgorithm: enc,
        })

        expect(encrypted.recipients).toHaveLength(1)
        expect(encrypted.recipients[0].header.kid).toBe(recipientKid)

        const protectedJson = JsonEncoder.fromBase64Url(encrypted.protected)
        expect(protectedJson).toMatchObject({
          typ: 'application/didcomm-encrypted+json',
          alg: 'ECDH-1PU+A256KW',
          enc,
          skid: senderKid,
          epk: { kty: 'OKP', crv: 'X25519', x: expect.any(String) },
        })
        expect(protectedJson.apu).toBe(TypedArrayEncoder.toBase64Url(computeApu(senderKid)))
        expect(protectedJson.apv).toBe(TypedArrayEncoder.toBase64Url(computeApv([recipientKid])))

        const { plaintext: decrypted, senderKey: resolvedSender } = await envelopeService.unpack(
          agentContext,
          encrypted,
          {
            recipientKey: recipientKey as Kms.PublicJwk<Kms.X25519PublicJwk> & { keyId: string },
            matchedKid: recipientKid,
            resolveSenderKey: async (skid) => (skid === senderKid ? senderKey : null),
          }
        )

        expect(decrypted).toEqual(plaintext)
        expect(resolvedSender).not.toBeNull()
      }
    )
  })

  describe('anoncrypt', () => {
    it.each<DidCommV2AnoncryptContentEncryptionAlgorithm>(['A256CBC-HS512', 'A256GCM', 'XC20P'])(
      'round-trips with %s content encryption',
      async (enc) => {
        const encrypted = await envelopeService.packAnoncrypt(agentContext, plaintext, {
          recipients: [{ key: recipientKey, kid: recipientKid }],
          contentEncryptionAlgorithm: enc,
        })

        expect(encrypted.recipients).toHaveLength(1)
        expect(encrypted.recipients[0].header.kid).toBe(recipientKid)

        const protectedJson = JsonEncoder.fromBase64Url(encrypted.protected)
        expect(protectedJson).toMatchObject({
          typ: 'application/didcomm-encrypted+json',
          alg: 'ECDH-ES+A256KW',
          enc,
          epk: { kty: 'OKP', crv: 'X25519', x: expect.any(String) },
        })
        expect(protectedJson.skid).toBeUndefined()
        expect(protectedJson.apu).toBeUndefined()
        expect(protectedJson.apv).toBe(TypedArrayEncoder.toBase64Url(computeApv([recipientKid])))

        const { plaintext: decrypted, senderKey: resolvedSender } = await envelopeService.unpack(
          agentContext,
          encrypted,
          {
            recipientKey: recipientKey as Kms.PublicJwk<Kms.X25519PublicJwk> & { keyId: string },
            matchedKid: recipientKid,
            resolveSenderKey: async () => null,
          }
        )

        expect(decrypted).toEqual(plaintext)
        expect(resolvedSender).toBeNull()
      }
    )
  })

  describe('encrypted typ', () => {
    // Mirrors packAnoncrypt with a caller-chosen typ, because the protected header is bound into the ciphertext.
    async function packAnoncryptWithTyp(typ: string | undefined): Promise<DidCommV2EncryptedMessage> {
      const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
      const ephemeralKey = await kms.createKey({ type: { kty: 'OKP', crv: 'X25519' } })
      const apv = computeApv([recipientKid])
      const protectedHeader = JsonEncoder.toBase64Url({
        typ,
        alg: 'ECDH-ES+A256KW',
        enc: 'A256CBC-HS512',
        apv: TypedArrayEncoder.toBase64Url(apv),
        epk: ephemeralKey.publicJwk,
      })
      const { encrypted, iv, tag, encryptedKey } = await kms.encrypt({
        key: {
          keyAgreement: {
            algorithm: 'ECDH-ES+A256KW',
            keyId: ephemeralKey.keyId,
            externalPublicJwk: recipientKey.toJson() as Kms.KmsJwkPublicEcdh,
            apv,
          },
        },
        encryption: { algorithm: 'A256CBC-HS512', aad: TypedArrayEncoder.fromUtf8String(protectedHeader) },
        data: JsonEncoder.toUint8Array(plaintext),
      })

      return {
        protected: protectedHeader,
        recipients: [
          {
            header: { kid: recipientKid },
            encrypted_key: TypedArrayEncoder.toBase64Url(encryptedKey?.encrypted as Uint8Array),
          },
        ],
        iv: TypedArrayEncoder.toBase64Url(iv as Uint8Array),
        ciphertext: TypedArrayEncoder.toBase64Url(encrypted),
        tag: TypedArrayEncoder.toBase64Url(tag as Uint8Array),
      }
    }

    it.each([undefined, 'didcomm-encrypted+json', 'application/didcomm+encrypted'])(
      'detects and unpacks an envelope with typ %s',
      async (typ) => {
        const encrypted = await packAnoncryptWithTyp(typ)

        expect(isDidCommV2EncryptedMessage(encrypted)).toBe(true)
        const { plaintext: decrypted } = await envelopeService.unpack(agentContext, encrypted, {
          recipientKey: recipientKey as Kms.PublicJwk<Kms.X25519PublicJwk> & { keyId: string },
          matchedKid: recipientKid,
          resolveSenderKey: async () => null,
        })
        expect(decrypted).toEqual(plaintext)
      }
    )
  })

  describe('P-256 keyAgreement', () => {
    let p256SenderKey: Kms.PublicJwk<Kms.P256PublicJwk>
    let p256RecipientKey: Kms.PublicJwk<Kms.P256PublicJwk>
    const p256SenderKid = 'did:example:alice#key-p256-1'
    const p256RecipientKid = 'did:example:bob#key-p256-1'

    beforeAll(async () => {
      const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
      const sender = await kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
      const recipient = await kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })

      p256SenderKey = Kms.PublicJwk.fromPublicJwk(sender.publicJwk) as Kms.PublicJwk<Kms.P256PublicJwk>
      p256SenderKey.keyId = sender.keyId
      p256RecipientKey = Kms.PublicJwk.fromPublicJwk(recipient.publicJwk) as Kms.PublicJwk<Kms.P256PublicJwk>
      p256RecipientKey.keyId = recipient.keyId
    })

    it.each<DidCommV2AuthcryptContentEncryptionAlgorithm>(['A256CBC-HS512'])(
      'authcrypt round-trips with %s content encryption',
      async (enc) => {
        const encrypted = await envelopeService.pack(agentContext, plaintext, {
          senderKey: p256SenderKey,
          senderKeySkid: p256SenderKid,
          recipients: [{ key: p256RecipientKey, kid: p256RecipientKid }],
          contentEncryptionAlgorithm: enc,
        })

        const protectedJson = JsonEncoder.fromBase64Url(encrypted.protected)
        expect(protectedJson).toMatchObject({
          alg: 'ECDH-1PU+A256KW',
          enc,
          skid: p256SenderKid,
          epk: { kty: 'EC', crv: 'P-256', x: expect.any(String), y: expect.any(String) },
        })
        expect(protectedJson.apu).toBe(TypedArrayEncoder.toBase64Url(computeApu(p256SenderKid)))
        expect(protectedJson.apv).toBe(TypedArrayEncoder.toBase64Url(computeApv([p256RecipientKid])))

        const { plaintext: decrypted, senderKey: resolvedSender } = await envelopeService.unpack(
          agentContext,
          encrypted,
          {
            recipientKey: p256RecipientKey as Kms.PublicJwk<Kms.P256PublicJwk> & { keyId: string },
            matchedKid: p256RecipientKid,
            resolveSenderKey: async (skid) => (skid === p256SenderKid ? p256SenderKey : null),
          }
        )

        expect(decrypted).toEqual(plaintext)
        expect(resolvedSender).not.toBeNull()
      }
    )

    it.each<DidCommV2AnoncryptContentEncryptionAlgorithm>(['A256CBC-HS512', 'A256GCM'])(
      'anoncrypt round-trips with %s content encryption',
      async (enc) => {
        const encrypted = await envelopeService.packAnoncrypt(agentContext, plaintext, {
          recipients: [{ key: p256RecipientKey, kid: p256RecipientKid }],
          contentEncryptionAlgorithm: enc,
        })

        const protectedJson = JsonEncoder.fromBase64Url(encrypted.protected)
        expect(protectedJson).toMatchObject({
          alg: 'ECDH-ES+A256KW',
          enc,
          epk: { kty: 'EC', crv: 'P-256', x: expect.any(String), y: expect.any(String) },
        })
        expect(protectedJson.skid).toBeUndefined()
        expect(protectedJson.apu).toBeUndefined()
        expect(protectedJson.apv).toBe(TypedArrayEncoder.toBase64Url(computeApv([p256RecipientKid])))

        const { plaintext: decrypted, senderKey: resolvedSender } = await envelopeService.unpack(
          agentContext,
          encrypted,
          {
            recipientKey: p256RecipientKey as Kms.PublicJwk<Kms.P256PublicJwk> & { keyId: string },
            matchedKid: p256RecipientKid,
            resolveSenderKey: async () => null,
          }
        )

        expect(decrypted).toEqual(plaintext)
        expect(resolvedSender).toBeNull()
      }
    )
  })

  describe('P-384 keyAgreement', () => {
    let p384SenderKey: Kms.PublicJwk<Kms.P384PublicJwk>
    let p384RecipientKey: Kms.PublicJwk<Kms.P384PublicJwk>
    const p384SenderKid = 'did:example:alice#key-p384-1'
    const p384RecipientKid = 'did:example:bob#key-p384-1'

    beforeAll(async () => {
      const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
      const sender = await kms.createKey({ type: { kty: 'EC', crv: 'P-384' } })
      const recipient = await kms.createKey({ type: { kty: 'EC', crv: 'P-384' } })

      p384SenderKey = Kms.PublicJwk.fromPublicJwk(sender.publicJwk) as Kms.PublicJwk<Kms.P384PublicJwk>
      p384SenderKey.keyId = sender.keyId
      p384RecipientKey = Kms.PublicJwk.fromPublicJwk(recipient.publicJwk) as Kms.PublicJwk<Kms.P384PublicJwk>
      p384RecipientKey.keyId = recipient.keyId
    })

    it.each<DidCommV2AuthcryptContentEncryptionAlgorithm>(['A256CBC-HS512'])(
      'authcrypt round-trips with %s content encryption',
      async (enc) => {
        const encrypted = await envelopeService.pack(agentContext, plaintext, {
          senderKey: p384SenderKey,
          senderKeySkid: p384SenderKid,
          recipients: [{ key: p384RecipientKey, kid: p384RecipientKid }],
          contentEncryptionAlgorithm: enc,
        })

        const protectedJson = JsonEncoder.fromBase64Url(encrypted.protected)
        expect(protectedJson).toMatchObject({
          alg: 'ECDH-1PU+A256KW',
          enc,
          skid: p384SenderKid,
          epk: { kty: 'EC', crv: 'P-384', x: expect.any(String), y: expect.any(String) },
        })

        const { plaintext: decrypted, senderKey: resolvedSender } = await envelopeService.unpack(
          agentContext,
          encrypted,
          {
            recipientKey: p384RecipientKey as Kms.PublicJwk<Kms.P384PublicJwk> & { keyId: string },
            matchedKid: p384RecipientKid,
            resolveSenderKey: async (skid) => (skid === p384SenderKid ? p384SenderKey : null),
          }
        )

        expect(decrypted).toEqual(plaintext)
        expect(resolvedSender).not.toBeNull()
      }
    )

    it.each<DidCommV2AnoncryptContentEncryptionAlgorithm>(['A256CBC-HS512', 'A256GCM'])(
      'anoncrypt round-trips with %s content encryption',
      async (enc) => {
        const encrypted = await envelopeService.packAnoncrypt(agentContext, plaintext, {
          recipients: [{ key: p384RecipientKey, kid: p384RecipientKid }],
          contentEncryptionAlgorithm: enc,
        })

        const protectedJson = JsonEncoder.fromBase64Url(encrypted.protected)
        expect(protectedJson).toMatchObject({
          alg: 'ECDH-ES+A256KW',
          enc,
          epk: { kty: 'EC', crv: 'P-384', x: expect.any(String), y: expect.any(String) },
        })

        const { plaintext: decrypted, senderKey: resolvedSender } = await envelopeService.unpack(
          agentContext,
          encrypted,
          {
            recipientKey: p384RecipientKey as Kms.PublicJwk<Kms.P384PublicJwk> & { keyId: string },
            matchedKid: p384RecipientKid,
            resolveSenderKey: async () => null,
          }
        )

        expect(decrypted).toEqual(plaintext)
        expect(resolvedSender).toBeNull()
      }
    )
  })

  describe('off-curve NIST points', () => {
    // There is no on-curve check of our own. These pin down that the KMS rejects the point on import,
    // which fails with a different cause than a tag mismatch.
    async function expectInvalidKeyData(unpack: Promise<unknown>): Promise<void> {
      const error = await unpack.then(
        () => undefined,
        (e: Error) => e
      )
      expect(error?.cause).toEqual(expect.objectContaining({ message: 'Invalid key data' }))
    }

    function offCurve<T extends { y: string }>(jwk: T): T {
      const y = TypedArrayEncoder.fromBase64Url(jwk.y)
      y[y.length - 1] ^= 1
      return { ...jwk, y: TypedArrayEncoder.toBase64Url(y) }
    }

    function withOffCurveEpk(encrypted: DidCommV2EncryptedMessage): DidCommV2EncryptedMessage {
      const protectedJson = JsonEncoder.fromBase64Url(encrypted.protected)
      return {
        ...encrypted,
        protected: JsonEncoder.toBase64Url({ ...protectedJson, epk: offCurve(protectedJson.epk) }),
      }
    }

    async function createKeyPair(crv: 'P-256' | 'P-384'): Promise<{
      sender: Kms.PublicJwk<Kms.P256PublicJwk | Kms.P384PublicJwk>
      recipient: Kms.PublicJwk<Kms.P256PublicJwk | Kms.P384PublicJwk> & { keyId: string }
    }> {
      const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
      const [sender, recipient] = await Promise.all([
        kms.createKey({ type: { kty: 'EC', crv } }),
        kms.createKey({ type: { kty: 'EC', crv } }),
      ])
      const senderJwk = Kms.PublicJwk.fromPublicJwk(sender.publicJwk) as Kms.PublicJwk<
        Kms.P256PublicJwk | Kms.P384PublicJwk
      >
      senderJwk.keyId = sender.keyId
      const recipientJwk = Kms.PublicJwk.fromPublicJwk(recipient.publicJwk) as Kms.PublicJwk<
        Kms.P256PublicJwk | Kms.P384PublicJwk
      >
      recipientJwk.keyId = recipient.keyId
      return { sender: senderJwk, recipient: recipientJwk }
    }

    it.each(['P-256', 'P-384'] as const)('rejects an anoncrypt envelope whose %s epk is off the curve', async (crv) => {
      const { recipient } = await createKeyPair(crv)
      const encrypted = await envelopeService.packAnoncrypt(agentContext, plaintext, {
        recipients: [{ key: recipient, kid: recipientKid }],
      })

      await expectInvalidKeyData(
        envelopeService.unpack(agentContext, withOffCurveEpk(encrypted), {
          recipientKey: recipient,
          matchedKid: recipientKid,
          resolveSenderKey: async () => null,
        })
      )
    })

    it.each(['P-256', 'P-384'] as const)('rejects an authcrypt envelope whose %s epk is off the curve', async (crv) => {
      const { sender, recipient } = await createKeyPair(crv)
      const encrypted = await envelopeService.pack(agentContext, plaintext, {
        senderKey: sender,
        senderKeySkid: senderKid,
        recipients: [{ key: recipient, kid: recipientKid }],
      })

      await expectInvalidKeyData(
        envelopeService.unpack(agentContext, withOffCurveEpk(encrypted), {
          recipientKey: recipient,
          matchedKid: recipientKid,
          resolveSenderKey: async () => sender,
        })
      )
    })

    it.each(['P-256', 'P-384'] as const)(
      'rejects an authcrypt envelope whose resolved %s sender key is off the curve',
      async (crv) => {
        const { sender, recipient } = await createKeyPair(crv)
        const encrypted = await envelopeService.pack(agentContext, plaintext, {
          senderKey: sender,
          senderKeySkid: senderKid,
          recipients: [{ key: recipient, kid: recipientKid }],
        })
        const offCurveSender = Kms.PublicJwk.fromUnknown(offCurve(sender.toJson() as { y: string }))

        await expectInvalidKeyData(
          envelopeService.unpack(agentContext, encrypted, {
            recipientKey: recipient,
            matchedKid: recipientKid,
            resolveSenderKey: async () => offCurveSender,
          })
        )
      }
    )
  })

  describe('key resolver', () => {
    it('does not resolve a recipient kid that is a local KMS key id', async () => {
      const resolver = new DidCommV2KeyResolver({} as DidResolverService)
      const encrypted = await envelopeService.packAnoncrypt(agentContext, plaintext, {
        recipients: [{ key: recipientKey, kid: recipientKey.keyId }],
      })

      expect(await resolver.resolveRecipientKey(agentContext, encrypted)).toBeNull()
    })

    it('names the sender key by its verification method when the published jwk carries a kid', async () => {
      const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
      const created = await kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
      const skid = 'did:example:alice#key-p256-1'
      const didDocument = new DidDocument({
        id: 'did:example:alice',
        keyAgreement: [
          new VerificationMethod({
            id: skid,
            type: 'JsonWebKey2020',
            controller: 'did:example:alice',
            publicKeyJwk: { ...created.publicJwk, kid: created.keyId },
          }),
        ],
      })
      const resolver = new DidCommV2KeyResolver({
        resolveDidDocument: async () => didDocument,
      } as unknown as DidResolverService)

      const senderKey = await resolver.resolveSenderKey(agentContext, skid)

      expect(senderKey?.keyId).toBe(skid)
    })
  })
})

describe('DidCommV2EnvelopeService with the sender key outside the default backend', () => {
  const agentContext = getAgentContext({
    contextCorrelationId: 'v2-envelope-cross-backend',
    agentConfig: getAgentConfig('V2EnvelopeCrossBackend'),
    kmsBackends: [
      new NodeKeyManagementService(new NodeInMemoryKeyManagementStorage()),
      new AskarKeyManagementService(),
    ],
    registerInstances: [
      [InjectionSymbols.Logger, testLogger],
      [InjectionSymbols.FileSystem, new NodeFileSystem()],
      [
        AskarModuleConfig,
        new AskarModuleConfig({
          multiWalletDatabaseScheme: AskarMultiWalletDatabaseScheme.ProfilePerWallet,
          askar,
          store: {
            id: 'v2-envelope-cross-backend',
            key: 'CwNJroKHTSSj3XvE7ZAnuKiTn2C4QkFvxEqfm5rzhNrb',
            keyDerivationMethod: 'raw',
            database: { type: 'sqlite', config: { inMemory: true } },
          },
        }),
      ],
    ],
  })

  it('creates the authcrypt ephemeral key in the backend of the sender key', async () => {
    agentContext.dependencyManager.registerSingleton(DidCommV2EnvelopeService)
    const envelopeService = agentContext.dependencyManager.resolve(DidCommV2EnvelopeService)
    const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)

    const sender = await kms.createKey({ backend: 'askar', type: { kty: 'OKP', crv: 'X25519' } })
    const recipient = await kms.createKey({ backend: 'askar', type: { kty: 'OKP', crv: 'X25519' } })
    const senderKey = Kms.PublicJwk.fromPublicJwk(sender.publicJwk) as Kms.PublicJwk<Kms.X25519PublicJwk>
    senderKey.keyId = sender.keyId
    const recipientKey = Kms.PublicJwk.fromPublicJwk(recipient.publicJwk) as Kms.PublicJwk<Kms.X25519PublicJwk>
    recipientKey.keyId = recipient.keyId
    const deleteKey = vi.spyOn(kms, 'deleteKey')
    const plaintext: DidCommV2PlaintextMessage = {
      id: 'cross-backend-1',
      type: 'https://didcomm.org/trust-ping/2.0/ping',
      from: 'did:example:alice',
      to: ['did:example:bob'],
      body: {},
    }

    const encrypted = await envelopeService.pack(agentContext, plaintext, {
      senderKey,
      senderKeySkid: 'did:example:alice#key-1',
      recipients: [{ key: recipientKey, kid: 'did:example:bob#key-1' }],
    })

    expect(deleteKey).toHaveBeenCalledWith(expect.objectContaining({ backend: 'askar' }))
    await expect(deleteKey.mock.results[0].value).resolves.toBe(true)

    const { plaintext: decrypted } = await envelopeService.unpack(agentContext, encrypted, {
      recipientKey: recipientKey as Kms.PublicJwk<Kms.X25519PublicJwk> & { keyId: string },
      matchedKid: 'did:example:bob#key-1',
      resolveSenderKey: async () => senderKey,
    })
    expect(decrypted).toEqual(plaintext)
  })
})
