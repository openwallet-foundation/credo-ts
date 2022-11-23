import type { DependencyManager } from '../../plugins'
import type { Transports } from '../routing/types'
import type { RequestMessage, OfferMessage } from './messages'
import type { ValueTransferRecord, ValueTransferTags } from './repository'
import { Timeouts, TransactionState, TransactionStatus } from '@sicpa-dlab/value-transfer-protocol-ts'

import { Dispatcher } from '../../agent/Dispatcher'
import { module, injectable } from '../../plugins'

import { ValueTransferResponseCoordinator } from './ValueTransferResponseCoordinator'
import {
  OfferHandler,
  CashAcceptedHandler,
  CashAcceptedWitnessedHandler,
  CashRemovedHandler,
  GetterReceiptHandler,
  GiverReceiptHandler,
  ProblemReportHandler,
  RequestAcceptedHandler,
  RequestAcceptedWitnessedHandler,
  RequestHandler,
  MintHandler,
  MintResponseHandler,
  WitnessTableHandler,
} from './handlers'
import { ValueTransferService } from './services'
import { ValueTransferGetterService } from './services/ValueTransferGetterService'
import { ValueTransferGiverService } from './services/ValueTransferGiverService'
import { ValueTransferIssuerService } from './services/ValueTransferIssuerService'
import { ValueTransferWitnessService } from './services/ValueTransferWitnessService'
import { ValueTransferLockService } from './services/ValueTransferLockService'

@module()
@injectable()
export class ValueTransferModule {
  private valueTransferService: ValueTransferService
  private valueTransferGetterService: ValueTransferGetterService
  private valueTransferGiverService: ValueTransferGiverService
  private valueTransferWitnessService: ValueTransferWitnessService
  private valueTransferIssuerService: ValueTransferIssuerService
  private valueTransferResponseCoordinator: ValueTransferResponseCoordinator
  private valueTransferLockService: ValueTransferLockService

