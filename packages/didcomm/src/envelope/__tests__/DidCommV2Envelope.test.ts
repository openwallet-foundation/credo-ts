import { DidsApi, InjectionSymbols, JsonEncoder, Kms } from '@credo-ts/core'
import { getAgentConfig, getAgentContext } from '../../../../core/tests/helpers'
import testLogger from '../../../../core/tests/logger'
import { DidCommModuleConfig } from '../../DidCommModuleConfig'
import type { DidCommV2EnvelopeService } from '../../v2/DidCommV2EnvelopeService'
import type { DidCommV2KeyResolver } from '../../v2/resolveV2Keys'
import type { DidCommV2EncryptedMessage, DidCommV2PlaintextMessage, DidCommV2SignedMessage } from '../../v2/types'
import { DidCommV2Envelope } from '../DidCommV2Envelope'

describe('DidCommV2Envelope unpack addressing validation', () => {
  const authcryptSenderDid = 'did:example:alice'
  const authcryptSenderSkid = `${authcryptSenderDid}#key-agreement-1`
  const recipientDid = 'did:example:bob'
  const recipientKid = `${recipientDid}#key-agreement-1`
  const recipientKey = {
    keyId: 'recipient-kms-key',
    fingerprint: 'recipient-fingerprint',
  } as unknown as Kms.PublicJwk<Kms.X25519PublicJwk> & { keyId: string }
  const senderKey = {
    keyId: 'sender-kms-key',
    fingerprint: 'sender-fingerprint',
  } as unknown as Kms.PublicJwk<Kms.X25519PublicJwk>

  const createTestEncryptedMessage = (alg: 'ECDH-1PU+A256KW' | 'ECDH-ES+A256KW' = 'ECDH-1PU+A256KW') =>
    ({
      protected: JsonEncoder.toBase64Url({
        typ: 'application/didcomm-encrypted+json',
        alg,
        enc: 'A256CBC-HS512',
        ...(alg === 'ECDH-1PU+A256KW' ? { skid: authcryptSenderSkid } : {}),
      }),
      recipients: [{ header: { kid: recipientKid }, encrypted_key: 'encrypted-key' }],
      iv: 'iv',
      ciphertext: 'ciphertext',
      tag: 'tag',
    }) as DidCommV2EncryptedMessage

  const createTestPlaintext = (overrides: Partial<DidCommV2PlaintextMessage> = {}): DidCommV2PlaintextMessage => ({
    id: 'message-1',
    type: 'https://example.com/didcomm-test/1.0/message',
    from: authcryptSenderDid,
    to: [recipientDid],
    body: {},
    ...overrides,
  })

  const createTestEnvelope = ({
    decrypted = createTestPlaintext(),
    sender = senderKey,
  }: {
    decrypted?: DidCommV2PlaintextMessage | DidCommV2SignedMessage
    sender?: Kms.PublicJwk<Kms.X25519PublicJwk> | null
  } = {}) => {
    const envelopeService = {
      unpack: async () => ({ plaintext: decrypted, senderKey: sender }),
      verifySignedMessage: async (_agentContext: unknown, signedMessage: DidCommV2SignedMessage) => {
        const signerKid = signedMessage.signatures[0]?.header?.kid
        if (!signerKid) throw new Error('Test signed message is missing signer kid')
        return {
          plaintext: createTestPlaintext(),
          signers: [{ kid: signerKid, alg: 'EdDSA', jwk: senderKey }],
        }
      },
    } as unknown as DidCommV2EnvelopeService
    const keyResolver = {
      resolveRecipientKey: async () => ({ recipientKey, matchedKid: recipientKid }),
      resolveSenderKey: async () => senderKey,
    } as unknown as DidCommV2KeyResolver

    const agentContext = getAgentContext({
      contextCorrelationId: 'v2-envelope-addressing',
      agentConfig: getAgentConfig('V2EnvelopeAddressing'),
      registerInstances: [[InjectionSymbols.Logger, testLogger]],
    })
    agentContext.dependencyManager.registerInstance(DidsApi, {
      resolveDidDocument: async () => {
        throw new Error('Unexpected DID resolution in envelope addressing test')
      },
    } as unknown as DidsApi)

    return {
      envelope: new DidCommV2Envelope(
        envelopeService,
        keyResolver,
        new DidCommModuleConfig({ didcommVersions: ['v1', 'v2'] })
      ),
      agentContext,
    }
  }

  describe('authcrypt addressing', () => {
    it('accepts matching from and recipient DID', async () => {
      const { envelope, agentContext } = createTestEnvelope()

      // Plaintext from/to agree with the authenticated authcrypt sender and recipient.
      await expect(envelope.unpack(agentContext, createTestEncryptedMessage())).resolves.toMatchObject({
        plaintextMessage: expect.objectContaining({ from: authcryptSenderDid, to: [recipientDid] }),
        senderKey,
        recipientKey,
      })
    })

    it('rejects a missing from', async () => {
      const { envelope, agentContext } = createTestEnvelope({ decrypted: createTestPlaintext({ from: undefined }) })

      // Authcrypt requires a plaintext sender that can be bound to authcryptSenderSkid.
      await expect(envelope.unpack(agentContext, createTestEncryptedMessage())).rejects.toThrow(
        'DIDComm v2 authcrypt plaintext requires from'
      )
    })

    it('rejects from when it does not match skid', async () => {
      const { envelope, agentContext } = createTestEnvelope({
        decrypted: createTestPlaintext({ from: 'did:example:eve' }),
      })

      // Plaintext Eve conflicts with the authenticated Alice sender in authcryptSenderSkid.
      await expect(envelope.unpack(agentContext, createTestEncryptedMessage())).rejects.toThrow(
        'does not match authenticated sender DID'
      )
    })

    it('rejects a missing recipient', async () => {
      const { envelope, agentContext } = createTestEnvelope({ decrypted: createTestPlaintext({ to: [] }) })

      // Plaintext recipient must agree with the authenticated recipientKid.
      await expect(envelope.unpack(agentContext, createTestEncryptedMessage())).rejects.toThrow(
        'does not contain authenticated recipient'
      )
    })

    it('rejects an unrelated recipient', async () => {
      const { envelope, agentContext } = createTestEnvelope({
        decrypted: createTestPlaintext({ to: ['did:example:eve'] }),
      })

      // Plaintext recipient must agree with the authenticated recipientKid.
      await expect(envelope.unpack(agentContext, createTestEncryptedMessage())).rejects.toThrow(
        'does not contain authenticated recipient'
      )
    })
  })

  describe('anoncrypt trust boundary', () => {
    it('preserves supplied plaintext from without an authenticated sender key', async () => {
      const { envelope, agentContext } = createTestEnvelope({
        decrypted: createTestPlaintext({ from: 'did:example:eve' }),
        sender: null,
      })

      // Anoncrypt has no authenticated sender, plaintext Eve is untrusted metadata.
      await expect(envelope.unpack(agentContext, createTestEncryptedMessage('ECDH-ES+A256KW'))).resolves.toMatchObject({
        plaintextMessage: expect.objectContaining({ from: 'did:example:eve' }),
        senderKey: undefined,
      })
    })
  })

  describe('nested signed plaintext', () => {
    it('rejects a nested signer whose DID differs from the outer authcrypt skid DID', async () => {
      const nestedSignerDid = 'did:example:eve'
      const nestedSignerKid = `${nestedSignerDid}#key-1`
      const signed: DidCommV2SignedMessage = {
        payload: 'payload',
        signatures: [
          {
            protected: JsonEncoder.toBase64Url({
              typ: 'application/didcomm-signed+json',
              alg: 'EdDSA',
            }),
            header: { kid: nestedSignerKid },
            signature: 'signature',
          },
        ],
      }
      const { envelope, agentContext } = createTestEnvelope({
        decrypted: signed,
      })

      // Nested JWS signed by Eve conflicts with the outer authcrypt sender Alice.
      await expect(envelope.unpack(agentContext, createTestEncryptedMessage())).rejects.toThrow(
        'does not match authenticated sender DID'
      )
    })
  })
})
