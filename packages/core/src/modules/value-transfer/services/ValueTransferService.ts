import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { Transports } from '../../routing/types'
import type { ValueTransferStateChangedEvent } from '../ValueTransferEvents'
import type { ValueTransferRecord, ValueTransferTags } from '../repository'
import type { VerifiableNote } from '@sicpa-dlab/value-transfer-protocol-ts'

import { PartyState, TransactionRecord, ValueTransfer, Wallet } from '@sicpa-dlab/value-transfer-protocol-ts'
import { firstValueFrom, ReplaySubject } from 'rxjs'
import { first, map, timeout } from 'rxjs/operators'
import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { MessageSender } from '../../../agent/MessageSender'
import { SendingMessageType } from '../../../agent/didcomm/types'
import { AriesFrameworkError } from '../../../error'
import { DidResolverService } from '../../dids'
import { DidService } from '../../dids/services/DidService'
import { ValueTransferEventTypes } from '../ValueTransferEvents'
import { ValueTransferRole } from '../ValueTransferRole'
import { ValueTransferState } from '../ValueTransferState'
import { ProblemReportMessage } from '../messages'
import { ValueTransferRepository, ValueTransferTransactionStatus } from '../repository'
import { ValueTransferStateRecord } from '../repository/ValueTransferStateRecord'
import { ValueTransferStateRepository } from '../repository/ValueTransferStateRepository'
import { WitnessStateRepository } from '../repository/WitnessStateRepository'

