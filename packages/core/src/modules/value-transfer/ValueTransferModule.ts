import type {
  ProblemReportMessage,
  RequestAcceptedMessage,
  RequestMessage,
  OfferMessage,
  CashAcceptedMessage,
} from './messages'
import type { ValueTransferRecord, ValueTransferTags } from './repository'
import type { Timeouts, VerifiableNote } from '@sicpa-dlab/value-transfer-protocol-ts'

import { Lifecycle, scoped } from 'tsyringe'

import { Dispatcher } from '../../agent/Dispatcher'

import { ValueTransferResponseCoordinator } from './ValueTransferResponseCoordinator'
import {
  OfferHandler,
  OfferWitnessedHandler,
  RequestHandler,
  CashAcceptedHandler,
  CashAcceptedWitnessedHandler,
  CashRemovedHandler,
  GetterReceiptHandler,
  GiverReceiptHandler,
  ProblemReportHandler,
  RequestAcceptedHandler,
  RequestAcceptedWitnessedHandler,
  RequestWitnessedHandler,
} from './handlers'
import { ValueTransferService } from './services'
import { ValueTransferGetterService } from './services/ValueTransferGetterService'
import { ValueTransferGiverService } from './services/ValueTransferGiverService'
import { ValueTransferWitnessService } from './services/ValueTransferWitnessService'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferModule {
  private valueTransferService: ValueTransferService
  private valueTransferGetterService: ValueTransferGetterService
  private valueTransferGiverService: ValueTransferGiverService
  private valueTransferWitnessService: ValueTransferWitnessService
  private valueTransferResponseCoordinator: ValueTransferResponseCoordinator

  public constructor(
    dispatcher: Dispatcher,
    valueTransferService: ValueTransferService,
    valueTransferGetterService: ValueTransferGetterService,
    valueTransferGiverService: ValueTransferGiverService,
    valueTransferWitnessService: ValueTransferWitnessService,
    valueTransferResponseCoordinator: ValueTransferResponseCoordinator
  ) {
    this.valueTransferService = valueTransferService
    this.valueTransferGetterService = valueTransferGetterService
    this.valueTransferGiverService = valueTransferGiverService
    this.valueTransferWitnessService = valueTransferWitnessService
    this.valueTransferResponseCoordinator = valueTransferResponseCoordinator
    this.registerHandlers(dispatcher)
  }

  /**
   * Initiate a new value transfer exchange as Giver by sending a Payment Offer message
   * to the Witness which transfers record later to the specified Getter.
   *
   * @param params Options to use for request creation -
   * {
   *  amount - Amount to pay
   *  unitOfAmount - (Optional) Currency code that represents the unit of account
   *  witness - (Optional) DID of witness if it's known in advance
   *  giver - (Optional) DID of giver if it's known in advance
   *  usePublicDid - (Optional) Whether to use public DID of Getter in the request or create a new random one (True by default)
   *  timeouts (Optional) - Getter timeouts to which value transfer must fit
   *   {
   *      timeout_elapsed - number (seconds) - how far after start the party wants the transaction to timeout
   *      timeout_time of amount - string - absolute time when the party wants the transaction to timeout
   *    }
   * }
   *
   * @returns Value Transfer record and Payment Request Message
   */
  public async requestPayment(params: {
    amount: number
    unitOfAmount?: string
    witness?: string
    giver?: string
    usePublicDid?: boolean
    timeouts?: Timeouts
  }): Promise<{ record: ValueTransferRecord; message: RequestMessage }> {
    // Create Payment Request and Value Transfer record
    const { message, record } = await this.valueTransferGetterService.createRequest(params)

    // Send Payment Request to Witness
    await this.valueTransferService.sendMessageToWitness(message, record.role)
    return { message, record }
  }

  /**
   * Accept received Payment Request as Giver.
   *
   * @param params Options to use for accepting request -
   * {
   *  recordId Id of Value Transfer record
   *  timeouts Giver timeouts to which value transfer must fit
   *   {
   *      timeout_elapsed - number (seconds) - how far after start the party wants the transaction to timeout
   *      timeout_time of amount - string - absolute time when the party wants the transaction to timeout
   *   }
   * }
   *
   * @returns Value Transfer record and Payment Request Acceptance Message
   */
  public async acceptPaymentRequest(params: { recordId: string; timeouts?: Timeouts }): Promise<{
    record: ValueTransferRecord
    message: RequestAcceptedMessage | ProblemReportMessage
  }> {
    // Get Value Transfer record
    const record = await this.valueTransferService.getById(params.recordId)

    // Accept Payment Request
    const { message, record: updatedRecord } = await this.valueTransferGiverService.acceptRequest(
      record,
      params.timeouts
    )

    // Send Payment Request Acceptance to Witness
    await this.valueTransferService.sendMessageToWitness(message, record.role)

    return { record: updatedRecord, message }
  }

  /**
   * Initiate a new value transfer exchange as Giver by sending a Payment Offer message
   * to the Witness which transfers record later to the specified Getter.
   *
   * @param params Options to use for request creation -
   * {
   *  amount - Amount to pay
   *  unitOfAmount - (Optional) Currency code that represents the unit of account
   *  witness - DID of witness
   *  getter - DID of getter
   *  usePublicDid - (Optional) Whether to use public DID of Giver in the offer or create a new random one (False by default)
   *  timeouts (Optional) - Giver timeouts to which value transfer must fit
   *   {
   *      timeout_elapsed - number (seconds) - how far after start the party wants the transaction to timeout
   *      timeout_time of amount - string - absolute time when the party wants the transaction to timeout
   *    }
   * }
   *
   * @returns Value Transfer record and Payment Request Message
   */
  public async offerPayment(params: {
    amount: number
    unitOfAmount?: string
    witness: string
    getter: string
    usePublicDid?: boolean
    timeouts?: Timeouts
  }): Promise<{ record: ValueTransferRecord; message: OfferMessage }> {
    // Create Payment Request and Value Transfer record
    const { message, record } = await this.valueTransferGiverService.offerPayment(params)

    // Send Payment Request to Witness
    await this.valueTransferService.sendMessageToWitness(message, record.role)
    return { message, record }
  }

  /**
   * Accept received Payment Offer as Getter.
   *
   * @param params Options to use for accepting offer -
   * {
   *  recordId Id of Value Transfer record
   *  timeouts Getter timeouts to which value transfer must fit
   *   {
   *      timeout_elapsed - number (seconds) - how far after start the party wants the transaction to timeout
   *      timeout_time of amount - string - absolute time when the party wants the transaction to timeout
   *   }
   * }
   *
   * @returns Value Transfer record and Payment Request Acceptance Message
   */
  public async acceptPaymentOffer(params: { recordId: string; timeouts?: Timeouts }): Promise<{
    record: ValueTransferRecord
    message: CashAcceptedMessage | ProblemReportMessage
  }> {
    // Get Value Transfer record
    const record = await this.valueTransferService.getById(params.recordId)

    // Accept Payment Request
    const { message, record: updatedRecord } = await this.valueTransferGetterService.acceptOffer(
      record,
      params.timeouts
    )

    // Send Payment Request Acceptance to Witness
    await this.valueTransferService.sendMessageToWitness(message, record.role)

    return { record: updatedRecord, message }
  }

  /**
   * Wait until Value Transfer exchange complete.
   *
   * @param recordId Id of Value Transfer record
   *
   * @param options
   * @returns Value Transfer record
   */
  public async returnWhenIsCompleted(recordId: string, options?: { timeoutMs: number }): Promise<ValueTransferRecord> {
    return this.valueTransferService.returnWhenIsCompleted(recordId, options?.timeoutMs)
  }

  /**
   * Get current wallet balance.
   *
   * @returns wallet balance
   */
  public async getBalance(): Promise<number> {
    return this.valueTransferService.getBalance()
  }

  /**
   * Try to abort value transfer protocol and send correspondent Problem Report to remote
   *
   * @returns Value Transfer record and sent Problem Report Message
   * */
  public async abortTransaction(
    recordId: string,
    send = true,
    reason?: string
  ): Promise<{
    record: ValueTransferRecord
    message: ProblemReportMessage | undefined
  }> {
    // Get Value Transfer record
    const record = await this.valueTransferService.getById(recordId)

    // Abort transaction
    const { message } = await this.valueTransferService.abortTransaction(record, reason)
    // Send Payment Request Acceptance to Witness
    if (message && send) await this.valueTransferService.sendMessageToWitness(message, record.role)

    return { record, message }
  }

  /**
   * Get list of pending transactions:
   *  Getter: Request sent but hasn't accepted / rejected yet
   *  Giver: Request received but hasn't accepted / rejected yet
   *
   * @returns Value Transfer records
   * */
  public async getPendingTransactions(): Promise<{
    records?: ValueTransferRecord[] | null
  }> {
    return this.valueTransferService.getPendingTransactions()
  }

  /**
   * Get active transaction.
   * If there is more than one active transaction error will be thrown.
   *
   * @returns Value Transfer record in Active Status
   * */
  public async getActiveTransaction(): Promise<{
    record?: ValueTransferRecord | null
  }> {
    return this.valueTransferService.getActiveTransaction()
  }

  /**
   * Add notes into the wallet.
   * Init payment state if it's missing.
   *
   * @param notes Verifiable notes to add.
   */
  public async receiveNotes(notes: VerifiableNote[]) {
    await this.valueTransferService.receiveNotes(notes)
  }

  public getAll(): Promise<ValueTransferRecord[]> {
    return this.valueTransferService.getAll()
  }

  public async findAllByQuery(query: Partial<ValueTransferTags>) {
    return this.valueTransferService.findAllByQuery(query)
  }

  public async getById(recordId: string): Promise<ValueTransferRecord> {
    return this.valueTransferService.getById(recordId)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new RequestHandler(this.valueTransferService, this.valueTransferWitnessService))
    dispatcher.registerHandler(
      new RequestWitnessedHandler(
        this.valueTransferService,
        this.valueTransferGiverService,
        this.valueTransferResponseCoordinator
      )
    )
    dispatcher.registerHandler(new RequestAcceptedHandler(this.valueTransferService, this.valueTransferWitnessService))
    dispatcher.registerHandler(
      new RequestAcceptedWitnessedHandler(this.valueTransferService, this.valueTransferGetterService)
    )
    dispatcher.registerHandler(new CashAcceptedHandler(this.valueTransferService, this.valueTransferWitnessService))
    dispatcher.registerHandler(
      new CashAcceptedWitnessedHandler(this.valueTransferService, this.valueTransferGiverService)
    )
    dispatcher.registerHandler(new CashRemovedHandler(this.valueTransferService, this.valueTransferWitnessService))
    dispatcher.registerHandler(new GetterReceiptHandler(this.valueTransferGetterService))
    dispatcher.registerHandler(new GiverReceiptHandler(this.valueTransferGiverService))
    dispatcher.registerHandler(new ProblemReportHandler(this.valueTransferService))
    dispatcher.registerHandler(new OfferHandler(this.valueTransferService, this.valueTransferWitnessService))
    dispatcher.registerHandler(
      new OfferWitnessedHandler(
        this.valueTransferService,
        this.valueTransferGetterService,
        this.valueTransferResponseCoordinator
      )
    )
  }
}
