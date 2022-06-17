import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { ValueTransferStateChangedEvent } from '../ValueTransferEvents'
import type { GetterReceiptMessage, RequestAcceptedWitnessedMessage } from '../messages'
import type { Getter } from '@sicpa-dlab/value-transfer-protocol-ts'

import { TaggedPrice, ValueTransfer } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Lifecycle, scoped } from 'tsyringe'

import { EventEmitter } from '../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../error'
import { ConnectionService } from '../../connections'
import { DidType } from '../../dids'
import { DidService } from '../../dids/services/DidService'
import { DidInfo, WellKnownService } from '../../well-known'
import { ValueTransferEventTypes } from '../ValueTransferEvents'
import { ValueTransferRole } from '../ValueTransferRole'
import { ValueTransferState } from '../ValueTransferState'
import { CashAcceptedMessage, ProblemReportMessage, RequestMessage } from '../messages'
import { ValueTransferBaseMessage } from '../messages/ValueTransferBaseMessage'
import { ValueTransferRecord, ValueTransferTransactionStatus, ValueTransferRepository } from '../repository'
import { ValueTransferStateRepository } from '../repository/ValueTransferStateRepository'

import { ValueTransferCryptoService } from './ValueTransferCryptoService'
import { ValueTransferService } from './ValueTransferService'
import { ValueTransferStateService } from './ValueTransferStateService'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferGetterService {
  private valueTransferRepository: ValueTransferRepository
  private valueTransferStateRepository: ValueTransferStateRepository
  private valueTransferService: ValueTransferService
  private valueTransferCryptoService: ValueTransferCryptoService
  private valueTransferStateService: ValueTransferStateService
  private connectionService: ConnectionService
  private didService: DidService
  private wellKnownService: WellKnownService
  private eventEmitter: EventEmitter
  private getter: Getter

  public constructor(
    valueTransferRepository: ValueTransferRepository,
    valueTransferStateRepository: ValueTransferStateRepository,
    valueTransferService: ValueTransferService,
    valueTransferCryptoService: ValueTransferCryptoService,
    valueTransferStateService: ValueTransferStateService,
    didService: DidService,
    wellKnownService: WellKnownService,
    connectionService: ConnectionService,
    eventEmitter: EventEmitter
  ) {
    this.valueTransferRepository = valueTransferRepository
    this.valueTransferStateRepository = valueTransferStateRepository
    this.valueTransferService = valueTransferService
    this.valueTransferCryptoService = valueTransferCryptoService
    this.valueTransferStateService = valueTransferStateService
    this.didService = didService
    this.wellKnownService = wellKnownService
    this.connectionService = connectionService
    this.eventEmitter = eventEmitter

    this.getter = new ValueTransfer(
      {
        crypto: this.valueTransferCryptoService,
        storage: this.valueTransferStateService,
      },
      {}
    ).getter()
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
    const state = await this.valueTransferStateRepository.getState()
    const getter =
      usePublicDid && state.publicDid ? state.publicDid : (await this.didService.createDID(DidType.PeerDid)).id

    // Call VTP package to create payment request
    const givenTotal = new TaggedPrice({ amount })
    const { error, message } = await this.getter.createRequest({
      getterId: getter,
      witnessId: witness,
      giverId: giver,
      givenTotal,
    })
    if (error || !message) {
      throw new AriesFrameworkError(`VTP: Failed to create Payment Request: ${error?.message}`)
    }

    const requestMessage = new RequestMessage({
      from: getter,
      to: witness,
      attachments: [ValueTransferBaseMessage.createValueTransferJSONAttachment(message)],
    })

    const getterInfo = await this.wellKnownService.resolve(getter)
    const witnessInfo = witness ? new DidInfo({ did: witness }) : undefined
    const giverInfo = await this.wellKnownService.resolve(giver)

    // Create Value Transfer record and raise event
    const record = new ValueTransferRecord({
      role: ValueTransferRole.Getter,
      state: ValueTransferState.RequestSent,
      threadId: requestMessage.id,
      valueTransferMessage: message,
      getter: getterInfo,
      witness: witnessInfo,
      giver: giverInfo,
      status: ValueTransferTransactionStatus.Pending,
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
    message: CashAcceptedMessage | ProblemReportMessage
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: requestAcceptedWitnessedMessage } = messageContext

    const record = await this.valueTransferRepository.getByThread(requestAcceptedWitnessedMessage.thid)

    record.assertRole(ValueTransferRole.Getter)
    record.assertState(ValueTransferState.RequestSent)

    const valueTransferDelta = requestAcceptedWitnessedMessage.valueTransferDelta
    if (!valueTransferDelta) {
      const problemReport = new ProblemReportMessage({
        from: record.getter?.did,
        to: requestAcceptedWitnessedMessage.from,
        pthid: record.threadId,
        body: {
          code: 'e.p.req.bad-request',
          comment: `Missing required base64 or json encoded attachment data for payment request with thread id ${requestAcceptedWitnessedMessage.thid}`,
        },
      })
      return { record, message: problemReport }
    }

    // Call VTP to accept cash
    const { error, message, delta } = await this.getter.acceptCash(record.valueTransferMessage, valueTransferDelta)
    if (error || !message || !delta) {
      // VTP message verification failed
      const problemReportMessage = new ProblemReportMessage({
        from: record.getter?.did,
        to: record.witness?.did,
        pthid: record.threadId,
        body: {
          code: error?.code || 'invalid-request-acceptance',
          comment: `Request Acceptance verification failed. Error: ${error}`,
        },
      })

      // Update Value Transfer record
      record.problemReportMessage = problemReportMessage
      await this.valueTransferService.updateState(
        record,
        ValueTransferState.Failed,
        ValueTransferTransactionStatus.Finished
      )
      return {
        record,
        message: problemReportMessage,
      }
    }

    // VTP message verification succeed
    const cashAcceptedMessage = new CashAcceptedMessage({
      from: record.getter?.did,
      to: record.witness?.did,
      thid: record.threadId,
      attachments: [ValueTransferBaseMessage.createValueTransferJSONAttachment(delta)],
    })

    // Update Value Transfer record
    // Update Value Transfer record and raise event

    const witnessInfo = record.witness?.did ? record.witness : new DidInfo({ did: message.witnessId })
    const giverInfo = record.giver?.did ? record.giver : await this.wellKnownService.resolve(message.giverId)

    record.valueTransferMessage = message
    record.witness = witnessInfo
    record.giver = giverInfo

    await this.valueTransferService.updateState(
      record,
      ValueTransferState.CashAcceptanceSent,
      ValueTransferTransactionStatus.InProgress
    )
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

    await this.valueTransferService.updateState(
      record,
      ValueTransferState.ReceiptReceived,
      ValueTransferTransactionStatus.InProgress
    )

    const valueTransferDelta = getterReceiptMessage.valueTransferDelta
    if (!valueTransferDelta) {
      const problemReport = new ProblemReportMessage({
        pthid: record.threadId,
        body: {
          code: 'e.p.req.bad-receipt',
          comment: `Missing required base64 or json encoded attachment data for receipt with thread id ${record.threadId}`,
        },
      })
      return { record, message: problemReport }
    }

    // Call VTP to process Receipt
    const { error, message } = await this.getter.processReceipt(record.valueTransferMessage, valueTransferDelta)
    if (error || !message) {
      // VTP message verification failed
      const problemReportMessage = new ProblemReportMessage({
        pthid: getterReceiptMessage.thid,
        body: {
          code: error?.code || 'invalid-payment-receipt',
          comment: `Receipt verification failed. Error: ${error}`,
        },
      })

      await this.getter.abortTransaction()
      record.problemReportMessage = problemReportMessage

      await this.valueTransferService.updateState(
        record,
        ValueTransferState.Failed,
        ValueTransferTransactionStatus.Finished
      )
      return { record, message: problemReportMessage }
    }

    // VTP message verification succeed
    record.valueTransferMessage = message
    record.receipt = message

    await this.valueTransferService.updateState(
      record,
      ValueTransferState.Completed,
      ValueTransferTransactionStatus.Finished
    )
    return { record, message: getterReceiptMessage }
  }
}
