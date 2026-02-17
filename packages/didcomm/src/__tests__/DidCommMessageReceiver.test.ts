import { JsonEncoder } from '@credo-ts/core'
import { DidCommMessageReceiver } from '../DidCommMessageReceiver'
import { Agent } from '../../../core/src/agent/Agent'
import { getAgentOptions } from '../../../core/tests/helpers'
import { setupSubjectTransports } from '../../../core/tests/transport'
import { isDidCommV2EncryptedMessage } from '../util/didcommVersion'

describe('DidCommMessageReceiver', () => {
  describe('v2 message handling', () => {
    it('throws when receiving v2 encrypted message and acceptDidCommV2 is disabled', async () => {
      const agent = new Agent(
        getAgentOptions('ReceiverTest', { acceptDidCommV2: false }, {}, undefined, { requireDidcomm: true })
      )
      setupSubjectTransports([agent])
      await agent.initialize()

      const v2Protected = JsonEncoder.toBase64URL({
        typ: 'application/didcomm-encrypted+json',
        alg: 'ECDH-1PU+A256KW',
        enc: 'A256GCM',
        skid: 'key-id',
        recipients: [{ header: { kid: 'recipient-kid' }, encrypted_key: 'enc' }],
      })

      const v2Message = {
        protected: v2Protected,
        iv: 'dGVzdC1pdi0xMg',
        ciphertext: 'dGVzdC1jaXBoZXJ0ZXh0',
        tag: 'dGVzdC10YWc',
      }

      expect(isDidCommV2EncryptedMessage(v2Message)).toBe(true)

      const receiver = agent.dependencyManager.resolve(DidCommMessageReceiver)
      await expect(receiver.receiveMessage(v2Message, { contextCorrelationId: 'default' })).rejects.toThrow(
        /acceptDidCommV2 is disabled/
      )

      await agent.shutdown()
    })
  })
})
