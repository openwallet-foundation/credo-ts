import { JsonEncoder, Kms } from '@credo-ts/core'
import { vi } from 'vitest'
import { Agent } from '../../../core/src/agent/Agent'
import { getAgentOptions } from '../../../core/tests/helpers'
import { setupSubjectTransports } from '../../../core/tests/transport'
import type { DecryptedDidCommMessageContext } from '../DidCommEnvelopeService'
import { DidCommMessageReceiver } from '../DidCommMessageReceiver'
import { DidCommConnectionService } from '../modules/connections'
import { isDidCommV2EncryptedMessage, isDidCommV2SignedMessage } from '../util/didcommVersion'

describe('DidCommMessageReceiver', () => {
  describe('v2 message handling', () => {
    it('throws when receiving v2 encrypted message and v2 is not in didcommVersions', async () => {
      const agent = new Agent(
        getAgentOptions('ReceiverTest', { didcommVersions: ['v1'] }, {}, undefined, { requireDidcomm: true })
      )
      setupSubjectTransports([agent])
      await agent.initialize()

      const v2Protected = JsonEncoder.toBase64Url({
        typ: 'application/didcomm-encrypted+json',
        alg: 'ECDH-1PU+A256KW',
        enc: 'A256GCM',
        skid: 'key-id',
      })

      const v2Message = {
        protected: v2Protected,
        recipients: [{ header: { kid: 'recipient-kid' }, encrypted_key: 'enc' }],
        iv: 'dGVzdC1pdi0xMg',
        ciphertext: 'dGVzdC1jaXBoZXJ0ZXh0',
        tag: 'dGVzdC10YWc',
      }

      expect(isDidCommV2EncryptedMessage(v2Message)).toBe(true)

      const receiver = agent.dependencyManager.resolve(DidCommMessageReceiver)
      await expect(receiver.receiveMessage(v2Message, { contextCorrelationId: 'default' })).rejects.toThrow(
        /v2 is not enabled/
      )

      await agent.shutdown()
    })

    it('throws when receiving v2 signed message and v2 is not in didcommVersions', async () => {
      const agent = new Agent(
        getAgentOptions('ReceiverSignedTest', { didcommVersions: ['v1'] }, {}, undefined, { requireDidcomm: true })
      )
      setupSubjectTransports([agent])
      await agent.initialize()

      const protectedHeader = JsonEncoder.toBase64Url({
        typ: 'application/didcomm-signed+json',
        alg: 'EdDSA',
        kid: 'did:example:alice#key-1',
      })

      const signedMessage = {
        payload: JsonEncoder.toBase64Url({ id: 'm', type: 'test', from: 'did:example:alice' }),
        signatures: [{ protected: protectedHeader, signature: 'AA' }],
      }

      expect(isDidCommV2SignedMessage(signedMessage)).toBe(true)

      const receiver = agent.dependencyManager.resolve(DidCommMessageReceiver)
      await expect(receiver.receiveMessage(signedMessage, { contextCorrelationId: 'default' })).rejects.toThrow(
        /v2 is not enabled/
      )

      await agent.shutdown()
    })

    it('does not use anoncrypt plaintext from for connection lookup', async () => {
      const agent = new Agent(
        getAgentOptions(
          'ReceiverAnoncryptTrustBoundaryTest',
          { didcommVersions: ['v1', 'v2'] },
          { connections: { autoCreateConnectionOnFirstMessage: true } },
          undefined,
          { requireDidcomm: true }
        )
      )
      setupSubjectTransports([agent])
      await agent.initialize()

      const receiver = agent.dependencyManager.resolve(DidCommMessageReceiver)
      const connectionService = agent.dependencyManager.resolve(DidCommConnectionService)
      const findByDids = vi.spyOn(connectionService, 'findByDids')
      const createConnection = vi.spyOn(connectionService, 'createConnection')
      const decryptedMessage = {
        plaintextMessage: {
          id: 'anoncrypt-message',
          type: 'https://example.com/didcomm-test/1.0/message',
          from: 'did:example:eve',
          to: ['did:example:alice'],
        },
        recipientKey: {} as Kms.PublicJwk<Kms.X25519PublicJwk>,
      } satisfies DecryptedDidCommMessageContext

      // Exercise connection selection with an unauthenticated plaintext sender.
      await (
        receiver as unknown as {
          findConnection: (
            agentContext: typeof agent.context,
            decryptedMessage: DecryptedDidCommMessageContext
          ) => Promise<unknown>
        }
      ).findConnection(agent.context, decryptedMessage)

      // Unauthenticated plaintext from did not authorize connection lookup.
      expect(findByDids).not.toHaveBeenCalled()
      // Unauthenticated plaintext from did not trigger connection creation.
      expect(createConnection).not.toHaveBeenCalled()

      await agent.shutdown()
    })
  })
})
