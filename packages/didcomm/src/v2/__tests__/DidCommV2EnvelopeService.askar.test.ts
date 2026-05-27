import { InjectionSymbols, JsonEncoder, Kms, TypedArrayEncoder } from '@credo-ts/core'
import { askar } from '@openwallet-foundation/askar-nodejs'

import { AskarModuleConfig, AskarMultiWalletDatabaseScheme } from '../../../../askar/src/AskarModuleConfig'
import { AskarKeyManagementService } from '../../../../askar/src/kms/AskarKeyManagementService'
import { getAgentConfig, getAgentContext } from '../../../../core/tests/helpers'
import testLogger from '../../../../core/tests/logger'
import { NodeFileSystem } from '../../../../node/src/NodeFileSystem'

import { computeApu, computeApv } from '../apuApv'
import { DidCommV2EnvelopeService } from '../DidCommV2EnvelopeService'
import type { DidCommV2ContentEncryptionAlgorithm, DidCommV2PlaintextMessage } from '../types'

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
    it.each<DidCommV2ContentEncryptionAlgorithm>([
      'A256CBC-HS512',
      'A256GCM',
    ])('round-trips with %s content encryption', async (enc) => {
      const encrypted = await envelopeService.pack(agentContext, plaintext, {
        senderKey,
        recipientKey,
        contentEncryptionAlgorithm: enc,
      })

      expect(encrypted.recipients).toHaveLength(1)
      expect(encrypted.recipients[0].header.kid).toBe(recipientKey.keyId)

      const protectedJson = JsonEncoder.fromBase64Url(encrypted.protected)
      expect(protectedJson).toMatchObject({
        typ: 'application/didcomm-encrypted+json',
        alg: 'ECDH-1PU+A256KW',
        enc,
        skid: senderKey.keyId,
        epk: { kty: 'OKP', crv: 'X25519', x: expect.any(String) },
      })
      expect(protectedJson.apu).toBe(TypedArrayEncoder.toBase64Url(computeApu(senderKey.keyId)))
      expect(protectedJson.apv).toBe(TypedArrayEncoder.toBase64Url(computeApv([recipientKey.keyId])))

      const { plaintext: decrypted, senderKey: resolvedSender } = await envelopeService.unpack(
        agentContext,
        encrypted,
        {
          recipientKey: recipientKey as Kms.PublicJwk<Kms.X25519PublicJwk> & { keyId: string },
          matchedKid: recipientKey.keyId,
          resolveSenderKey: async (skid) => (skid === senderKey.keyId ? senderKey : null),
        }
      )

      expect(decrypted).toEqual(plaintext)
      expect(resolvedSender).not.toBeNull()
    })
  })

  describe('anoncrypt', () => {
    it.each<DidCommV2ContentEncryptionAlgorithm>([
      'A256CBC-HS512',
      'A256GCM',
    ])('round-trips with %s content encryption', async (enc) => {
      const encrypted = await envelopeService.packAnoncrypt(agentContext, plaintext, {
        recipientKey,
        contentEncryptionAlgorithm: enc,
      })

      expect(encrypted.recipients).toHaveLength(1)
      expect(encrypted.recipients[0].header.kid).toBe(recipientKey.keyId)

      const protectedJson = JsonEncoder.fromBase64Url(encrypted.protected)
      expect(protectedJson).toMatchObject({
        typ: 'application/didcomm-encrypted+json',
        alg: 'ECDH-ES+A256KW',
        enc,
        epk: { kty: 'OKP', crv: 'X25519', x: expect.any(String) },
      })
      expect(protectedJson.skid).toBeUndefined()
      expect(protectedJson.apu).toBeUndefined()
      expect(protectedJson.apv).toBe(TypedArrayEncoder.toBase64Url(computeApv([recipientKey.keyId])))

      const { plaintext: decrypted, senderKey: resolvedSender } = await envelopeService.unpack(
        agentContext,
        encrypted,
        {
          recipientKey: recipientKey as Kms.PublicJwk<Kms.X25519PublicJwk> & { keyId: string },
          matchedKid: recipientKey.keyId,
          resolveSenderKey: async () => null,
        }
      )

      expect(decrypted).toEqual(plaintext)
      expect(resolvedSender).toBeNull()
    })
  })

  describe('P-256 keyAgreement', () => {
    let p256SenderKey: Kms.PublicJwk<Kms.P256PublicJwk>
    let p256RecipientKey: Kms.PublicJwk<Kms.P256PublicJwk>

    beforeAll(async () => {
      const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
      const sender = await kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
      const recipient = await kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })

      p256SenderKey = Kms.PublicJwk.fromPublicJwk(sender.publicJwk) as Kms.PublicJwk<Kms.P256PublicJwk>
      p256SenderKey.keyId = sender.keyId
      p256RecipientKey = Kms.PublicJwk.fromPublicJwk(recipient.publicJwk) as Kms.PublicJwk<Kms.P256PublicJwk>
      p256RecipientKey.keyId = recipient.keyId
    })

    it.each<DidCommV2ContentEncryptionAlgorithm>([
      'A256CBC-HS512',
      'A256GCM',
    ])('authcrypt round-trips with %s content encryption', async (enc) => {
      const encrypted = await envelopeService.pack(agentContext, plaintext, {
        senderKey: p256SenderKey,
        recipientKey: p256RecipientKey,
        contentEncryptionAlgorithm: enc,
      })

      const protectedJson = JsonEncoder.fromBase64Url(encrypted.protected)
      expect(protectedJson).toMatchObject({
        alg: 'ECDH-1PU+A256KW',
        enc,
        skid: p256SenderKey.keyId,
        epk: { kty: 'EC', crv: 'P-256', x: expect.any(String), y: expect.any(String) },
      })
      expect(protectedJson.apu).toBe(TypedArrayEncoder.toBase64Url(computeApu(p256SenderKey.keyId)))
      expect(protectedJson.apv).toBe(TypedArrayEncoder.toBase64Url(computeApv([p256RecipientKey.keyId])))

      const { plaintext: decrypted, senderKey: resolvedSender } = await envelopeService.unpack(
        agentContext,
        encrypted,
        {
          recipientKey: p256RecipientKey as Kms.PublicJwk<Kms.P256PublicJwk> & { keyId: string },
          matchedKid: p256RecipientKey.keyId,
          resolveSenderKey: async (skid) => (skid === p256SenderKey.keyId ? p256SenderKey : null),
        }
      )

      expect(decrypted).toEqual(plaintext)
      expect(resolvedSender).not.toBeNull()
    })

    it.each<DidCommV2ContentEncryptionAlgorithm>([
      'A256CBC-HS512',
      'A256GCM',
    ])('anoncrypt round-trips with %s content encryption', async (enc) => {
      const encrypted = await envelopeService.packAnoncrypt(agentContext, plaintext, {
        recipientKey: p256RecipientKey,
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
      expect(protectedJson.apv).toBe(TypedArrayEncoder.toBase64Url(computeApv([p256RecipientKey.keyId])))

      const { plaintext: decrypted, senderKey: resolvedSender } = await envelopeService.unpack(
        agentContext,
        encrypted,
        {
          recipientKey: p256RecipientKey as Kms.PublicJwk<Kms.P256PublicJwk> & { keyId: string },
          matchedKid: p256RecipientKey.keyId,
          resolveSenderKey: async () => null,
        }
      )

      expect(decrypted).toEqual(plaintext)
      expect(resolvedSender).toBeNull()
    })
  })
})
