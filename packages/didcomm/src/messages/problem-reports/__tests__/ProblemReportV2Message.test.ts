import { DidCommProblemReportMessage } from '../DidCommProblemReportMessage'
import { DidCommProblemReportV2Message } from '../DidCommProblemReportV2Message'

describe('DidCommProblemReportV2Message', () => {
  it('only supports DIDComm v2', () => {
    const message = new DidCommProblemReportV2Message({ parentThreadId: 'thread-1', code: 'e.p.msg' })

    expect(message.type).toBe('https://didcomm.org/report-problem/2.0/problem-report')
    expect(message.supportedDidCommVersions).toEqual(['v2'])
  })

  describe('fromProblemReportMessage', () => {
    const problemReport = new DidCommProblemReportMessage({
      description: { en: 'boom', code: 'message-parse-failure' },
    })

    it('uses the thread id as pthid and the message id as ack', () => {
      const message = DidCommProblemReportV2Message.fromProblemReportMessage(problemReport, {
        id: 'message-1',
        threadId: 'thread-1',
      })

      expect(message?.thread?.parentThreadId).toBe('thread-1')
      expect(message?.ack).toEqual(['message-1'])
    })

    it('uses the message id as pthid when the thread id is not a valid pthid', () => {
      const message = DidCommProblemReportV2Message.fromProblemReportMessage(problemReport, {
        id: 'message-1',
        threadId: 'urn:uuid:4c1d6c5e-2f44-4a8e-9d3c-1f0b6a7e8d90',
      })

      expect(message?.thread?.parentThreadId).toBe('message-1')
    })

    it('returns no report when the message id is not a valid pthid', () => {
      expect(
        DidCommProblemReportV2Message.fromProblemReportMessage(problemReport, {
          id: 'urn:uuid:4c1d6c5e-2f44-4a8e-9d3c-1f0b6a7e8d90',
        })
      ).toBeUndefined()
    })
  })
})
