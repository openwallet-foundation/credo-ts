import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { InjectionSymbols, JsonEncoder, Kms } from '@credo-ts/core'
import { askar } from '@openwallet-foundation/askar-nodejs'

import { AskarModuleConfig, AskarMultiWalletDatabaseScheme } from '../../../../askar/src/AskarModuleConfig'
import { AskarKeyManagementService } from '../../../../askar/src/kms/AskarKeyManagementService'
import { getAgentConfig, getAgentContext } from '../../../../core/tests/helpers'
import testLogger from '../../../../core/tests/logger'
import { NodeFileSystem } from '../../../../node/src/NodeFileSystem'

import { DidCommV2EnvelopeService } from '../DidCommV2EnvelopeService'
import type { DidCommV2PlaintextMessage, DidCommV2SignedMessage } from '../types'
import { DIDCOMM_V2_SIGNED_MIME_TYPE } from '../types'

describe('DidCommV2EnvelopeService (signed messages)', () => {
  const agentContext = getAgentContext({
    contextCorrelationId: 'v2-envelope-signed',
    agentConfig: getAgentConfig('V2EnvelopeSigned'),
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
            id: 'v2-envelope-signed',
            key: 'CwNJroKHTSSj3XvE7ZAnuKiTn2C4QkFvxEqfm5rzhNrb',
            keyDerivationMethod: 'raw',
            database: { type: 'sqlite', config: { inMemory: true } },
          },
        }),
      ],
    ],
  })

  let envelopeService: DidCommV2EnvelopeService
  let signerJwk: Kms.PublicJwk<Kms.Ed25519PublicJwk>
  const signerDid = 'did:example:alice'
  const signerKid = `${signerDid}#key-1`

  const plaintext: DidCommV2PlaintextMessage = {
    id: 'signed-test-1',
    type: 'https://example.com/protocols/test/1.0/ping',
    from: signerDid,
    to: ['did:example:bob'],
    body: { ping: true },
  }

  beforeAll(async () => {
    agentContext.dependencyManager.registerSingleton(DidCommV2EnvelopeService)
    envelopeService = agentContext.dependencyManager.resolve(DidCommV2EnvelopeService)

    const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
    const ed = await kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
    signerJwk = Kms.PublicJwk.fromPublicJwk(ed.publicJwk) as Kms.PublicJwk<Kms.Ed25519PublicJwk>
    signerJwk.keyId = ed.keyId
  })

  describe('signPlaintext', () => {
    it('produces a single-signer JWS with kid in the unprotected header (SICPA interop)', async () => {
      const signed = await envelopeService.signPlaintext(agentContext, plaintext, {
        keyId: signerJwk.keyId,
        kid: signerKid,
        alg: 'EdDSA',
      })

      expect(signed.signatures).toHaveLength(1)
      expect(signed.signatures[0].header).toEqual({ kid: signerKid })
      expect(JsonEncoder.fromBase64Url(signed.signatures[0].protected)).toEqual({
        typ: DIDCOMM_V2_SIGNED_MIME_TYPE,
        alg: 'EdDSA',
      })
      expect(JsonEncoder.fromBase64Url(signed.payload)).toEqual(plaintext)
    })

    it('rejects an algorithm outside the DIDComm v2.1 set', async () => {
      await expect(
        envelopeService.signPlaintext(agentContext, plaintext, {
          keyId: signerJwk.keyId,
          kid: signerKid,
          // biome-ignore lint/suspicious/noExplicitAny: deliberately passing an out-of-set alg
          alg: 'RS256' as any,
        })
      ).rejects.toThrow(/Unsupported DIDComm v2 signing algorithm/)
    })

    it('rejects when plaintext.from is set but does not match the signer DID', async () => {
      await expect(
        envelopeService.signPlaintext(
          agentContext,
          { ...plaintext, from: 'did:example:eve' },
          { keyId: signerJwk.keyId, kid: signerKid, alg: 'EdDSA' }
        )
      ).rejects.toThrow(/does not match signer DID/)
    })
  })

  describe('verifySignedMessage', () => {
    let signedMessage: DidCommV2SignedMessage

    beforeAll(async () => {
      signedMessage = await envelopeService.signPlaintext(agentContext, plaintext, {
        keyId: signerJwk.keyId,
        kid: signerKid,
        alg: 'EdDSA',
      })
    })

    it('verifies a signed message and returns the inner plaintext + signer metadata', async () => {
      const { plaintext: verifiedPlaintext, signers } = await envelopeService.verifySignedMessage(
        agentContext,
        signedMessage,
        { resolveSignerJwk: async (kid) => (kid === signerKid ? signerJwk : null) }
      )

      expect(verifiedPlaintext).toEqual(plaintext)
      expect(signers).toHaveLength(1)
      expect(signers[0].kid).toBe(signerKid)
      expect(signers[0].alg).toBe('EdDSA')
      expect(signers[0].jwk.fingerprint).toBe(signerJwk.fingerprint)
    })

    it('verifies SICPA-style envelopes with kid in the unprotected header', async () => {
      const fixture = JSON.parse(readFileSync(join(__dirname, '__fixtures__/sicpa/signed-eddsa.json'), 'utf-8')) as {
        signedMessage: DidCommV2SignedMessage
        signer: { kid: string; publicJwk: Kms.KmsJwkPublicAsymmetric }
      }
      const sicpaSignerJwk = Kms.PublicJwk.fromPublicJwk(fixture.signer.publicJwk)

      const { signers } = await envelopeService.verifySignedMessage(agentContext, fixture.signedMessage, {
        resolveSignerJwk: async (kid) => (kid === fixture.signer.kid ? sicpaSignerJwk : null),
      })

      expect(signers).toHaveLength(1)
      expect(signers[0].kid).toBe(fixture.signer.kid)
      expect(signers[0].alg).toBe('EdDSA')
    })

    it('rejects multi-signer envelopes', async () => {
      const multiSig: DidCommV2SignedMessage = {
        payload: signedMessage.payload,
        signatures: [signedMessage.signatures[0], signedMessage.signatures[0]],
      }
      await expect(
        envelopeService.verifySignedMessage(agentContext, multiSig, {
          resolveSignerJwk: async () => signerJwk,
        })
      ).rejects.toThrow(/exactly one signature/)
    })

    it('rejects when the protected header typ is wrong', async () => {
      const badTyp = JsonEncoder.toBase64Url({ typ: 'application/didcomm-plain+json', alg: 'EdDSA' })
      const bad: DidCommV2SignedMessage = {
        payload: signedMessage.payload,
        signatures: [{ ...signedMessage.signatures[0], protected: badTyp }],
      }
      await expect(
        envelopeService.verifySignedMessage(agentContext, bad, {
          resolveSignerJwk: async () => signerJwk,
        })
      ).rejects.toThrow(/Invalid DIDComm v2 signed message typ/)
    })

    it('rejects when the protected alg is outside the DIDComm v2.1 set', async () => {
      const badAlg = JsonEncoder.toBase64Url({ typ: DIDCOMM_V2_SIGNED_MIME_TYPE, alg: 'RS256' })
      const bad: DidCommV2SignedMessage = {
        payload: signedMessage.payload,
        signatures: [{ ...signedMessage.signatures[0], protected: badAlg }],
      }
      await expect(
        envelopeService.verifySignedMessage(agentContext, bad, {
          resolveSignerJwk: async () => signerJwk,
        })
      ).rejects.toThrow(/Unsupported DIDComm v2 signing algorithm/)
    })

    it('rejects when the resolver returns null', async () => {
      await expect(
        envelopeService.verifySignedMessage(agentContext, signedMessage, {
          resolveSignerJwk: async () => null,
        })
      ).rejects.toThrow(/Could not resolve DIDComm v2 signer JWK/)
    })

    it('rejects when the inner plaintext from does not match the signer DID', async () => {
      const mismatched = await envelopeService.signPlaintext(
        agentContext,
        { ...plaintext, from: undefined },
        { keyId: signerJwk.keyId, kid: signerKid, alg: 'EdDSA' }
      )
      const tamperedPayload = JsonEncoder.toBase64Url({ ...plaintext, from: 'did:example:eve' })
      const tampered: DidCommV2SignedMessage = {
        payload: tamperedPayload,
        signatures: mismatched.signatures,
      }
      // The signature won't verify because the payload changed, so we get the verify failure first.
      await expect(
        envelopeService.verifySignedMessage(agentContext, tampered, {
          resolveSignerJwk: async () => signerJwk,
        })
      ).rejects.toThrow()
    })
  })

  describe('sign-then-encrypt round-trip', () => {
    let recipientKey: Kms.PublicJwk<Kms.X25519PublicJwk>
    let senderEcdhKey: Kms.PublicJwk<Kms.X25519PublicJwk>

    beforeAll(async () => {
      const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
      const recipient = await kms.createKey({ type: { kty: 'OKP', crv: 'X25519' } })
      const senderEcdh = await kms.createKey({ type: { kty: 'OKP', crv: 'X25519' } })
      recipientKey = Kms.PublicJwk.fromPublicJwk(recipient.publicJwk) as Kms.PublicJwk<Kms.X25519PublicJwk>
      recipientKey.keyId = recipient.keyId
      senderEcdhKey = Kms.PublicJwk.fromPublicJwk(senderEcdh.publicJwk) as Kms.PublicJwk<Kms.X25519PublicJwk>
      senderEcdhKey.keyId = senderEcdh.keyId
    })

    it('signs then authcrypts; unpacks back to the JWS which verifies to the original plaintext', async () => {
      const envelope = await envelopeService.packSignedAndEncrypted(
        agentContext,
        plaintext,
        { keyId: signerJwk.keyId, kid: signerKid, alg: 'EdDSA' },
        { senderKey: senderEcdhKey, recipientKey }
      )

      const matchedKid = envelope.recipients[0]?.header?.kid ?? recipientKey.keyId
      const { plaintext: inner } = await envelopeService.unpack(agentContext, envelope, {
        recipientKey: recipientKey as Kms.PublicJwk<Kms.X25519PublicJwk> & { keyId: string },
        matchedKid,
        resolveSenderKey: async (skid) => (skid === senderEcdhKey.keyId ? senderEcdhKey : null),
      })

      // The inner bytes are a JWS, not a JWM plaintext. Verify and recover the original.
      const innerSigned = inner as unknown as DidCommV2SignedMessage
      expect(innerSigned.payload).toBeDefined()
      expect(innerSigned.signatures).toHaveLength(1)

      const { plaintext: verified } = await envelopeService.verifySignedMessage(agentContext, innerSigned, {
        resolveSignerJwk: async (kid) => (kid === signerKid ? signerJwk : null),
      })
      expect(verified).toEqual(plaintext)
    })

    it('signs then anoncrypts; unpacks back to the JWS which verifies to the original plaintext', async () => {
      const envelope = await envelopeService.packSignedAndAnoncrypted(
        agentContext,
        plaintext,
        { keyId: signerJwk.keyId, kid: signerKid, alg: 'EdDSA' },
        { recipientKey }
      )

      const matchedKid = envelope.recipients[0]?.header?.kid ?? recipientKey.keyId
      const { plaintext: inner } = await envelopeService.unpack(agentContext, envelope, {
        recipientKey: recipientKey as Kms.PublicJwk<Kms.X25519PublicJwk> & { keyId: string },
        matchedKid,
        resolveSenderKey: async () => null,
      })

      const innerSigned = inner as unknown as DidCommV2SignedMessage
      const { plaintext: verified } = await envelopeService.verifySignedMessage(agentContext, innerSigned, {
        resolveSignerJwk: async (kid) => (kid === signerKid ? signerJwk : null),
      })
      expect(verified).toEqual(plaintext)
    })
  })

  describe('round-trip on Askar (all DIDComm v2.1 algorithms)', () => {
    const cases: Array<{ alg: 'EdDSA' | 'ES256' | 'ES256K'; keyType: Kms.KmsCreateKeyType }> = [
      { alg: 'EdDSA', keyType: { kty: 'OKP', crv: 'Ed25519' } },
      { alg: 'ES256', keyType: { kty: 'EC', crv: 'P-256' } },
      { alg: 'ES256K', keyType: { kty: 'EC', crv: 'secp256k1' } },
    ]

    it.each(cases)('signs and verifies with $alg', async ({ alg, keyType }) => {
      const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
      const created = await kms.createKey({ type: keyType })
      const jwk = Kms.PublicJwk.fromPublicJwk(created.publicJwk as Kms.KmsJwkPublicAsymmetric)
      jwk.keyId = created.keyId
      const kid = `did:example:alice#${alg.toLowerCase()}-key`
      const localPlaintext: DidCommV2PlaintextMessage = {
        id: `roundtrip-${alg}`,
        type: 'https://example.com/protocols/test/1.0/ping',
        from: 'did:example:alice',
        to: ['did:example:bob'],
        body: { alg },
      }

      const signed = await envelopeService.signPlaintext(agentContext, localPlaintext, {
        keyId: jwk.keyId,
        kid,
        alg,
      })

      const { plaintext: verified, signers } = await envelopeService.verifySignedMessage(agentContext, signed, {
        resolveSignerJwk: async (resolved) => (resolved === kid ? jwk : null),
      })

      expect(verified).toEqual(localPlaintext)
      expect(signers).toHaveLength(1)
      expect(signers[0].alg).toBe(alg)
      expect(signers[0].jwk.fingerprint).toBe(jwk.fingerprint)
    })
  })
})
