import { JsonEncoder } from '@credo-ts/core'
import { Agent } from '../../../core/src/agent/Agent'
import { getAgentOptions } from '../../../core/tests/helpers'
import { setupSubjectTransports } from '../../../core/tests/transport'
import { DidCommMessageReceiver } from '../DidCommMessageReceiver'
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
  })
})
