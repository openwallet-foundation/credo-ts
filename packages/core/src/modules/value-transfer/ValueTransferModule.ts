import type { ProblemReportMessage, RequestAcceptedMessage, RequestMessage } from './messages'
import type { ValueTransferRecord, ValueTransferTags } from './repository'

import { Lifecycle, scoped } from 'tsyringe'

import { Dispatcher } from '../../agent/Dispatcher'

import { ValueTransferResponseCoordinator } from './ValueTransferResponseCoordinator'
import { RequestHandler } from './handlers'
import { CashAcceptedHandler } from './handlers/CashAcceptedHandler'
import { CashAcceptedWitnessedHandler } from './handlers/CashAcceptedWitnessedHandler'
import { CashRemovedHandler } from './handlers/CashRemovedHandler'
import { GetterReceiptHandler } from './handlers/GetterReceiptHandler'
import { GiverReceiptHandler } from './handlers/GiverReceiptHandler'
import { ProblemReportHandler } from './handlers/ProblemReportHandler'
import { RequestAcceptedHandler } from './handlers/RequestAcceptedHandler'
import { RequestAcceptedWitnessedHandler } from './handlers/RequestAcceptedWitnessedHandler'
import { RequestWitnessedHandler } from './handlers/RequestWitnessedHandler'
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
   * Initiate a new value transfer exchange as Getter by sending a Payment Request message
   * to the Witness which transfers record later to the known Giver.
   *
   * @param amount Amount to pay
   * @param giver DID of Giver. Must be known in advance.
   * @param witness (Optional) DID of Witness. Must be omitted and set by Witness later.
   * @param usePublicDid (Optional) Whether to use public DID of Getter in the request or create a new random one (True by default)
   *
   * @returns Value Transfer record and Payment Request Message
   */
  public async requestPayment(
    amount: number,
    witness?: string,
    giver?: string,
    usePublicDid = true
  ): Promise<{ record: ValueTransferRecord; message: RequestMessage }> {
    // Create Payment Request and Value Transfer record
    const { message, record } = await this.valueTransferGetterService.createRequest(
      amount,
      witness,
      giver,
      usePublicDid
    )

    // Send Payment Request to Witness
    await this.valueTransferService.sendMessageToWitness(message)
    return { message, record }
  }

  /**
   * Accept received Payment Request as Giver.
   *
   * @param recordId Id of Value Transfer record
   *
   * @returns Value Transfer record and Payment Request Acceptance Message
   */
  public async acceptPaymentRequest(recordId: string): Promise<{
    record: ValueTransferRecord
    message: RequestAcceptedMessage | ProblemReportMessage
  }> {
    // Get Value Transfer record
    const record = await this.valueTransferService.getById(recordId)

    // Accept Payment Request
    const { message, record: updatedRecord } = await this.valueTransferGiverService.acceptRequest(record)

    // Send Payment Request Acceptance to Witness
    await this.valueTransferService.sendMessageToWitness(message)

    return { record: updatedRecord, message }
  }

  /**
   * Wait until Value Transfer exchange complete.
   *
   * @param recordId Id of Value Transfer record
   *
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
    if (message && send) await this.valueTransferService.sendMessageToWitness(message)

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
  }
}
