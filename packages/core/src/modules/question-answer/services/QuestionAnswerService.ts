import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { Logger } from '../../../logger'
import type { ValidResponse } from '../models'
import type { QuestionAnswerTags } from '../repository'
import type { QuestionAnswerStateChangedEvent } from '../QuestionAnswerEvents'

import { Lifecycle, scoped } from 'tsyringe'
import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../error'
import { QuestionMessage, AnswerMessage } from '../messages'
import { QuestionAnswerState } from '../models'
import { QuestionAnswerEventTypes } from '../QuestionAnswerEvents'
import { QuestionAnswerRole } from '../QuestionAnswerRole'
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
   *
   * @param question
   * @param details
   * @param connectionId
   * @param validResponses
   * @returns
   */
  public async createQuestion(
    connectionId: string,
    question: string,
    validResponses: ValidResponse[],
    details?: string
  ) {
    const questionMessage = new QuestionMessage({
      questionText: question,
      questionDetail: details,
      signatureRequired: false,
      validResponses: validResponses,
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
   *
   * @param messageContext
   * @returns
   */
  public async receiveQuestion(messageContext: InboundMessageContext<QuestionMessage>): Promise<QuestionAnswerRecord> {
    const { message: questionMessage, connection } = messageContext

    this.logger.debug(`Receiving question message with id ${questionMessage.id}`)

    if (!connection) {
      throw new AriesFrameworkError(`Connection for verkey ${messageContext.recipientVerkey} not found!`)
    }

    if (!connection.theirKey) {
      throw new AriesFrameworkError(`Connection with verkey ${connection.verkey} has no recipient keys.`)
    }

    const questionAnswerRecord = await this.createRecord({
      questionText: questionMessage.questionText,
      questionDetail: questionMessage.questionDetail,
      connectionId: connection?.id,
      threadId: questionMessage.id,
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

    return questionAnswerRecord
  }

  /**
   *
   * @param response
   * @param connectionId
   * @param questionAnswerRecord
   * @returns
   */
  public async createAnswer(connectionId: string, questionAnswerRecord: QuestionAnswerRecord, response: string) {
    const answerMessage = new AnswerMessage({ response: response, threadId: questionAnswerRecord.threadId })

    questionAnswerRecord.response = response

    if (questionAnswerRecord.validResponses.some((e) => e.text === response)) {
      await this.updateState(questionAnswerRecord, QuestionAnswerState.AnswerSent)
    } else {
      this.logger.error(`Response does not match valid responses`)
    }
    return { answerMessage, questionAnswerRecord }
  }

  /**
   *
   * @param messageContext
   * @returns
   */
  public async receiveAnswer(messageContext: InboundMessageContext<AnswerMessage>): Promise<QuestionAnswerRecord> {
    const { message: answerMessage, connection } = messageContext

    this.logger.debug(`Receiving answer message with id ${answerMessage.id}`)

    if (!connection) {
      throw new AriesFrameworkError(`Connection for verkey ${messageContext.recipientVerkey} not found!`)
    }

    if (!connection.theirKey) {
      throw new AriesFrameworkError(`Connection with verkey ${connection.verkey} has no recipient keys.`)
    }

    try {
      const questionAnswerRecord: QuestionAnswerRecord = await this.getByThreadAndConnectionId(
        answerMessage.threadId,
        connection?.id
      )

      await this.updateState(questionAnswerRecord, QuestionAnswerState.AnswerReceived)

      return questionAnswerRecord
    } catch (error) {
      this.logger.error(
        `Unable to get question answer record by threadId "${answerMessage.threadId}" and connection id "${connection?.id}" and unable to update state`,
        { error }
      )
      throw error
    }
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

  /**
   * @todo use connection from message context
   */
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
   *
   * @returns
   */
  public getAll() {
    return this.questionAnswerRepository.getAll()
  }

  /**
   *
   * @param query
   * @returns
   */
  public async findAllByQuery(query: Partial<QuestionAnswerTags>) {
    return this.questionAnswerRepository.findByQuery(query)
  }
}
