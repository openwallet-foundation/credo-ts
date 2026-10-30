import path from 'node:path'
import { testRecordEncoding } from '../../../../core/tests/recordEncoding'
import { QuestionAnswerState } from '../../models'
import { QuestionAnswerRole } from '../../QuestionAnswerRole'
import { QuestionAnswerRecord } from '../QuestionAnswerRecord'

const createdAt = new Date('2026-01-01T00:00:00.000Z')
const updatedAt = new Date('2026-01-02T00:00:00.000Z')

testRecordEncoding(path.join(__dirname, '__fixtures__/records'), {
  QuestionAnswerRecord: () => {
    const record = new QuestionAnswerRecord({
      id: 'question-answer-record-id',
      createdAt,
      tags: { custom: 'tag' },
      connectionId: 'connection-id',
      role: QuestionAnswerRole.Responder,
      signatureRequired: true,
      state: QuestionAnswerState.AnswerSent,
      threadId: 'thread-id',
      questionText: 'Are you on the phone?',
      questionDetail: 'We noticed a login from a new device',
      validResponses: [{ text: 'Yes' }, { text: 'No' }],
      response: 'Yes',
    })
    record.updatedAt = updatedAt
    record.metadata.set('meta', { key: 'value' })
    return record
  },
})