import { ValueTransferCryptoService } from './ValueTransferCryptoService'
import { ValueTransferStateService } from './ValueTransferStateService'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferService {
  private config: AgentConfig
  private valueTransfer: ValueTransfer
  private valueTransferRepository: ValueTransferRepository
  private valueTransferStateRepository: ValueTransferStateRepository
  private valueTransferCryptoService: ValueTransferCryptoService
  private valueTransferStateService: ValueTransferStateService
  private witnessStateRepository: WitnessStateRepository
  private didService: DidService
  private didResolverService: DidResolverService
  private eventEmitter: EventEmitter
  private messageSender: MessageSender

  public constructor(
    config: AgentConfig,
    valueTransferRepository: ValueTransferRepository,
    valueTransferStateRepository: ValueTransferStateRepository,
    valueTransferCryptoService: ValueTransferCryptoService,
    valueTransferStateService: ValueTransferStateService,
    witnessStateRepository: WitnessStateRepository,
    didService: DidService,
    didResolverService: DidResolverService,
    eventEmitter: EventEmitter,
    messageSender: MessageSender
  ) {
    this.config = config
    this.valueTransferRepository = valueTransferRepository
    this.valueTransferStateRepository = valueTransferStateRepository
    this.valueTransferCryptoService = valueTransferCryptoService
    this.valueTransferStateService = valueTransferStateService
    this.witnessStateRepository = witnessStateRepository
    this.didService = didService
    this.didResolverService = didResolverService
    this.eventEmitter = eventEmitter
    this.messageSender = messageSender

    this.valueTransfer = new ValueTransfer(
      {
        crypto: this.valueTransferCryptoService,
        storage: this.valueTransferStateService,
      },
      {}
    )
  }

  /**
   * Init party (Getter or Giver) state in the Wallet
   */
  public async initPartyState(): Promise<void> {
    const partyState = await this.getPartyState()
    if (partyState) return

    const state = new ValueTransferStateRecord({
      partyState: new PartyState(new Uint8Array(), new Wallet()),
    })
    await this.valueTransferStateRepository.save(state)
  }

  /**
   * Add notes into the wallet.
   * Init payment state if it's missing.
   *
   * @param notes Verifiable notes to add.
   *
   * @returns Transaction Record for wallet state transition after receiving notes
   */
  public async receiveNotes(notes: VerifiableNote[]): Promise<TransactionRecord | undefined> {
    try {
      // no notes to add
      if (!notes.length) return

      if (this.config.valueTransferConfig?.witness) {
        throw new AriesFrameworkError(`Witness cannot add notes`)
      }

      const state = await this.getPartyState()
      if (!state) {
        throw new AriesFrameworkError(`Unable to find party state`)
      }

      const [proof, wallet] = state.partyState.wallet.receiveNotes(new Set(notes))
      await this.valueTransferStateService.storePartyState({
        ...state.partyState,
        wallet,
      })

      return new TransactionRecord({ start: proof.currentState || null, end: proof.nextState })
    } catch (e) {
      throw new AriesFrameworkError(`Unable to add verifiable notes. Err: ${e}`)
    }
  }

  /**
   * Process a received {@link ProblemReportMessage} and cancel Value Transfer.
   * Update Value Transfer record with the information from the message.
   *
   * @param messageContext The record context containing the message.
   * @returns Value Transfer record and Message to Forward
   */
  public async processProblemReport(messageContext: InboundMessageContext<ProblemReportMessage>): Promise<{
    record?: ValueTransferRecord
    message?: ProblemReportMessage
  }> {
    const { message: problemReportMessage } = messageContext
    const record = await this.findByThread(problemReportMessage.pthid)
    if (!record) {
      this.config.logger.error(`Value Transaction not for the received thread ${problemReportMessage.pthid}`)
      return {}
    }

    if (record.role === ValueTransferRole.Witness) {
      // When Witness receives Problem Report he needs to forward this to the 3rd party
      const forwardedProblemReportMessage = new ProblemReportMessage({
        from: record.witness?.did,
        to: messageContext.message.from === record.getter?.did ? record.giver?.did : record.getter?.did,
        body: problemReportMessage.body,
        pthid: problemReportMessage.pthid,
      })

      record.problemReportMessage = problemReportMessage
      await this.updateState(record, ValueTransferState.Failed, ValueTransferTransactionStatus.Finished)
      return {
        record,
        message: forwardedProblemReportMessage,
      }
    }
    if (record.role === ValueTransferRole.Getter) {
      // If Getter has already accepted the cash -> he needs to rollback the state
      await this.valueTransfer.getter().abortTransaction()
    }
    if (record.role === ValueTransferRole.Giver) {
      // If Giver has already accepted the request and marked the cash for spending -> he needs to free the cash
      await this.valueTransfer.giver().abortTransaction()
    }

    // Update Value Transfer record and raise event
    record.problemReportMessage = problemReportMessage
    await this.updateState(record, ValueTransferState.Failed, ValueTransferTransactionStatus.Finished)
    return { record }
  }

  public async abortTransaction(
    record: ValueTransferRecord,
    code?: string,
    reason?: string
  ): Promise<{
    record: ValueTransferRecord
    message?: ProblemReportMessage
  }> {
    if (record.role === ValueTransferRole.Witness) {
      // TODO: discuss weather Witness can abort transaction
      throw new AriesFrameworkError('Transaction cannot be canceled by Witness.')
    }

    if (record.state === ValueTransferState.Completed) {
      throw new AriesFrameworkError('Transaction cannot be canceled as it is already completed.')
    }

    if (record.state === ValueTransferState.Failed) {
      throw new AriesFrameworkError('Transaction cannot be canceled as it is failed.')
    }

    let from = undefined
    let to = undefined

    if (record.role === ValueTransferRole.Giver) {
      await this.valueTransfer.giver().abortTransaction()
      from = record.giver?.did
      to = record.state === ValueTransferState.ReceiptReceived ? record.witness?.did : record.getter?.did
    } else if (record.role === ValueTransferRole.Getter) {
      await this.valueTransfer.getter().abortTransaction()
      from = record.getter?.did
      to = record.state === ValueTransferState.OfferReceived ? record.witness?.did : record.giver?.did
    }

    const problemReport = new ProblemReportMessage({
      from,
      to,
      pthid: record.threadId,
      body: {
        code: code || 'e.p.transaction-aborted',
        comment: `Transaction aborted by ${from}. ` + (reason ? `Reason: ${reason}.` : ''),
      },
    })

    record.problemReportMessage = problemReport

    await this.updateState(record, ValueTransferState.Failed, ValueTransferTransactionStatus.Finished)
    return { record, message: problemReport }
  }

  public async getPendingTransactions(): Promise<{
    records?: ValueTransferRecord[] | null
  }> {
    const records = await this.valueTransferRepository.findByQuery({ status: ValueTransferTransactionStatus.Pending })
    return { records }
  }

  public async getActiveTransaction(): Promise<{
    record?: ValueTransferRecord | null
  }> {
    const record = await this.valueTransferRepository.findSingleByQuery({
      status: ValueTransferTransactionStatus.InProgress,
    })
    return { record }
  }

  public async returnWhenIsCompleted(recordId: string, timeoutMs = 120000): Promise<ValueTransferRecord> {
    const isCompleted = (record: ValueTransferRecord) => {
      return (
        record.id === recordId &&
        (record.state === ValueTransferState.Completed || record.state === ValueTransferState.Failed)
      )
    }

    const observable = this.eventEmitter.observable<ValueTransferStateChangedEvent>(
      ValueTransferEventTypes.ValueTransferStateChanged
    )
    const subject = new ReplaySubject<ValueTransferRecord>(1)

    observable
      .pipe(
        map((e) => e.payload.record),
        first(isCompleted),
        timeout(timeoutMs)
      )
      .subscribe(subject)

    const valueTransfer = await this.getById(recordId)
    if (isCompleted(valueTransfer)) {
      subject.next(valueTransfer)
    }

    return firstValueFrom(subject)
  }

  public async sendMessage(message: DIDCommV2Message, transport?: Transports) {
    this.config.logger.info(`Sending VTP message with type '${message.type}' to DID ${message?.to}`)
    const sendingMessageType = message.to ? SendingMessageType.Encrypted : SendingMessageType.Signed
    await this.messageSender.sendDIDCommV2Message(message, sendingMessageType, transport)
  }

  public async getBalance(): Promise<number> {
    const state = await this.valueTransferStateService.getPartyState()
    return state.wallet.amount()
  }

  public async getByThread(threadId: string): Promise<ValueTransferRecord> {
    return this.valueTransferRepository.getSingleByQuery({ threadId })
  }

  public async findByThread(threadId: string): Promise<ValueTransferRecord | null> {
    return this.valueTransferRepository.findSingleByQuery({ threadId })
  }

  public async getAll(): Promise<ValueTransferRecord[]> {
    return this.valueTransferRepository.getAll()
  }

  public async getById(recordId: string): Promise<ValueTransferRecord> {
    return this.valueTransferRepository.getById(recordId)
  }

  public async findAllByQuery(query: Partial<ValueTransferTags>) {
    return this.valueTransferRepository.findByQuery(query)
  }

  public async updateState(
    record: ValueTransferRecord,
    state: ValueTransferState,
    status: ValueTransferTransactionStatus
  ) {
    const previousState = record.state
    record.state = state
    record.status = status
    await this.valueTransferRepository.update(record)
    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record: record, previousState },
    })
  }

  public async getPartyState(): Promise<ValueTransferStateRecord | null> {
    return this.valueTransferStateRepository.findSingleByQuery({})
  }

  public async getTransactionDid(usePublicDid?: boolean) {
    return this.didService.getPublicDidOrCreateNew(usePublicDid)
  }
}
