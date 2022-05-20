import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { ConnectionRecord } from '../../connections'
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
import { CashAcceptedMessage, RequestMessage } from '../messages'
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
        // @ts-ignore
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
   * @param witnessConnection Connection to witness
   * @param amount Amount to pay
   * @param giver DID of giver
   * @param witness DID of witness
   * @returns Value Transfer record and Payment Request Message
   */
  public async createRequest(
    connectionId: string,
    amount: number,
    giver: string,
    witness?: string,
    usePublicDid = true
  ): Promise<{
    record: ValueTransferRecord
    message: RequestMessage
    forward: {
      witnessConnection: ConnectionRecord
    }
  }> {
    // Get witness connection record
    const witnessConnection = await this.connectionService.findById(connectionId)
    if (!witnessConnection) {
      throw new AriesFrameworkError(`Connection not found for ID: ${connectionId}`)
    }

    // Get permanent public DID from the storage or generate a new one
    const getter = usePublicDid
      ? (await this.valueTransferStateService.getState()).publicDid
      : (await this.didService.createDID(DidType.PeerDid)).id

    // Call VTP package to create payment request
    const { error, message } = await this.valueTransfer.getter().createRequest(getter, amount, witness, giver)
    if (error || !message) {
      throw new AriesFrameworkError(`VTP: Failed to create Payment Request: ${error?.message}`)
    }

    const requestMessage = new RequestMessage({
      from: witnessConnection.did,
      to: witnessConnection.theirDid,
      body: message,
    })

    // Create Value Transfer record and raise event
    const record = new ValueTransferRecord({
      payment: message.payment,
      role: ValueTransferRole.Getter,
      state: ValueTransferState.RequestSent,
      threadId: requestMessage.id,
      witnessConnectionId: witnessConnection.id,
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
      forward: {
        witnessConnection,
      },
    }
  }

  /**
   * Process a received {@link RequestAcceptedMessage}.
   * For Witness:
   *    Verify correctness of message
   *    Update Value Transfer record with the information from the message.
   * For Getter:
   *   Update Value Transfer record with the information from the message.
   *
   * @param messageContext The record context containing the request message.
   * @returns Value Transfer record and Payment Request Acceptance Message
   */
  public async processRequestAcceptanceWitnessed(
    messageContext: InboundMessageContext<RequestAcceptedWitnessedMessage>
  ): Promise<{
    record: ValueTransferRecord
    message: RequestAcceptedWitnessedMessage
    forward: {
      witnessConnection: ConnectionRecord
    }
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: requestAcceptedWitnessedMessage } = messageContext

    if (!requestAcceptedWitnessedMessage.thid) {
      throw new AriesFrameworkError(`Thread id not found in the Payment Request Acceptance message.`)
    }
    const record = await this.valueTransferRepository.getByThread(requestAcceptedWitnessedMessage.thid)

    record.assertRole(ValueTransferRole.Getter)
    record.assertState(ValueTransferState.RequestSent)

    if (!record.witnessConnectionId) {
      throw new AriesFrameworkError(`Connection to Witness not found`)
    }
    const witnessConnection = await this.connectionService.getById(record.witnessConnectionId)

    const previousState = record.state

    // Update Value Transfer record and raise event
    record.payment = requestAcceptedWitnessedMessage.body.payment
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
      forward: {
        witnessConnection,
      },
    }
  }

  /**
   * Accept received {@link RequestAcceptedMessage} as Getter by adding cash and sending a cash accepted message.
   * @param   witnessConnection Connection to Witness.
   * @param record Value Transfer record containing Payment Request Acceptance to handle.
   * @returns Value Transfer record and Cash Accepted Message
   */
  public async acceptCash(
    witnessConnection: ConnectionRecord,
    record: ValueTransferRecord
  ): Promise<{
    record: ValueTransferRecord
    message: CashAcceptedMessage
    forward: {
      witnessConnection: ConnectionRecord
    }
  }> {
    // Verify that we are in appropriate state to perform action
    record.assertRole(ValueTransferRole.Getter)
    record.assertState(ValueTransferState.RequestAcceptanceReceived)

    const requestAcceptedWitnessedMessage = record.requestAcceptedWitnessedMessage
    if (!requestAcceptedWitnessedMessage) {
      throw new AriesFrameworkError(`Request Acceptance not found for Value Transfer with thread id ${record.threadId}`)
    }

    const previousState = record.state

    // Call VTP to accept cash
    const getter = await this.valueTransfer.getter()
    const { error, message } = await getter.acceptCash(requestAcceptedWitnessedMessage.body)
    if (error || !message) {
      throw new AriesFrameworkError(`Failed to accept Payment Request: ${error?.message}`)
    }

    const cashAcceptedMessage = new CashAcceptedMessage({
      from: witnessConnection.did,
      to: witnessConnection.theirDid,
      body: message,
      thid: record.threadId,
    })

    // Update Value Transfer record and raise event
    record.cashAcceptedMessage = cashAcceptedMessage
    record.state = ValueTransferState.CashAcceptanceSent

    await this.valueTransferRepository.update(record)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record, previousState },
    })

    return {
      record,
      message: cashAcceptedMessage,
      forward: {
        witnessConnection,
      },
    }
  }

  /**
   * Process a received {@link GiverReceiptMessage} and finish Value Transfer.
   * Update Value Transfer record with the information from the message.
   *
   * @param messageContext The record context containing the message.
   * @returns Value Transfer record and Payment Receipt Message
   */
  public async processReceipt(messageContext: InboundMessageContext<GetterReceiptMessage>): Promise<{
    record: ValueTransferRecord
    message: GetterReceiptMessage
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: getterReceiptMessage } = messageContext
    if (!getterReceiptMessage.thid) {
      throw new AriesFrameworkError(`Thread id not found in the Receipt message.`)
    }
    const record = await this.valueTransferRepository.getByThread(getterReceiptMessage.thid)

    record.assertState(ValueTransferState.CashAcceptanceSent)
    record.assertRole(ValueTransferRole.Getter)

    const previousState = record.state

    // Call VTP to process Receipt
    const { error, message } = await this.valueTransfer.getter().processReceipt(getterReceiptMessage.body)
    if (error || !message) {
      throw new AriesFrameworkError(`Getter: Failed to store Receipt: ${error?.message}`)
    }

    // Update Value Transfer record and raise event
    getterReceiptMessage.body = message
    record.getterReceiptMessage = getterReceiptMessage
    record.state = ValueTransferState.Completed

    await this.valueTransferRepository.update(record)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record, previousState },
    })

    return { record, message: getterReceiptMessage }
  }
}