  public constructor(
    dispatcher: Dispatcher,
    valueTransferService: ValueTransferService,
    valueTransferGetterService: ValueTransferGetterService,
    valueTransferGiverService: ValueTransferGiverService,
    valueTransferWitnessService: ValueTransferWitnessService,
    valueTransferIssuerService: ValueTransferIssuerService,
    valueTransferResponseCoordinator: ValueTransferResponseCoordinator,
    valueTransferLockService: ValueTransferLockService
  ) {
    this.valueTransferService = valueTransferService
    this.valueTransferGetterService = valueTransferGetterService
    this.valueTransferGiverService = valueTransferGiverService
    this.valueTransferWitnessService = valueTransferWitnessService
    this.valueTransferIssuerService = valueTransferIssuerService
    this.valueTransferResponseCoordinator = valueTransferResponseCoordinator
    this.valueTransferLockService = valueTransferLockService
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
   *  witness - DID of witness validating and signing transaction
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
    transport?: Transports
    attachment?: Record<string, unknown>
  }): Promise<{ record: ValueTransferRecord; message: RequestMessage }> {
    // Create Payment Request and Value Transfer record
    return this.valueTransferGetterService.createRequest(params)
  }

  public async verifyRequestCanBeAccepted(record: ValueTransferRecord): Promise<{
    record?: ValueTransferRecord
  }> {
    return this.valueTransferGiverService.verifyRequestCanBeAccepted(record)
  }

  public async verifyOfferCanBeAccepted(record: ValueTransferRecord): Promise<{
    record?: ValueTransferRecord
  }> {
    return this.valueTransferGetterService.verifyOfferCanBeAccepted(record)
  }

  public async acquireWalletLock(transactioniId: string) {
    return await this.valueTransferLockService.acquireWalletLock(async () => {
      await this.returnWhenIsCompleted(transactioniId)
    })
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
   *   usePublicDid Boolean value that indicates whether Public DID should be used if giver is not specified in Value Transfer record
   * }
   *
   * @returns Value Transfer record
   */
  public async acceptPaymentRequest(params: { recordId: string; timeouts?: Timeouts }): Promise<{
    record?: ValueTransferRecord
  }> {
    await this.acquireWalletLock(params.recordId)

    // Get Value Transfer record
    const record = await this.valueTransferService.getById(params.recordId)

    if (record.state != TransactionState.RequestReceived) return {}

    // Accept Payment Request
    return this.valueTransferGiverService.acceptRequest(record, params.timeouts)
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
   *  skipSending (Optional) - skip sending of transaction (false by default)
   * }
   *
   * @returns Value Transfer record and Payment Offer Message
   */
  public async offerPayment(params: {
    amount: number
    getter?: string
    unitOfAmount?: string
    witness?: string
    usePublicDid?: boolean
    timeouts?: Timeouts
    transport?: Transports
    attachment?: Record<string, unknown>
  }): Promise<{ record: ValueTransferRecord; message: OfferMessage }> {
    // Create Payment Request and Value Transfer record
    return this.valueTransferGiverService.offerPayment(params)
  }

  /**
   * Accept received Payment Offer as Getter.
   *
   * @param params Options to use for accepting offer -
   * {
   *  recordId Id of Value Transfer record
   *  witness (Optional) DID ot the Witness which must process transaction (or will be taken from the framework config)
   *  timeouts Getter timeouts to which value transfer must fit
   *   {
   *      timeout_elapsed - number (seconds) - how far after start the party wants the transaction to timeout
   *      timeout_time of amount - string - absolute time when the party wants the transaction to timeout
   *   }
   * }
   *
   * @returns Value Transfer record
   */
  public async acceptPaymentOffer(params: { recordId: string; witness?: string; timeouts?: Timeouts }): Promise<{
    record?: ValueTransferRecord
  }> {
    await this.acquireWalletLock(params.recordId)

    // Get Value Transfer record
    const record = await this.valueTransferService.getById(params.recordId)

    if (record.state != TransactionState.OfferReceived) return {}
    // Accept Payment Request
    return this.valueTransferGetterService.acceptOffer(record, params.witness, params.timeouts)
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
    id: string,
    send = true,
    code?: string,
    reason?: string
  ): Promise<{
    record?: ValueTransferRecord
  }> {
    return this.valueTransferService.abortTransaction(id, send, code, reason)
  }

  /**
   * Mint cash by generating Verifiable Notes and sending mint message (state update) to Witness
   *
   * @param amount Amount of cash to mint
   * @param witness DID of Witness to send mint message
   * @param send Whether Mint message should be sent to witness
   * @param awaitResponse Whether response from the witness should be awaited before commiting the state
   * @param timeoutMs Amount of seconds to wait for an mint approval from witness
   */
  public async mintCash(
    amount: number,
    witness: string,
    send = true,
    awaitResponse = true,
    timeoutMs = 20000
  ): Promise<void> {
    return this.valueTransferIssuerService.mintCash(amount, witness, send, awaitResponse, timeoutMs)
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
   * Request the list of available witnesses
   */
  public async requestWitnessTable(witness?: string): Promise<void> {
    return this.valueTransferService.requestWitnessTable(witness)
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
    dispatcher.registerHandler(
      new RequestHandler(
        this.valueTransferService,
        this.valueTransferGiverService,
        this.valueTransferResponseCoordinator
      )
    )
    dispatcher.registerHandler(
      new OfferHandler(
        this.valueTransferService,
        this.valueTransferGetterService,
        this.valueTransferResponseCoordinator
      )
    )
    dispatcher.registerHandler(new RequestAcceptedHandler(this.valueTransferWitnessService))
    dispatcher.registerHandler(new RequestAcceptedWitnessedHandler(this.valueTransferGetterService))
    dispatcher.registerHandler(new CashAcceptedHandler(this.valueTransferWitnessService))
    dispatcher.registerHandler(new CashAcceptedWitnessedHandler(this.valueTransferGiverService))
    dispatcher.registerHandler(new CashRemovedHandler(this.valueTransferWitnessService))
    dispatcher.registerHandler(new GetterReceiptHandler(this.valueTransferGetterService))
    dispatcher.registerHandler(new GiverReceiptHandler(this.valueTransferGiverService))
    dispatcher.registerHandler(new ProblemReportHandler(this.valueTransferService))
    dispatcher.registerHandler(new MintHandler(this.valueTransferWitnessService))
    dispatcher.registerHandler(new MintResponseHandler(this.valueTransferIssuerService))
    dispatcher.registerHandler(new WitnessTableHandler(this.valueTransferService))
  }

  /**
   * Registers the dependencies of the value transfer module on the dependency manager.
   */
  public static register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(ValueTransferModule)

    // Services
    dependencyManager.registerSingleton(ValueTransferService)
    dependencyManager.registerSingleton(ValueTransferGiverService)
    dependencyManager.registerSingleton(ValueTransferGetterService)
    dependencyManager.registerSingleton(ValueTransferWitnessService)
  }
}
