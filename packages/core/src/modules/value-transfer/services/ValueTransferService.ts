import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { ValueTransferConfig } from '../../../types'
import type { Transports } from '../../routing/types'
import type { ValueTransferStateChangedEvent } from '../ValueTransferEvents'
import type { ValueTransferRecord, ValueTransferTags } from '../repository'
import type { VerifiableNote } from '@sicpa-dlab/value-transfer-protocol-ts'

import {
  createVerifiableNotes,
  PartyState,
  ValueTransfer,
  Wallet,
  WitnessState,
} from '@sicpa-dlab/value-transfer-protocol-ts'
import { firstValueFrom, ReplaySubject } from 'rxjs'
import { first, map, timeout } from 'rxjs/operators'
import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { MessageSender } from '../../../agent/MessageSender'
import { SendingMessageType } from '../../../agent/didcomm/types'
import { createOutboundDIDCommV2Message } from '../../../agent/helpers'
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
import { WitnessStateRecord } from '../repository/WitnessStateRecord'
import { WitnessStateRepository } from '../repository/WitnessStateRepository'

import { ValueTransferCryptoService } from './ValueTransferCryptoService'
import { ValueTransferStateService } from './ValueTransferStateService'

const DEFAULT_SUPPORTED_PARTIES_COUNT = 50

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

  public async initState(config: ValueTransferConfig) {
    if (config.isWitness) {
      const record = await this.getWitnessState()
      const publicDid = await this.didService.findPublicDid()

      if (!record) {
        if (!publicDid) {
          throw new AriesFrameworkError(
            'Witness public DID not found. Please set `publicDidSeed` field in the agent config.'
          )
        }

        const partyStateHashes = ValueTransferService.generateInitialPartyStateHashes(config.supportedPartiesCount)

        const record = new WitnessStateRecord({
          witnessState: new WitnessState(partyStateHashes),
        })

        await this.witnessStateRepository.save(record)
      } else {
        if (!record.witnessState.partyStateHashes.size) {
          const partyStateHashes = ValueTransferService.generateInitialPartyStateHashes(config.supportedPartiesCount)

          for (const hash of partyStateHashes) {
            record.witnessState.partyStateHashes.add(hash)
          }

          await this.witnessStateRepository.update(record)
        }
      }
    } else {
      const stateRecord = await this.initPartyState()
      if (!stateRecord.partyState.wallet.amount()) {
        const initialNotes = config.verifiableNotes?.length
          ? config.verifiableNotes
          : ValueTransferService.getRandomInitialStateNotes(config.supportedPartiesCount)
        await this.receiveNotes(initialNotes, stateRecord)
      }
    }
  }

  /**
   * Add notes into the wallet.
   * Init payment state if it's missing.
   *
   * @param notes Verifiable notes to add.
   * @param stateRecord Party Valuer Transfer state record
   */
  public async receiveNotes(notes: VerifiableNote[], stateRecord?: ValueTransferStateRecord | null) {
    try {
      if (!notes.length) return
      if (this.config.valueTransferConfig?.isWitness) {
        throw new AriesFrameworkError(`Witness cannot add notes`)
      }

      const state = stateRecord ? stateRecord : await this.initPartyState()

      const [, wallet] = state.partyState.wallet.receiveNotes(new Set(notes))
      await this.valueTransferStateService.storePartyState({
        ...state.partyState,
        wallet,
      })
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
    record: ValueTransferRecord
    message?: ProblemReportMessage
  }> {
    const { message: problemReportMessage } = messageContext
    const record = await this.getByThread(problemReportMessage.pthid)

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

    if (record.role === ValueTransferRole.Giver) {
      await this.valueTransfer.giver().abortTransaction()
      from = record.giver?.did
    } else if (record.role === ValueTransferRole.Getter) {
      await this.valueTransfer.getter().abortTransaction()
      from = record.getter?.did
    }

    const problemReport = new ProblemReportMessage({
      from,
      to: record.witness?.did,
      pthid: record.threadId,
      body: {
        code: 'e.p.transaction-aborted',
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

  public async sendProblemReportToGetterAndGiver(message: ProblemReportMessage, record?: ValueTransferRecord) {
    const getterProblemReport = new ProblemReportMessage({
      ...message,
      to: record?.getter?.did,
    })
    const giverProblemReport = new ProblemReportMessage({
      ...message,
      to: record?.giver?.did,
    })

    await Promise.all([this.sendMessageToGetter(getterProblemReport), this.sendMessageToGiver(giverProblemReport)])
  }

  public async sendMessageToWitness(message: DIDCommV2Message, transport?: Transports) {
    return this.sendMessage(message, transport)
  }

  public async sendMessageToGiver(message: DIDCommV2Message, transport?: Transports) {
    return this.sendMessage(message, transport)
  }

  public async sendMessageToGetter(message: DIDCommV2Message, transport?: Transports) {
    return this.sendMessage(message, transport)
  }

  private async sendMessage(message: DIDCommV2Message, transport?: Transports) {
    const sendingMessageType = message.to ? SendingMessageType.Encrypted : SendingMessageType.Signed
    const outboundMessage = createOutboundDIDCommV2Message(message)
    await this.messageSender.sendDIDCommV2Message(outboundMessage, sendingMessageType, transport)
  }

  public async getBalance(): Promise<number> {
    const state = await this.valueTransferStateService.getPartyState()
    return state.wallet.amount()
  }

  public async getByThread(threadId: string): Promise<ValueTransferRecord> {
    return this.valueTransferRepository.getSingleByQuery({ threadId })
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

  public async getWitnessState(): Promise<WitnessStateRecord | null> {
    return this.witnessStateRepository.findSingleByQuery({})
  }

  private async initPartyState(): Promise<ValueTransferStateRecord> {
    let state = await this.getPartyState()
    if (state) return state

    state = new ValueTransferStateRecord({
      partyState: new PartyState(new Uint8Array(), new Wallet()),
    })
    await this.valueTransferStateRepository.save(state)
    return state
  }

  public async getTransactionDid(params: { role: ValueTransferRole; usePublicDid?: boolean }) {
    // Witness MUST use public DID
    if (params.role === ValueTransferRole.Witness) {
      const publicDid = await this.didService.getPublicDid()
      if (!publicDid) {
        throw new AriesFrameworkError('Witness public DID not found')
      }
      return publicDid
    } else {
      return this.didService.getPublicDidOrCreateNew(params.usePublicDid)
    }
  }

  private static generateInitialPartyStateHashes(statesCount = DEFAULT_SUPPORTED_PARTIES_COUNT) {
    const partyStateHashes = new Set<Uint8Array>()

    for (let i = 0; i < statesCount; i++) {
      const startFromSno = i * 10
      const [, partyWallet] = new Wallet().receiveNotes(new Set(createVerifiableNotes(10, startFromSno)))
      partyStateHashes.add(partyWallet.rootHash())
    }

    return partyStateHashes
  }

  private static getRandomInitialStateNotes(statesCount = DEFAULT_SUPPORTED_PARTIES_COUNT): VerifiableNote[] {
    const stateIndex = Math.floor(Math.random() * statesCount)
    const startFromSno = stateIndex * 10
    return createVerifiableNotes(10, startFromSno)
  }
}
