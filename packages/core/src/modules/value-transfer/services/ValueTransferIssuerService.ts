import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { CashMintedEvent } from '../ValueTransferEvents'
import type { MintResponseMessage } from '../messages/MintResponseMessage'

import { Giver } from '@sicpa-dlab/value-transfer-protocol-ts'
import { firstValueFrom, ReplaySubject } from 'rxjs'
import { first, timeout } from 'rxjs/operators'
import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../error'
import { DidService } from '../../dids/services/DidService'
import { ValueTransferEventTypes } from '../ValueTransferEvents'
import { ValueTransferRepository } from '../repository'

import { ValueTransferCryptoService } from './ValueTransferCryptoService'
import { ValueTransferPartyStateService } from './ValueTransferPartyStateService'
import { ValueTransferService } from './ValueTransferService'
import { ValueTransferTransportService } from './ValueTransferTransportService'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferIssuerService {
  private config: AgentConfig
  private valueTransferRepository: ValueTransferRepository
  private valueTransferService: ValueTransferService
  private valueTransferCryptoService: ValueTransferCryptoService
  private valueTransferStateService: ValueTransferPartyStateService
  private didService: DidService
  private giver: Giver
  private eventEmitter: EventEmitter

  public constructor(
    config: AgentConfig,
    valueTransferRepository: ValueTransferRepository,
    valueTransferService: ValueTransferService,
    valueTransferCryptoService: ValueTransferCryptoService,
    valueTransferStateService: ValueTransferPartyStateService,
    valueTransferTransportService: ValueTransferTransportService,
    didService: DidService,
    eventEmitter: EventEmitter
  ) {
    this.config = config
    this.valueTransferRepository = valueTransferRepository
    this.valueTransferService = valueTransferService
    this.valueTransferCryptoService = valueTransferCryptoService
    this.valueTransferStateService = valueTransferStateService
    this.didService = didService
    this.eventEmitter = eventEmitter
    this.giver = new Giver(
      {
        crypto: valueTransferCryptoService,
        storage: valueTransferStateService,
        transport: valueTransferTransportService,
        logger: this.config.logger,
      },
      {
        witness: config.valueTransferWitnessDid,
        label: config.label,
      }
    )
  }

  /**
   * Mint (generate and receive) specified amount of Verifiable Notes.
   *
   * @param amount Amount of cash to mint
   * @param witness DID of Witness to send mint message
   * @param send Whether Mint message should be sent to witness
   * @param awaitResponse Whether response from the witness should be awaited before commiting the state
   * @param timeoutMs Amount of seconds to wait for an mint approval from witness
   *
   * @returns Mint message for specified Witness DID
   */
  public async mintCash(
    amount: number,
    witness: string,
    send = true,
    awaitResponse = true,
    timeoutMs = 20000
  ): Promise<void> {
    this.config.logger.info(`> Issuer ${this.config.label}: mint cash with`)

    const publicDid = await this.didService.getPublicDid()
    if (!publicDid) {
      throw new AriesFrameworkError('Public DID is not found')
    }

    const { error, transaction, message } = await this.giver.startCashMinting(publicDid.did, amount, witness, send)
    if (error || !transaction || !message) {
      this.config.logger.error(`Issuer: Failed to mint cash: ${error?.message}`)
      return
    }

    // await acknowledge from witness
    if (awaitResponse) {
      await this.awaitCashMinted(timeoutMs)
    } else {
      const { error } = await this.giver.completeCashMinting(transaction.id)
      if (error) {
        this.config.logger.error(`  Issuer: Failed to mint cash: ${error?.message}`)
      }
    }
  }

  private async awaitCashMinted(timeoutMs = 20000): Promise<CashMintedEvent> {
    const observable = this.eventEmitter.observable<CashMintedEvent>(ValueTransferEventTypes.CashMinted)
    const subject = new ReplaySubject<CashMintedEvent>(1)
    observable.pipe(first(), timeout(timeoutMs)).subscribe(subject)
    return firstValueFrom(subject)
  }

  public async processCashMintResponse(messageContext: InboundMessageContext<MintResponseMessage>): Promise<void> {
    this.config.logger.info(`> Issuer ${this.config.label}: process cash mint response ${messageContext.message.thid}`)

    // Commit transaction and raise event
    const { error, transaction } = await this.giver.completeCashMinting(messageContext.message.thid)
    if (error || !transaction) {
      this.config.logger.error(`  Issuer: Failed to mint cash: ${error?.message}`)
      return
    }

    this.eventEmitter.emit<CashMintedEvent>({
      type: ValueTransferEventTypes.CashMinted,
      payload: {},
    })

    this.config.logger.info(
      `< Issuer ${this.config.label}: process cash mint response ${messageContext.message.thid} completed!`
    )
  }
}
