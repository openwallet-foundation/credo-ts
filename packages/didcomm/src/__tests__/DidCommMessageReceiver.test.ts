import { JsonEncoder } from '@credo-ts/core'
import { Agent } from '../../../core/src/agent/Agent'
import { getAgentOptions, getMockConnection } from '../../../core/tests/helpers'
import { setupSubjectTransports } from '../../../core/tests/transport'
import { DidCommMessageReceiver } from '../DidCommMessageReceiver'
import { DidCommMessageSender } from '../DidCommMessageSender'
import { DidCommProblemReportV2Message } from '../messages'
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

    it('does not answer an invalid DIDComm v2 problem report with a problem report', async () => {
      const agent = new Agent(getAgentOptions('ReceiverProblemReportTest', {}, {}, undefined, { requireDidcomm: true }))
      await agent.initialize()

      const sendMessage = vi
        .spyOn(agent.dependencyManager.resolve(DidCommMessageSender), 'sendMessage')
        .mockResolvedValue()
      const receiver = agent.dependencyManager.resolve(DidCommMessageReceiver)
      const connection = getMockConnection()

      // @ts-expect-error
      const transformed = receiver.transformAndValidate(
        agent.context,
        { '@type': 'https://didcomm.org/report-problem/2.0/problem-report', '@id': 'short' },
        connection
      )
      await expect(transformed).rejects.toThrow('Not sending problem report in response to problem report')
      expect(sendMessage).not.toHaveBeenCalled()

      await agent.shutdown()
    })

    describe('invalid message on a DIDComm v2 connection', () => {
      const pingId = '4c1d6c5e-2f44-4a8e-9d3c-1f0b6a7e8d90'
      let agent: Agent

      beforeAll(async () => {
        agent = new Agent(getAgentOptions('ReceiverProblemReportV2Test', {}, {}, undefined, { requireDidcomm: true }))
        await agent.initialize()
      })

      afterAll(async () => {
        await agent.shutdown()
      })

      afterEach(() => {
        vi.restoreAllMocks()
      })

      const transformInvalidPing = async (ping: { '@id': string; '~thread': { thid: string } }) => {
        const sendMessage = vi
          .spyOn(agent.dependencyManager.resolve(DidCommMessageSender), 'sendMessage')
          .mockResolvedValue()
        const receiver = agent.dependencyManager.resolve(DidCommMessageReceiver)

        // @ts-expect-error
        const transformed = receiver.transformAndValidate(
          agent.context,
          { '@type': 'https://didcomm.org/trust-ping/2.0/ping', response_requested: 'yes', ...ping },
          getMockConnection({ didcommVersion: 'v2' })
        )
        await expect(transformed).rejects.toThrow('Error validating message https://didcomm.org/trust-ping/2.0/ping')

        return sendMessage.mock.calls.map(([{ message }]) => message)
      }

      it('answers with a report-problem 2.0 problem report', async () => {
        const [problemReport] = await transformInvalidPing({ '@id': pingId, '~thread': { thid: 'thread-1' } })

        expect(problemReport).toBeInstanceOf(DidCommProblemReportV2Message)
        expect(problemReport).toMatchObject({
          ack: [pingId],
          code: 'e.p.msg.message-parse-failure',
          comment: 'Bad message: {1}',
          args: ['Error validating message https://didcomm.org/trust-ping/2.0/ping'],
        })
        expect(problemReport.thread?.parentThreadId).toBe('thread-1')
      })

      it('uses the message id as pthid when the thid is not valid', async () => {
        const [problemReport] = await transformInvalidPing({ '@id': pingId, '~thread': { thid: `urn:uuid:${pingId}` } })

        expect(problemReport).toMatchObject({ ack: [pingId] })
        expect(problemReport.thread?.parentThreadId).toBe(pingId)
      })

      it('does not answer a message without a valid id', async () => {
        expect(await transformInvalidPing({ '@id': 'short', '~thread': { thid: 'thread-1' } })).toEqual([])
      })
    })
  })
})
