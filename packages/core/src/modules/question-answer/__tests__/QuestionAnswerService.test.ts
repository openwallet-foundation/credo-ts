import type { AgentConfig } from '../../../agent/AgentConfig'
import type { StorageService } from '../../../storage/StorageService'
import type { QuestionAnswerStateChangedEvent } from '../QuestionAnswerEvents'

import { getAgentConfig, getMockConnection } from '../../../../tests/helpers'
import { EventEmitter } from '../../../agent/EventEmitter'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import { IndyStorageService } from '../../../storage/IndyStorageService'
import { Repository } from '../../../storage/Repository'
import { IndyWallet } from '../../../wallet/IndyWallet'
import { QuestionAnswerEventTypes } from '../QuestionAnswerEvents'
import { QuestionAnswerRole } from '../QuestionAnswerRole'
import { QuestionMessage, AnswerMessage } from '../messages'
import { QuestionAnswerRecord } from '../repository/QuestionAnswerRecord'
import { QuestionAnswerService } from '../services'
import { QuestionAnswerState, ValidResponse } from '../models'

describe('QuestionAnswerService', () => {
  const mockConnectionRecord = getMockConnection({
    id: 'd3849ac3-c981-455b-a1aa-a10bea6cead8',
    verkey: '71X9Y1aSPK11ariWUYQCYMjSewf2Kw2JFGeygEf9uZd9',
    did: 'did:sov:C2SsBf5QUQpqSAQfhu3sd2',
  })

  let wallet: IndyWallet
  let storageService: StorageService<QuestionAnswerRecord>
  let agentConfig: AgentConfig

  beforeAll(async () => {
    agentConfig = getAgentConfig('QuestionAnswerServiceTest')
    wallet = new IndyWallet(agentConfig)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await wallet.initialize(agentConfig.walletConfig!)
    storageService = new IndyStorageService(wallet, agentConfig)
  })

  afterAll(async () => {
    await wallet.delete()
  })

  describe('create question', () => {
    let questionAnswerRepository: Repository<QuestionAnswerRecord>
    let questionAnswerService: QuestionAnswerService
    let eventEmitter: EventEmitter

    beforeAll(() => {
      questionAnswerRepository = new Repository<QuestionAnswerRecord>(QuestionAnswerRecord, storageService)
      eventEmitter = new EventEmitter(agentConfig)
      questionAnswerService = new QuestionAnswerService(questionAnswerRepository, eventEmitter, agentConfig)
    })

    it(`emits a question with question text, valid responses, and question answer record`, async () => {
      const eventListenerMock = jest.fn()
      eventEmitter.on<QuestionAnswerStateChangedEvent>(
        QuestionAnswerEventTypes.QuestionAnswerStateChanged,
        eventListenerMock
      )

      const questionMessage = new QuestionMessage({
        questionText: 'Alice, are you on the phone with Bob?',
        signatureRequired: false,
        validResponses: [{ text: 'Yes' }, { text: 'No' }],
      })

      await questionAnswerService.createQuestion(
        mockConnectionRecord.id,
        questionMessage.questionText,
        questionMessage.validResponses
      )

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: 'QuestionAnswerStateChanged',
        payload: {
          previousState: null,
          questionAnswerRecord: expect.objectContaining({
            connectionId: mockConnectionRecord.id,
            questionText: questionMessage.questionText,
            role: QuestionAnswerRole.Questioner,
            state: QuestionAnswerState.QuestionSent,
            validResponses: questionMessage.validResponses,
          }),
        },
      })
    })
  })
})
