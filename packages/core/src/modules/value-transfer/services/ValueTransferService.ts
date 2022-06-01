import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { ValueTransferConfig } from '../../../types'
import type { Transport } from '../../routing/types'
import type { ValueTransferStateChangedEvent } from '../ValueTransferEvents'
import type { ValueTransferRecord, ValueTransferTags } from '../repository'

import { ValueTransfer, verifiableNoteProofConfig } from '@sicpa-dlab/value-transfer-protocol-ts'
import { firstValueFrom, ReplaySubject } from 'rxjs'
import { first, map, timeout } from 'rxjs/operators'
import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { MessageSender } from '../../../agent/MessageSender'
import { SendingMessageType } from '../../../agent/didcomm/types'
import { createOutboundDIDCommV2Message } from '../../../agent/helpers'
import { AriesFrameworkError } from '../../../error'
import { ConnectionService } from '../../connections/services/ConnectionService'
import { DidService } from '../../dids/services/DidService'
import { ValueTransferEventTypes } from '../ValueTransferEvents'
import { ValueTransferRole } from '../ValueTransferRole'
import { ValueTransferState } from '../ValueTransferState'
import { ProblemReportMessage } from '../messages/ProblemReportMessage'
import { ValueTransferRepository } from '../repository'
import { ValueTransferStateRecord } from '../repository/ValueTransferStateRecord'
import { ValueTransferStateRepository } from '../repository/ValueTransferStateRepository'
import { WitnessStateRecord } from '../repository/WitnessStateRecord'
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
  private connectionService: ConnectionService
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
    connectionService: ConnectionService,
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
    this.connectionService = connectionService
    this.eventEmitter = eventEmitter
    this.messageSender = messageSender

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

  public async initState(config: ValueTransferConfig) {
    const publicDid = await this.didService.findPublicDid()

    if (config.role === ValueTransferRole.Witness) {
      const state = await this.witnessStateRepository.findSingleByQuery({})
      if (state) return

      if (!publicDid) {
        throw new AriesFrameworkError(
          'Witness public DID not found. Please set `publicDidSeed` field in the agent config.'
        )
      }

      const record = new WitnessStateRecord({
        publicDid: publicDid.id,
        stateAccumulator: '',
      })
      await this.witnessStateRepository.save(record)
      return
    }
    if (config.role === ValueTransferRole.Getter || ValueTransferRole.Giver) {
      const state = await this.valueTransferStateRepository.findSingleByQuery({})

      if (!state) {
        const record = new ValueTransferStateRecord({
          publicDid: publicDid?.id,
          previousHash: '',
          verifiableNotes: [],
        })
        await this.valueTransferStateRepository.save(record)
      }

      if (!state?.verifiableNotes?.length && config.verifiableNotes) {
        await this.valueTransfer.giver().addCash(config.verifiableNotes)
      }
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
        from: record.witnessDid,
        to: messageContext.message.from === record.getterDid ? record.giverDid : record.getterDid,
        body: problemReportMessage.body,
        pthid: problemReportMessage.pthid,
      })

      record.problemReportMessage = forwardedProblemReportMessage
      await this.updateState(record, ValueTransferState.Failed)
      return {
        record,
        message: problemReportMessage,
      }
    }
    if (record.role === ValueTransferRole.Getter) {
      if (record.state === ValueTransferState.CashAcceptanceSent) {
        // If Getter has already accepted the cash -> he needs to rollback the state
        // TODO: implement deleteCash in value transfer
        // const { error, message } = await this.valueTransfer.getter().deleteCash(record.cashAcceptedMessage)
        // if (error || !message) {
        //   throw new AriesFrameworkError(`Getter: Failed to delete cash: ${error?.message}`)
        // }
      }
    }
    if (record.role === ValueTransferRole.Giver) {
      if (record.state === ValueTransferState.RequestAcceptanceSent) {
        // If Giver has already accepted the request and marked the cash for spending -> he needs to free the cash
        // TODO: implement freeCash in value transfer
        // const { error, message } = await this.valueTransfer.giver().freeCash(record.requestAcceptedMessage)
        // if (error || !message) {
        //   throw new AriesFrameworkError(`Giver: Failed to free cash: ${error?.message}`)
        // }
      }
      if (record.state === ValueTransferState.CashRemovalSent) {
        // If Giver has already accepted the request and marked the cash for spending -> he needs to free the cash
        // const { error, message } = await this.valueTransfer.giver().freeCash(record.cashRemovedMessage)
        // if (error || !message) {
        //   throw new AriesFrameworkError(`Giver: Failed to free cash: ${error?.message}`)
        // }
      }
    }

    // Update Value Transfer record and raise event
    record.problemReportMessage = problemReportMessage
    await this.updateState(record, ValueTransferState.Failed)
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

  public async sendMessageToWitness(message: DIDCommV2Message, record?: ValueTransferRecord) {
    message.to = record?.witnessDid ? [record.witnessDid] : undefined
    const witnessTransport = this.config.valueTransferConfig?.witnessTransport
    return this.sendMessage(message, witnessTransport)
  }

  public async sendMessageToGiver(message: DIDCommV2Message, record?: ValueTransferRecord) {
    message.to = record?.giverDid ? [record.giverDid] : undefined
    const giverTransport = this.config.valueTransferConfig?.giverTransport
    return this.sendMessage(message, giverTransport)
  }

  public async sendMessageToGetter(message: DIDCommV2Message, record?: ValueTransferRecord) {
    message.to = record?.getterDid ? [record.getterDid] : undefined
    const getterTransport = this.config.valueTransferConfig?.getterTransport
    return this.sendMessage(message, getterTransport)
  }

  private async sendMessage(message: DIDCommV2Message, transport?: Transport) {
    const sendingMessageType = message.to ? SendingMessageType.Encrypted : SendingMessageType.Signed
    const outboundMessage = createOutboundDIDCommV2Message(message)
    await this.messageSender.sendDIDCommV2Message(outboundMessage, transport, sendingMessageType)
  }

  public async getBalance(): Promise<number> {
    const state = await this.valueTransferStateService.getState()
    return state.verifiableNotes.length
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

  public async updateState(record: ValueTransferRecord, state: ValueTransferState) {
    const previousState = record.state
    record.state = state
    await this.valueTransferRepository.update(record)
    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record: record, previousState },
    })
  }
}
