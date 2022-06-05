import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { Logger } from '../../../logger'
import type { QuestionAnswerStateChangedEvent } from '../QuestionAnswerEvents'
import type { ValidResponse } from '../models'
import type { QuestionAnswerTags } from '../repository'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../error'
import { QuestionAnswerEventTypes } from '../QuestionAnswerEvents'
import { QuestionAnswerRole } from '../QuestionAnswerRole'
import { QuestionMessage, AnswerMessage } from '../messages'
import { QuestionAnswerState } from '../models'
import { QuestionAnswerRecord, QuestionAnswerRepository } from '../repository'

@scoped(Lifecycle.ContainerScoped)
export class QuestionAnswerService {
  private questionAnswerRepository: QuestionAnswerRepository
  private eventEmitter: EventEmitter
  private logger: Logger

  public constructor(
    questionAnswerRepository: QuestionAnswerRepository,
    eventEmitter: EventEmitter,
    agentConfig: AgentConfig
  ) {
    this.questionAnswerRepository = questionAnswerRepository
    this.eventEmitter = eventEmitter
    this.logger = agentConfig.logger
  }
  /**
   * Create a question message and a new QuestionAnswer record for the questioner role
   *
   * @param question text for question message
   * @param details optional details for question message
   * @param connectionId connection for QuestionAnswer record
   * @param validResponses array of valid responses for question
   * @returns question message and QuestionAnswer record
   */
  public async createQuestion(
    connectionId: string,
    config: {
      question: string
      validResponses: ValidResponse[]
      detail?: string
    }
  ) {
    const questionMessage = new QuestionMessage({
      questionText: config.question,
      questionDetail: config?.detail,
      signatureRequired: false,
      validResponses: config.validResponses,
    })

    const questionAnswerRecord = await this.createRecord({
      questionText: questionMessage.questionText,
      questionDetail: questionMessage.questionDetail,
      threadId: questionMessage.id,
      connectionId: connectionId,
      role: QuestionAnswerRole.Questioner,
      signatureRequired: false,
      state: QuestionAnswerState.QuestionSent,
      validResponses: questionMessage.validResponses,
    })

    await this.questionAnswerRepository.save(questionAnswerRecord)

    this.eventEmitter.emit<QuestionAnswerStateChangedEvent>({
      type: QuestionAnswerEventTypes.QuestionAnswerStateChanged,
      payload: { previousState: null, questionAnswerRecord },
    })

    return { questionMessage, questionAnswerRecord }
  }

  /**
   * receive question message and create record for responder role
   *
   * @param messageContext the message context containing a question message
   * @returns QuestionAnswer record
   */
  public async processReceiveQuestion(
    messageContext: InboundMessageContext<QuestionMessage>
  ): Promise<QuestionAnswerRecord> {
    const { message: questionMessage } = messageContext

    this.logger.debug(`Receiving question message with id ${questionMessage.id}`)

    const connection = messageContext.assertReadyConnection()
    const questionRecord = await this.getById(questionMessage.id)
    questionRecord.assertState(QuestionAnswerState.QuestionSent)

    const questionAnswerRecord = await this.createRecord({
      questionText: questionMessage.questionText,
      questionDetail: questionMessage.questionDetail,
      connectionId: connection?.id,
      threadId: questionMessage.id,
      role: QuestionAnswerRole.Responder,
      signatureRequired: false,
      state: QuestionAnswerState.QuestionReceived,
      validResponses: questionMessage.validResponses,
    })

    await this.questionAnswerRepository.save(questionAnswerRecord)

    this.eventEmitter.emit<QuestionAnswerStateChangedEvent>({
      type: QuestionAnswerEventTypes.QuestionAnswerStateChanged,
      payload: { previousState: null, questionAnswerRecord },
    })

    return questionAnswerRecord
  }

