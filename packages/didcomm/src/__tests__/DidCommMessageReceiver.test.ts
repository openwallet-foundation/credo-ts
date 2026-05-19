import { JsonEncoder } from '@credo-ts/core'
import { Agent } from '../../../core/src/agent/Agent'
import { getAgentOptions } from '../../../core/tests/helpers'
import { setupSubjectTransports } from '../../../core/tests/transport'
import { DidCommMessageReceiver } from '../DidCommMessageReceiver'
import { isDidCommV2EncryptedMessage } from '../util/didcommVersion'

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
        /v2 is not enabled/
      )

      await agent.shutdown()
    })
  })
})
