import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { ValueTransferStateChangedEvent } from '../ValueTransferEvents'
import type { RequestAcceptedWitnessedMessage, GetterReceiptMessage } from '../messages'

import { ValueTransfer, verifiableNoteProofConfig } from '@sicpa-dlab/value-transfer-protocol-ts'
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
import { ValueTransferService } from './ValueTransferService'
import { ValueTransferStateService } from './ValueTransferStateService'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferGetterService {
  private valueTransfer: ValueTransfer
  private valueTransferRepository: ValueTransferRepository
  private valueTransferStateRepository: ValueTransferStateRepository
  private valueTransferService: ValueTransferService
  private valueTransferCryptoService: ValueTransferCryptoService
  private valueTransferStateService: ValueTransferStateService
  private connectionService: ConnectionService
  private didService: DidService
  private eventEmitter: EventEmitter

  public constructor(
    valueTransferRepository: ValueTransferRepository,
    valueTransferStateRepository: ValueTransferStateRepository,
    valueTransferService: ValueTransferService,
    valueTransferCryptoService: ValueTransferCryptoService,
    valueTransferStateService: ValueTransferStateService,
    didService: DidService,
    connectionService: ConnectionService,
    eventEmitter: EventEmitter
  ) {
    this.valueTransferRepository = valueTransferRepository
    this.valueTransferStateRepository = valueTransferStateRepository
    this.valueTransferService = valueTransferService
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
   * @param amount Amount to pay
   * @param witness (Optional) DID of witness if it's known in advance
   * @param giver (Optional) DID of giver if it's known in advance
   * @param usePublicDid (Optional) Whether to use public DID of Getter in the request or create a new random one (True by default)
   * @returns
   *    * Value Transfer record
   *    * Payment Request Message
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
      role: ValueTransferRole.Getter,
      state: ValueTransferState.RequestSent,
      threadId: requestMessage.id,
      valueTransferMessage: message,
      requestMessage,
      getter: getter,
      witness: witness,
      giver: giver,
    })

    await this.valueTransferRepository.save(record)
    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record },
    })
    return { record, message: requestMessage }
  }

  /**
   * Process a received {@link RequestAcceptedWitnessedMessage}.
   * Update Value Transfer record with the information from the received message.
   *
   * @param messageContext The received message context.
   * @returns
   *    * Value Transfer record
   *    * Witnessed Request Accepted Message
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

    // Update Value Transfer record and raise event
    record.valueTransferMessage = requestAcceptedWitnessedMessage.body
    record.witnessDid = requestAcceptedWitnessedMessage.body.payment.witness
    record.giverDid = requestAcceptedWitnessedMessage.body.payment.giver

    await this.valueTransferService.updateState(record, ValueTransferState.RequestAcceptanceReceived)
    return { record, message: requestAcceptedWitnessedMessage }
  }

  /**
   * Accept received {@link RequestAcceptedWitnessedMessage} as Getter by adding cash into the wallet uncommitted state and
   *  sending a cash accepted message to Witness.
   *
   * @param record Value Transfer record containing Payment Request Acceptance to handle.
   * @returns
   *    * Value Transfer record
   *    * Cash Accepted Message
   */
  public async acceptCash(record: ValueTransferRecord): Promise<{
    record: ValueTransferRecord
    message: CashAcceptedMessage | ProblemReportMessage
  }> {
    // Verify that we are in appropriate state to perform action
    record.assertRole(ValueTransferRole.Getter)
    record.assertState(ValueTransferState.RequestAcceptanceReceived)

    // Call VTP to accept cash
    const { error, message } = await this.valueTransfer.getter().acceptCash(record.valueTransferMessage)
    if (error || !message) {
      // VTP message verification failed
      const problemReportMessage = new ProblemReportMessage({
        from: record.getterDid,
        to: record.witnessDid,
        pthid: record.threadId,
        body: {
          code: error?.code || 'invalid-request-acceptance',
          comment: `Request Acceptance verification failed. Error: ${error}`,
        },
      })

      // Update Value Transfer record
      record.problemReportMessage = problemReportMessage
      await this.valueTransferService.updateState(record, ValueTransferState.Failed)
      return {
        record,
        message: problemReportMessage,
      }
    }

    // VTP message verification succeed
    const cashAcceptedMessage = new CashAcceptedMessage({
      from: record.getterDid,
      to: record.witnessDid,
      body: message,
      thid: record.threadId,
    })

    // Update Value Transfer record
    record.valueTransferMessage = message

    await this.valueTransferService.updateState(record, ValueTransferState.CashAcceptanceSent)
    return { record, message: cashAcceptedMessage }
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
    message: GetterReceiptMessage | ProblemReportMessage
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: getterReceiptMessage } = messageContext

    const record = await this.valueTransferRepository.getByThread(getterReceiptMessage.thid)

    record.assertState(ValueTransferState.CashAcceptanceSent)
    record.assertRole(ValueTransferRole.Getter)

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

      await this.valueTransferService.updateState(record, ValueTransferState.Failed)
      return { record, message: problemReportMessage }
    }

    // VTP message verification succeed
    record.valueTransferMessage = message
    record.receipt = message

    await this.valueTransferService.updateState(record, ValueTransferState.Completed)
    return { record, message: getterReceiptMessage }
  }
}