  /**
   * create answer message, check that response is valid
   *
   * @param questionAnswerRecord record containing question and valid responses
   * @param response response used in answer message
   * @returns answer message and QuestionAnswer record
   */
  public async createAnswer(questionAnswerRecord: QuestionAnswerRecord, response: string) {
    const answerMessage = new AnswerMessage({ response: response, threadId: questionAnswerRecord.threadId })

    questionAnswerRecord.assertState(QuestionAnswerState.QuestionReceived)

    questionAnswerRecord.response = response

    if (questionAnswerRecord.validResponses.some((e) => e.text === response)) {
      await this.updateState(questionAnswerRecord, QuestionAnswerState.AnswerSent)
    } else {
      throw new AriesFrameworkError(`Response does not match valid responses`)
    }
    return { answerMessage, questionAnswerRecord }
  }

  /**
   * receive answer as questioner
   *
   * @param messageContext the message context containing an answer message message
   * @returns QuestionAnswer record
   */
  public async receiveAnswer(messageContext: InboundMessageContext<AnswerMessage>): Promise<QuestionAnswerRecord> {
    const { message: answerMessage } = messageContext

    this.logger.debug(`Receiving answer message with id ${answerMessage.id}`)

    const connection = messageContext.assertReadyConnection()
    const answerRecord = await this.getById(answerMessage.id)
    answerRecord.assertState(QuestionAnswerState.AnswerSent)

    const questionAnswerRecord: QuestionAnswerRecord = await this.getByThreadAndConnectionId(
      answerMessage.threadId,
      connection?.id
    )

    questionAnswerRecord.response = answerMessage.response

    await this.updateState(questionAnswerRecord, QuestionAnswerState.AnswerReceived)

    return questionAnswerRecord
  }

  /**
   * Update the record to a new state and emit an state changed event. Also updates the record
   * in storage.
   *
   * @param questionAnswerRecord The question answer record to update the state for
   * @param newState The state to update to
   *
   */
  private async updateState(questionAnswerRecord: QuestionAnswerRecord, newState: QuestionAnswerState) {
    const previousState = questionAnswerRecord.state
    questionAnswerRecord.state = newState
    await this.questionAnswerRepository.update(questionAnswerRecord)

    this.eventEmitter.emit<QuestionAnswerStateChangedEvent>({
      type: QuestionAnswerEventTypes.QuestionAnswerStateChanged,
      payload: {
        previousState,
        questionAnswerRecord: questionAnswerRecord,
      },
    })
  }

  private async createRecord(options: {
    questionText: string
    questionDetail?: string
    connectionId: string
    role: QuestionAnswerRole
    signatureRequired: boolean
    state: QuestionAnswerState
    threadId: string
    validResponses: ValidResponse[]
  }): Promise<QuestionAnswerRecord> {
    const questionMessageRecord = new QuestionAnswerRecord({
      questionText: options.questionText,
      questionDetail: options.questionDetail,
      connectionId: options.connectionId,
      threadId: options.threadId,
      role: options.role,
      signatureRequired: options.signatureRequired,
      state: options.state,
      validResponses: options.validResponses,
    })

    return questionMessageRecord
  }

  /**
   * Retrieve a question answer record by connection id and thread id
   *
   * @param connectionId The connection id
   * @param threadId The thread id
   * @throws {RecordNotFoundError} If no record is found
   * @throws {RecordDuplicateError} If multiple records are found
   * @returns The credential record
   */
  public getByThreadAndConnectionId(connectionId: string, threadId: string): Promise<QuestionAnswerRecord> {
    return this.questionAnswerRepository.getSingleByQuery({
      connectionId,
      threadId,
    })
  }

  /**
   * Retrieve a connection record by id
   *
   * @param questionAnswerId The questionAnswer record id
   * @throws {RecordNotFoundError} If no record is found
   * @return The connection record
   *
   */
  public getById(questionAnswerId: string): Promise<QuestionAnswerRecord> {
    return this.questionAnswerRepository.getById(questionAnswerId)
  }

  /**
   * Retrieve all QuestionAnswer records
   *
   * @returns List containing all QuestionAnswer records
   */
  public getAll() {
    return this.questionAnswerRepository.getAll()
  }

  public async findAllByQuery(query: Partial<QuestionAnswerTags>) {
    return this.questionAnswerRepository.findByQuery(query)
  }
}
