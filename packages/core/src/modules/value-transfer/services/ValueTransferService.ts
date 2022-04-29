import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { ValueTransferConfig } from '../../../types'
import type { ValueTransferStateChangedEvent } from '../ValueTransferEvents'
import type { RejectMessage } from '../messages/RejectMessage'
import type { ValueTransferTags } from '../repository'

import { ValueTransfer, verifiableNoteProofConfig } from '@value-transfer/value-transfer-lib'
import { inject, Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { AriesFrameworkError } from '../../../error'
import { Wallet } from '../../../wallet'
import { DidDoc } from '../../connections/models/did/DidDoc'
import { ConnectionService } from '../../connections/services/ConnectionService'
import { DidResolverService, DidType } from '../../dids'
import { DidService } from '../../dids/services/DidService'
import { ValueTransferEventTypes } from '../ValueTransferEvents'
import { ValueTransferRole } from '../ValueTransferRole'
import { ValueTransferState } from '../ValueTransferState'
import {
  CashAcceptedMessage,
  CashRemovedMessage,
  ReceiptMessage,
  RequestAcceptedMessage,
  RequestMessage,
} from '../messages'
import { ValueTransferRecord, ValueTransferRepository } from '../repository'
import { ValueTransferStateRecord } from '../repository/ValueTransferStateRecord'
import { ValueTransferStateRepository } from '../repository/ValueTransferStateRepository'
import { WitnessStateRecord } from '../repository/WitnessStateRecord'
import { WitnessStateRepository } from '../repository/WitnessStateRepository'

import { ValueTransferCryptoService } from './ValueTransferCryptoService'
import { ValueTransferStateService } from './ValueTransferStateService'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferService {
  private wallet: Wallet
  private config: AgentConfig
  private valueTransfer: ValueTransfer
  private valueTransferRepository: ValueTransferRepository
  private valueTransferStateRepository: ValueTransferStateRepository
  private valueTransferCryptoService: ValueTransferCryptoService
  private valueTransferStateService: ValueTransferStateService
  private witnessStateRepository: WitnessStateRepository
  private didService: DidService
  private didResolverService: DidResolverService
  private connectionService: ConnectionService
  private eventEmitter: EventEmitter

  public constructor(
    @inject(InjectionSymbols.Wallet) wallet: Wallet,
    config: AgentConfig,
    valueTransferRepository: ValueTransferRepository,
    valueTransferStateRepository: ValueTransferStateRepository,
    valueTransferCryptoService: ValueTransferCryptoService,
    valueTransferStateService: ValueTransferStateService,
    witnessStateRepository: WitnessStateRepository,
    didService: DidService,
    didResolverService: DidResolverService,
    connectionService: ConnectionService,
    eventEmitter: EventEmitter
  ) {
    this.wallet = wallet
    this.config = config
    this.valueTransferRepository = valueTransferRepository
    this.valueTransferStateRepository = valueTransferStateRepository
    this.valueTransferCryptoService = valueTransferCryptoService
    this.valueTransferStateService = valueTransferStateService
    this.witnessStateRepository = witnessStateRepository
    this.didService = didService
    this.didResolverService = didResolverService
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

  public async initState(config: ValueTransferConfig) {
    if (config.role === ValueTransferRole.Witness) {
      const state = await this.witnessStateRepository.findSingleByQuery({})
      if (state) return

      const publicDid = await this.didService.createDID(config.didType, config.keyType, config.seed)
      const record = new WitnessStateRecord({
        publicDid: publicDid.id,
        stateAccumulator: '',
      })
      await this.witnessStateRepository.save(record)
    }
    if (config.role === ValueTransferRole.Getter || ValueTransferRole.Giver) {
      const state = await this.valueTransferStateRepository.findSingleByQuery({})
      if (state) return

      const publicDid = await this.didService.createDID(config.didType, config.keyType, config.seed)

      const record = new ValueTransferStateRecord({
        previousHash: '',
        verifiableNotes: [],
        publicDid: publicDid.id,
      })
      await this.valueTransferStateRepository.save(record)

      if (config.verifiableNotes) {
        await this.valueTransfer.giver().addCash(config.verifiableNotes)
      }
    }
  }

  /**
   * Initiate a new value transfer exchange as Getter by sending a payment request message
   * to the known Witness which transfers record later to Giver.
   *
   * @param connectionId Id of connection to use for sending messages
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
    usePublicDid = false
  ): Promise<{ record: ValueTransferRecord; message: RequestMessage }> {
    // Get permanent public DID from the storage or generate a new one
    const getter = usePublicDid
      ? (await this.valueTransferStateRepository.getSingleByQuery({})).publicDid
      : (await this.didService.createDID(DidType.KeyDid)).id

    // Get witness DID from the connection record
    const witnessConnection = await this.connectionService.findById(connectionId)
    if (!witnessConnection) {
      throw new AriesFrameworkError(`Connection not found for ID: ${connectionId}`)
    }

    // Call VTP package to create payment request
    const { error, message } = await this.valueTransfer
      .getter()
      .createRequest(getter, amount, witnessConnection.theirDid, giver)
    if (error || !message) {
      throw new AriesFrameworkError(`VTP: Failed to create Payment Request: ${error?.message}`)
    }

    const requestMessage = new RequestMessage({
      from: getter,
      to: giver,
      body: message,
    })

    // Create Value Transfer record and raise event
    const record = new ValueTransferRecord({
      payment: message.payment,
      role: ValueTransferRole.Getter,
      state: ValueTransferState.RequestSent,
      threadId: requestMessage.id,
      witnessConnectionId: connectionId,
      requestMessage,
    })

    await this.valueTransferRepository.save(record)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record },
    })

    return { record, message: requestMessage }
  }

  /**
   * Process a received {@link RequestMessage}.
   * For Witness:
   *    The original Request message will be verified and populated with Witness specific data.
   *    Value transfer record with the information from the request message will be created.
   *    The populated Request message will be forwarded to Giver afterwards.
   * For Giver:
   *    Value transfer record with the information from the request message will be created.
   *    Use {@link ValueTransferService.acceptRequest} after calling this method to accept payment request
   *
   * @param messageContext The record context containing the request message.
   * @returns Value Transfer record and Payment Request Message
   */
  public async processRequest(
    messageContext: InboundMessageContext<RequestMessage>
  ): Promise<{ record: ValueTransferRecord; message: RequestMessage }> {
    const { message: requestMessage, connection } = messageContext

    // Determine the role by checking if there is witness state object in the wallet
    const witnessState = await this.witnessStateRepository.findSingleByQuery({})
    const role: ValueTransferRole = witnessState ? ValueTransferRole.Witness : ValueTransferRole.Giver

    let connectionData = {}

    if (role === ValueTransferRole.Witness) {
      const giverConnection = await this.connectionService.findByTheirDid(requestMessage.body.payment.giver)
      if (!giverConnection) {
        throw new AriesFrameworkError(`Connection not found for Giver DID: ${requestMessage.body.payment.giver}`)
      }

      // Witness: Call VTP package to process received request
      const { error, message } = await this.valueTransfer.witness().processRequest(requestMessage.body)
      if (error || !message) {
        throw new AriesFrameworkError(`VTP: Failed to verify Payment Request: ${error?.message}`)
      }
      requestMessage.body = message
      connectionData = {
        getterConnectionId: connection?.id,
        giverConnectionId: giverConnection.id,
      }
    }
    if (role === ValueTransferRole.Giver) {
      const witnessConnection = await this.connectionService.findByMyDid(requestMessage.body.payment.giver)
      if (!witnessConnection) {
        throw new AriesFrameworkError(`Connection not found for Giver DID: ${requestMessage.body.payment.giver}`)
      }
      const { didDocument } = await this.didResolverService.resolve(requestMessage.body.payment.witness)
      if (!didDocument) {
        throw new AriesFrameworkError(`Unable to resolve DIDDoc for witness ${requestMessage.body.payment.witness}`)
      }

      witnessConnection.theirDid = requestMessage.body.payment.witness
      witnessConnection.theirDidDoc = DidDoc.convertDIDDocToConnectionDIDDoc(didDocument)
      await this.connectionService.update(witnessConnection)

      connectionData = { witnessConnectionId: connection?.id }
    }

    // Create Value Transfer record and raise event
    const record = new ValueTransferRecord({
      payment: requestMessage.body.payment,
      role,
      state: role === ValueTransferRole.Witness ? ValueTransferState.RequestSent : ValueTransferState.RequestReceived,
      threadId: requestMessage.id,
      requestMessage,
      ...connectionData,
    })

    await this.valueTransferRepository.save(record)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record },
    })

    return { record, message: requestMessage }
  }

  /**
   * Accept received {@link RequestMessage} as Giver by sending a payment request acceptance message.
   * @param record Value Transfer record containing Payment Request to accept.
   * @returns Value Transfer record and Payment Request Acceptance Message
   */
  public async acceptRequest(
    record: ValueTransferRecord
  ): Promise<{ record: ValueTransferRecord; message: RequestAcceptedMessage }> {
    // Verify that we are in appropriate state to perform action
    record.assertRole(ValueTransferRole.Giver)
    record.assertState(ValueTransferState.RequestReceived)

    const requestMessage = record.requestMessage
    if (!requestMessage) {
      throw new AriesFrameworkError(`Payment Request not found for Value Transfer with thread id ${record.threadId}`)
    }
    const previousState = record.state

    // Create a new DID
    const { id: did } = await this.didService.createDID(DidType.KeyDid)

    // Call VTP to accept payment request
    const giver = await this.valueTransfer.giver()
    const notesToSpend = await giver.pickNotesToSpend(requestMessage.body.payment.amount) // TODO: probably we need to create a separate method for selecting notes
    const { error, message } = await giver.acceptPaymentRequest(did, requestMessage.body, notesToSpend)
    if (error || !message) {
      throw new AriesFrameworkError(`VTP: Failed to accept Payment Request: ${error?.message}`)
    }

    const requestAcceptedMessage = new RequestAcceptedMessage({
      from: did,
      to: message.payment.getter,
      body: message,
      thid: requestMessage.id,
    })

    // Update Value Transfer record and raise event
    record.payment = requestAcceptedMessage.body.payment
    record.requestAcceptedMessage = requestAcceptedMessage
    record.state = ValueTransferState.RequestAcceptanceSent

    await this.valueTransferRepository.update(record)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record: record, previousState },
    })

    return { record, message: requestAcceptedMessage }
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
  public async processRequestAcceptance(
    messageContext: InboundMessageContext<RequestAcceptedMessage>
  ): Promise<{ record: ValueTransferRecord; message: RequestAcceptedMessage }> {
    // Verify that we are in appropriate state to perform action
    const { message: requestAcceptedMessage } = messageContext

    if (!requestAcceptedMessage.thid) {
      throw new AriesFrameworkError(`Thread id not found in the Payment Request Acceptance message.`)
    }
    const record = await this.getByThread(requestAcceptedMessage.thid)

    record.assertRole([ValueTransferRole.Witness, ValueTransferRole.Getter])
    record.assertState(ValueTransferState.RequestSent)

    const previousState = record.state

    if (record.role === ValueTransferRole.Witness) {
      // Witness: Call VTP package to process received request acceptance
      const { error, message } = await this.valueTransfer.witness().processRequestAccepted(requestAcceptedMessage.body)
      if (error || !message) {
        throw new AriesFrameworkError(`Witness: Failed to verify Payment Request: ${error?.message}`)
      }
    }
    if (record.role === ValueTransferRole.Getter) {
      // Getter: nothing to do
    }

    // Update Value Transfer record and raise event
    record.payment = requestAcceptedMessage.body.payment
    record.requestAcceptedMessage = requestAcceptedMessage
    record.state =
      record.role === ValueTransferRole.Witness
        ? ValueTransferState.RequestAcceptanceSent
        : ValueTransferState.RequestAcceptanceReceived

    await this.valueTransferRepository.update(record)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record, previousState },
    })

    return { record, message: requestAcceptedMessage }
  }

  /**
   * Accept received {@link RequestAcceptedMessage} as Getter by adding cash and sending a cash accepted message.
   * @param record Value Transfer record containing Payment Request Acceptance to handle.
   * @returns Value Transfer record and Cash Accepted Message
   */
  public async acceptCash(
    record: ValueTransferRecord
  ): Promise<{ record: ValueTransferRecord; message: CashAcceptedMessage }> {
    // Verify that we are in appropriate state to perform action
    record.assertRole(ValueTransferRole.Getter)
    record.assertState(ValueTransferState.RequestAcceptanceReceived)

    const requestMessage = record.requestMessage
    const requestAcceptedMessage = record.requestAcceptedMessage
    if (!requestAcceptedMessage || !requestMessage) {
      throw new AriesFrameworkError(`Request Acceptance not found for Value Transfer with thread id ${record.threadId}`)
    }

    const previousState = record.state

    // Call VTP to accept cash
    const giver = await this.valueTransfer.getter()
    const { error, message } = await giver.acceptCash(requestMessage.body, requestAcceptedMessage.body)
    if (error || !message) {
      throw new AriesFrameworkError(`Failed to accept Payment Request: ${error?.message}`)
    }

    const cashAcceptedMessage = new CashAcceptedMessage({
      from: message.payment.getter,
      to: message.payment.giver,
      body: message,
      thid: requestAcceptedMessage.thid,
    })

    // Update Value Transfer record and raise event
    record.cashAcceptedMessage = cashAcceptedMessage
    record.state = ValueTransferState.CashAcceptanceSent

    await this.valueTransferRepository.update(record)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record, previousState },
    })

    return { record, message: cashAcceptedMessage }
  }

  /**
   * Process a received {@link CashAcceptedMessage}.
   * For Witness:
   *    Verify correctness of message
   *    Update Value Transfer record with the information from the message.
   * For Giver:
   *   Update Value Transfer record with the information from the message.
   *
   * @param messageContext The record context containing the message.
   * @returns Value Transfer record and Payment Cash Accepted Message
   */
  public async processCashAcceptance(
    messageContext: InboundMessageContext<CashAcceptedMessage>
  ): Promise<{ record: ValueTransferRecord; message: CashAcceptedMessage }> {
    // Verify that we are in appropriate state to perform action
    const { message: cashAcceptedMessage } = messageContext
    if (!cashAcceptedMessage.thid) {
      throw new AriesFrameworkError(`Thread id not found in the Cash Accepted message.`)
    }
    const record = await this.getByThread(cashAcceptedMessage.thid)

    record.assertRole([ValueTransferRole.Witness, ValueTransferRole.Giver])
    record.assertState(ValueTransferState.RequestAcceptanceSent)

    const previousState = record.state

    if (record.role === ValueTransferRole.Witness) {
      // Witness: Call VTP package to process received cash acceptance
      const { error, message } = await this.valueTransfer.witness().processCashAccepted(cashAcceptedMessage.body)
      if (error || !message) {
        throw new AriesFrameworkError(`Witness: Failed to verify Payment Request: ${error?.message}`)
      }
    }
    if (record.role === ValueTransferRole.Giver) {
      // Giver: nothing to do
    }

    // Update Value Transfer record and raise event
    record.cashAcceptedMessage = cashAcceptedMessage
    record.state =
      record.role === ValueTransferRole.Witness
        ? ValueTransferState.CashAcceptanceSent
        : ValueTransferState.CashAcceptanceReceived

    await this.valueTransferRepository.update(record)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record, previousState },
    })

    return { record, message: cashAcceptedMessage }
  }

  /**
   * Remove cash as Giver from the Wallet.
   * @param record Value Transfer record containing Cash Acceptance message to handle.
   * @returns Value Transfer record and Cash Removed Message
   */
  public async removeCash(
    record: ValueTransferRecord
  ): Promise<{ record: ValueTransferRecord; message: CashRemovedMessage }> {
    // Verify that we are in appropriate state to perform action
    record.assertRole(ValueTransferRole.Giver)
    record.assertState(ValueTransferState.CashAcceptanceReceived)

    const requestAcceptedMessage = record.requestAcceptedMessage
    const cashAcceptedMessage = record.cashAcceptedMessage
    if (!requestAcceptedMessage || !cashAcceptedMessage) {
      throw new AriesFrameworkError(`Cash Acceptance not found for Value Transfer with thread id ${record.threadId}`)
    }

    const previousState = record.state

    // Call VTP package to remove cash
    const giver = await this.valueTransfer.giver()
    const { error, message } = await giver.removeCash(requestAcceptedMessage.body, cashAcceptedMessage.body)
    if (error || !message) {
      throw new AriesFrameworkError(`Failed to accept Payment Request: ${error?.message}`)
    }

    const cashRemovedMessage = new CashRemovedMessage({
      from: message.payment.giver,
      to: message.payment.getter,
      body: message,
      thid: requestAcceptedMessage.thid,
    })

    // Update Value Transfer record and raise event
    record.cashRemovedMessage = cashRemovedMessage
    record.state = ValueTransferState.CashRemovalSent

    await this.valueTransferRepository.update(record)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record, previousState },
    })

    return { record, message: cashRemovedMessage }
  }

  /**
   * Process a received {@link CashRemovedMessage}.
   * For Witness:
   *    Verify correctness of message
   *    Update Value Transfer record with the information from the message.
   *
   * @param messageContext The record context containing the message.
   * @returns Value Transfer record and Payment Cash Removed Message
   */
  public async processCashRemoved(
    messageContext: InboundMessageContext<CashRemovedMessage>
  ): Promise<{ record: ValueTransferRecord; message: CashRemovedMessage }> {
    // Verify that we are in appropriate state to perform action
    const { message: cashRemovedMessage } = messageContext
    if (!cashRemovedMessage.thid) {
      throw new AriesFrameworkError(`Thread id not found in the Cash Removed message.`)
    }

    const record = await this.getByThread(cashRemovedMessage.thid)
    record.assertState(ValueTransferState.CashAcceptanceSent)
    record.assertRole(ValueTransferRole.Witness)

    const previousState = record.state

    // Call VTP package to process received cash removal
    const { error, message } = await this.valueTransfer.witness().processCashRemoved(cashRemovedMessage.body)
    if (error || !message) {
      throw new AriesFrameworkError(`Witness: Failed to verify Payment Request: ${error?.message}`)
    }

    // Update Value Transfer record and raise event
    record.cashRemovedMessage = cashRemovedMessage
    record.state = ValueTransferState.CashRemovalReceived

    await this.valueTransferRepository.update(record)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record, previousState },
    })

    return { record, message: cashRemovedMessage }
  }

  /**
   * Finish Value Transfer as Witness and create Payment Receipt
   * @param record Value Transfer record containing Cash Removal message to handle.
   * @returns Value Transfer record and Receipt Message
   */
  public async createReceipt(
    record: ValueTransferRecord
  ): Promise<{ record: ValueTransferRecord; message: ReceiptMessage }> {
    // Verify that we are in appropriate state to perform action
    record.assertState(ValueTransferState.CashRemovalReceived)
    record.assertRole(ValueTransferRole.Witness)

    if (!record.requestAcceptedMessage || !record.cashAcceptedMessage || !record.cashRemovedMessage) {
      throw new AriesFrameworkError(`Cash Removal not found for Value Transfer with thread id ${record.threadId}`)
    }

    const previousState = record.state

    // Call VTP package to create receipt
    const { error, message } = await this.valueTransfer
      .witness()
      .createReceipt(
        record.requestAcceptedMessage.body,
        record.cashAcceptedMessage.body,
        record.cashRemovedMessage.body
      )
    if (error || !message) {
      throw new AriesFrameworkError(`Witness: Failed to create Payment Receipt: ${error?.message}`)
    }

    const receiptMessage = new ReceiptMessage({
      from: message.payment.giver,
      to: message.payment.getter,
      body: message,
      thid: record.cashRemovedMessage.thid,
    })

    // Update Value Transfer record and raise event
    record.receiptMessage = receiptMessage
    record.state = ValueTransferState.ReceiptSent

    await this.valueTransferRepository.update(record)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record, previousState },
    })

    return { record, message: receiptMessage }
  }

  /**
   * Process a received {@link ReceiptMessage} and finish Value Transfer.
   * Update Value Transfer record with the information from the message.
   *
   * @param messageContext The record context containing the message.
   * @returns Value Transfer record and Payment Receipt Message
   */
  public async processReceipt(
    messageContext: InboundMessageContext<ReceiptMessage>
  ): Promise<{ record: ValueTransferRecord; message: ReceiptMessage }> {
    // Verify that we are in appropriate state to perform action
    const { message: receipt } = messageContext
    if (!receipt.thid) {
      throw new AriesFrameworkError(`Thread id not found in the Receipt message.`)
    }
    const record = await this.getByThread(receipt.thid)
    record.assertState([ValueTransferState.CashAcceptanceSent, ValueTransferState.CashRemovalSent])
    record.assertRole([ValueTransferRole.Giver, ValueTransferRole.Getter])
    if (!record.cashAcceptedMessage || !record.requestAcceptedMessage) {
      throw new AriesFrameworkError(`Cash Acceptance not found for Value Transfer with thread id ${record.threadId}`)
    }

    const previousState = record.state

    // Call VTP to process Receipt
    if (record.role === ValueTransferRole.Getter) {
      const { error, message } = await this.valueTransfer
        .getter()
        .storeReceipt(record.cashAcceptedMessage.body, receipt.body)
      if (error || !message) {
        throw new AriesFrameworkError(`Getter: Failed to store Receipt: ${error?.message}`)
      }
    }

    if (record.role === ValueTransferRole.Giver) {
      const { error, message } = await this.valueTransfer
        .giver()
        .storeReceipt(record.requestAcceptedMessage.body, receipt.body)
      if (error || !message) {
        throw new AriesFrameworkError(`Giver: Failed to store Receipt: ${error?.message}`)
      }
    }

    // Update Value Transfer record and raise event
    record.receiptMessage = receipt
    record.state = ValueTransferState.Completed

    await this.valueTransferRepository.update(record)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record, previousState },
    })

    return { record, message: receipt }
  }

  /**
   * Process a received {@link RejectMessage} and cancel Value Transfer.
   * Update Value Transfer record with the information from the message.
   *
   * @param messageContext The record context containing the message.
   * @returns Value Transfer record and Reject Message
   */
  public async processReject(
    messageContext: InboundMessageContext<RejectMessage>
  ): Promise<{ record: ValueTransferRecord; message: RejectMessage }> {
    const { message: requestMessage } = messageContext
    if (!requestMessage.thid) {
      throw new AriesFrameworkError(`Thread id not found in the Reject message.`)
    }
    const record = await this.getByThread(requestMessage.thid)

    const previousState = record.state

    // Update Value Transfer record and raise event
    record.rejectMessage = requestMessage
    record.state = ValueTransferState.Failed

    await this.valueTransferRepository.update(record)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record, previousState },
    })

    return { record, message: requestMessage }
  }

  public async getByThread(threadId: string): Promise<ValueTransferRecord> {
    return this.valueTransferRepository.getSingleByQuery({ threadId })
  }

  public getAll(): Promise<ValueTransferRecord[]> {
    return this.valueTransferRepository.getAll()
  }

  public getById(recordId: string): Promise<ValueTransferRecord> {
    return this.valueTransferRepository.getById(recordId)
  }

  public async findAllByQuery(query: Partial<ValueTransferTags>) {
    return this.valueTransferRepository.findByQuery(query)
  }

  public async update(record: ValueTransferRecord): Promise<void> {
    return this.valueTransferRepository.update(record)
  }
}
