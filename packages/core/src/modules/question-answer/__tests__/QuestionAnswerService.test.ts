import type { AgentContext } from '../../../agent'
import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Repository } from '../../../storage/Repository'
import type { QuestionAnswerStateChangedEvent } from '../QuestionAnswerEvents'
import type { ValidResponse } from '../models'

import { Subject } from 'rxjs'

import {
  agentDependencies,
  getAgentConfig,
  getAgentContext,
  getMockConnection,
  mockFunction,
} from '../../../../tests/helpers'
import { EventEmitter } from '../../../agent/EventEmitter'
import { SigningProviderRegistry } from '../../../crypto/signing-provider'
import { IndyWallet } from '../../../wallet/IndyWallet'
import { QuestionAnswerEventTypes } from '../QuestionAnswerEvents'
import { QuestionAnswerRole } from '../QuestionAnswerRole'
import { QuestionMessage } from '../messages'
import { QuestionAnswerState } from '../models'
import { QuestionAnswerRecord, QuestionAnswerRepository } from '../repository'
import { QuestionAnswerService } from '../services'

jest.mock('../repository/QuestionAnswerRepository')
const QuestionAnswerRepositoryMock = QuestionAnswerRepository as jest.Mock<QuestionAnswerRepository>

describe('QuestionAnswerService', () => {
  const mockConnectionRecord = getMockConnection({
    id: 'd3849ac3-c981-455b-a1aa-a10bea6cead8',
    did: 'did:sov:C2SsBf5QUQpqSAQfhu3sd2',
  })

  let wallet: IndyWallet
  let agentConfig: AgentConfig
  let questionAnswerRepository: Repository<QuestionAnswerRecord>
  let questionAnswerService: QuestionAnswerService
  let eventEmitter: EventEmitter
  let agentContext: AgentContext

  const mockQuestionAnswerRecord = (options: {
    questionText: string
    questionDetail?: string
    connectionId: string
    role: QuestionAnswerRole
    signatureRequired: boolean
    state: QuestionAnswerState
    threadId: string
    validResponses: ValidResponse[]
  }) => {
    return new QuestionAnswerRecord({
      questionText: options.questionText,
      questionDetail: options.questionDetail,
      connectionId: options.connectionId,
      role: options.role,
      signatureRequired: options.signatureRequired,
      state: options.state,
      threadId: options.threadId,
      validResponses: options.validResponses,
    })
  }

  beforeAll(async () => {
    agentConfig = getAgentConfig('QuestionAnswerServiceTest')
    wallet = new IndyWallet(agentConfig.agentDependencies, agentConfig.logger, new SigningProviderRegistry([]))
    agentContext = getAgentContext()
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await wallet.createAndOpen(agentConfig.walletConfig!)
  })

  beforeEach(async () => {
    questionAnswerRepository = new QuestionAnswerRepositoryMock()
    eventEmitter = new EventEmitter(agentDependencies, new Subject())
    questionAnswerService = new QuestionAnswerService(questionAnswerRepository, eventEmitter, agentConfig.logger)
  })

  afterAll(async () => {
    await wallet.delete()
  })

  describe('create question', () => {
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

      await questionAnswerService.createQuestion(agentContext, mockConnectionRecord.id, {
        question: questionMessage.questionText,
        validResponses: questionMessage.validResponses,
      })

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: 'QuestionAnswerStateChanged',
        metadata: {
          contextCorrelationId: 'mock',
        },
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
  describe('create answer', () => {
    let mockRecord: QuestionAnswerRecord

    beforeAll(() => {
      mockRecord = mockQuestionAnswerRecord({
        questionText: 'Alice, are you on the phone with Bob?',
        connectionId: mockConnectionRecord.id,
        role: QuestionAnswerRole.Responder,
        signatureRequired: false,
        state: QuestionAnswerState.QuestionReceived,
        threadId: '123',
        validResponses: [{ text: 'Yes' }, { text: 'No' }],
      })
    })

    it(`throws an error when invalid response is provided`, async () => {
      expect(questionAnswerService.createAnswer(agentContext, mockRecord, 'Maybe')).rejects.toThrowError(
        `Response does not match valid responses`
      )
    })

    it(`emits an answer with a valid response and question answer record`, async () => {
      const eventListenerMock = jest.fn()
      eventEmitter.on<QuestionAnswerStateChangedEvent>(
        QuestionAnswerEventTypes.QuestionAnswerStateChanged,
        eventListenerMock
      )

      mockFunction(questionAnswerRepository.getSingleByQuery).mockReturnValue(Promise.resolve(mockRecord))

      await questionAnswerService.createAnswer(agentContext, mockRecord, 'Yes')

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: 'QuestionAnswerStateChanged',
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          previousState: QuestionAnswerState.QuestionReceived,
          questionAnswerRecord: expect.objectContaining({
            connectionId: mockConnectionRecord.id,
            role: QuestionAnswerRole.Responder,
            state: QuestionAnswerState.AnswerSent,
            response: 'Yes',
          }),
        },
      })
    })
  })
})
