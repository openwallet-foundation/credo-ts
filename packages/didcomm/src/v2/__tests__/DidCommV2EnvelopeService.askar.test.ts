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
import { NodeFileSystem } from '../../../../node/src/NodeFileSystem'

import { computeApu, computeApv } from '../apuApv'
import { DidCommV2EnvelopeService } from '../DidCommV2EnvelopeService'
import { DidCommV2KeyResolver } from '../resolveV2Keys'
import type {
  DidCommV2AnoncryptContentEncryptionAlgorithm,
  DidCommV2AuthcryptContentEncryptionAlgorithm,
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
          recipientKey,
          recipientKid,
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
          recipientKey,
          recipientKid,
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
          recipientKey: p256RecipientKey,
          recipientKid: p256RecipientKid,
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
          recipientKey: p256RecipientKey,
          recipientKid: p256RecipientKid,
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
          recipientKey: p384RecipientKey,
          recipientKid: p384RecipientKid,
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
          recipientKey: p384RecipientKey,
          recipientKid: p384RecipientKid,
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

  describe('key resolver', () => {
    it('does not resolve a recipient kid that is a local KMS key id', async () => {
      const resolver = new DidCommV2KeyResolver({} as DidResolverService)
      const encrypted = await envelopeService.packAnoncrypt(agentContext, plaintext, {
        recipientKey,
        recipientKid: recipientKey.keyId,
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
