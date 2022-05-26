import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { ValueTransferStateChangedEvent } from '../ValueTransferEvents'
import type { RequestAcceptedWitnessedMessage, GetterReceiptMessage } from '../messages'

import { ValueTransfer, verifiableNoteProofConfig } from '@value-transfer/value-transfer-lib'
import { Lifecycle, scoped } from 'tsyringe'

import { EventEmitter } from '../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../error'
import { ConnectionService } from '../../connections'
import { DidType } from '../../dids'
import { DidService } from '../../dids/services/DidService'
import { ValueTransferEventTypes } from '../ValueTransferEvents'
import { ValueTransferRole } from '../ValueTransferRole'
import { ValueTransferState } from '../ValueTransferState'
import { CashAcceptedMessage, ProblemReportMessage, RequestMessage } from '../messages'
import { ValueTransferRecord, ValueTransferRepository } from '../repository'
import { ValueTransferStateRepository } from '../repository/ValueTransferStateRepository'

import { ValueTransferCryptoService } from './ValueTransferCryptoService'
import { ValueTransferStateService } from './ValueTransferStateService'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferGetterService {
  private valueTransfer: ValueTransfer
  private valueTransferRepository: ValueTransferRepository
  private valueTransferStateRepository: ValueTransferStateRepository
  private valueTransferCryptoService: ValueTransferCryptoService
  private valueTransferStateService: ValueTransferStateService
  private connectionService: ConnectionService
  private didService: DidService
  private eventEmitter: EventEmitter

  public constructor(
    valueTransferRepository: ValueTransferRepository,
    valueTransferStateRepository: ValueTransferStateRepository,
    valueTransferCryptoService: ValueTransferCryptoService,
    valueTransferStateService: ValueTransferStateService,
    didService: DidService,
    connectionService: ConnectionService,
    eventEmitter: EventEmitter
  ) {
    this.valueTransferRepository = valueTransferRepository
    this.valueTransferStateRepository = valueTransferStateRepository
    this.valueTransferCryptoService = valueTransferCryptoService
    this.valueTransferStateService = valueTransferStateService
    this.didService = didService
    this.connectionService = connectionService
    this.eventEmitter = eventEmitter

    this.valueTransfer = new ValueTransfer(
      {
        crypto: this.valueTransferCryptoService,
        storage: this.valueTransferStateService,
      },
      {
        sparseTree: verifiableNoteProofConfig,
      }
    )
  }

  /**
   * Initiate a new value transfer exchange as Getter by sending a payment request message
   * to the known Witness which transfers record later to Giver.
   *
   * @param connectionId ID of connection to witness
   * @param amount Amount to pay
   * @param giver DID of giver
   * @param witness (Optional) DID of witness if it's known in advance
   * @param usePublicDid (Optional) Whether to use public DID of Getter in the request or create a new random one (True by default)
   * @returns
   *    * Value Transfer record
   *    * Payment Request Message
   *    * Connection Record to use for sending message
   */
  public async createRequest(
    amount: number,
    witness?: string,
    giver?: string,
    usePublicDid = true
  ): Promise<{
    record: ValueTransferRecord
    message: RequestMessage
  }> {
    // Get payment public DID from the storage or generate a new one if requested
    const state = await this.valueTransferStateService.getState()
    const getter =
      usePublicDid && state.publicDid ? state.publicDid : (await this.didService.createDID(DidType.PeerDid)).id

    // Call VTP package to create payment request
    const { error, message } = await this.valueTransfer.getter().createRequest(getter, amount, witness, giver)
    if (error || !message) {
      throw new AriesFrameworkError(`VTP: Failed to create Payment Request: ${error?.message}`)
    }

    const requestMessage = new RequestMessage({
      from: getter,
      to: witness,
      body: message,
    })

    // Create Value Transfer record and raise event
    const record = new ValueTransferRecord({
      payment: message.payment,
      role: ValueTransferRole.Getter,
      state: ValueTransferState.RequestSent,
      threadId: requestMessage.id,
      getter: getter,
      witness: witness,
      giver: giver,
      requestMessage,
    })

    await this.valueTransferRepository.save(record)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record },
    })

    return {
      record,
      message: requestMessage,
    }
  }

  /**
   * Process a received {@link RequestAcceptedWitnessedMessage}.
   * Update Value Transfer record with the information from the received message.
   *
   * @param messageContext The received message context.
   * @returns
   *    * Value Transfer record
   *    * Witnessed Request Accepted Message
   *    * Connection Record to use for sending message
   */
  public async processRequestAcceptanceWitnessed(
    messageContext: InboundMessageContext<RequestAcceptedWitnessedMessage>
  ): Promise<{
    record: ValueTransferRecord
    message: RequestAcceptedWitnessedMessage
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: requestAcceptedWitnessedMessage } = messageContext

    const record = await this.valueTransferRepository.getByThread(requestAcceptedWitnessedMessage.thid)

    record.assertRole(ValueTransferRole.Getter)
    record.assertState(ValueTransferState.RequestSent)

    const previousState = record.state

    // Update Value Transfer record and raise event
    record.payment = requestAcceptedWitnessedMessage.body.payment
    record.witnessDid = requestAcceptedWitnessedMessage.body.payment.witness
    record.giverDid = requestAcceptedWitnessedMessage.body.payment.giver
    record.requestAcceptedWitnessedMessage = requestAcceptedWitnessedMessage
    record.state = ValueTransferState.RequestAcceptanceReceived

    await this.valueTransferRepository.update(record)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record, previousState },
    })

    return {
      record,
      message: requestAcceptedWitnessedMessage,
    }
  }

  /**
   * Accept received {@link RequestAcceptedWitnessedMessage} as Getter by adding cash into the wallet uncommitted state and
   *  sending a cash accepted message to Witness.
   *
   * @param witnessConnection Connection to Witness.
   * @param record Value Transfer record containing Payment Request Acceptance to handle.
   * @returns
   *    * Value Transfer record
   *    * Cash Accepted Message
   *    * Connection Record to use for sending message
   */
  public async acceptCash(record: ValueTransferRecord): Promise<{
    record: ValueTransferRecord
    message: CashAcceptedMessage | ProblemReportMessage
  }> {
    // Verify that we are in appropriate state to perform action
    record.assertRole(ValueTransferRole.Getter)
    record.assertState(ValueTransferState.RequestAcceptanceReceived)

    const requestAcceptedWitnessedMessage = record.requestAcceptedWitnessedMessage
    if (!requestAcceptedWitnessedMessage) {
      throw new AriesFrameworkError(`Request Acceptance not found for Value Transfer with thread id ${record.threadId}`)
    }

    let resultMessage: CashAcceptedMessage | ProblemReportMessage

    const previousState = record.state

    // Call VTP to accept cash
    const { error, message } = await this.valueTransfer.getter().acceptCash(requestAcceptedWitnessedMessage.body)
    if (error || !message) {
      // VTP message verification failed
      resultMessage = new ProblemReportMessage({
        from: record.getterDid,
        to: record.witnessDid,
        pthid: requestAcceptedWitnessedMessage.thid,
        body: {
          code: error?.code || 'invalid-request-acceptance',
          comment: `Request Acceptance verification failed. Error: ${error}`,
        },
      })

      // Update Value Transfer record
      record.problemReportMessage = resultMessage
      record.state = ValueTransferState.Failed
    } else {
      // VTP message verification succeed
      resultMessage = new CashAcceptedMessage({
        from: record.getterDid,
        to: record.witnessDid,
        body: message,
        thid: record.threadId,
      })

      // Update Value Transfer record
      record.cashAcceptedMessage = resultMessage
      record.state = ValueTransferState.CashAcceptanceSent
    }

    await this.valueTransferRepository.update(record)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record, previousState },
    })

    return {
      record,
      message: resultMessage,
    }
  }

  /**
   * Process a received {@link GetterReceiptMessage} and finish Value Transfer.
   * Update Value Transfer record with the information from the message.
   *
   * @param messageContext The context of the received message.
   * @returns
   *    * Value Transfer record
   *    * Receipt Message
   */
  public async processReceipt(messageContext: InboundMessageContext<GetterReceiptMessage>): Promise<{
    record: ValueTransferRecord
    message: GetterReceiptMessage
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: getterReceiptMessage } = messageContext

    const record = await this.valueTransferRepository.getByThread(getterReceiptMessage.thid)

    record.assertState(ValueTransferState.CashAcceptanceSent)
    record.assertRole(ValueTransferRole.Getter)

    const previousState = record.state

    // Call VTP to process Receipt
    const { error, message } = await this.valueTransfer.getter().processReceipt(getterReceiptMessage.body)
    if (error || !message) {
      // VTP message verification failed
      const problemReportMessage = new ProblemReportMessage({
        pthid: getterReceiptMessage.thid,
        body: {
          code: error?.code || 'invalid-payment-receipt',
          comment: `Receipt verification failed. Error: ${error}`,
        },
      })

      record.problemReportMessage = problemReportMessage
      record.state = ValueTransferState.Failed
    } else {
      // VTP message verification succeed
      getterReceiptMessage.body = message
      record.getterReceiptMessage = getterReceiptMessage
      record.state = ValueTransferState.Completed
    }

    await this.valueTransferRepository.update(record)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record, previousState },
    })

    return { record, message: getterReceiptMessage }
  }
}
