import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { CashMintedEvent } from '../ValueTransferEvents'
import type { MintResponseMessage } from '../messages/MintResponseMessage'
import type { Logger } from '@aries-framework/core'

import { Giver } from '@sicpa-dlab/value-transfer-protocol-ts'
import { firstValueFrom, ReplaySubject } from 'rxjs'
import { first, timeout } from 'rxjs/operators'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../error'
import { injectable } from '../../../plugins'
import { ValueTransferEventTypes } from '../ValueTransferEvents'
import { tryCreateSicpaContextLogger } from '../logger'

import { ValueTransferCryptoService } from './ValueTransferCryptoService'
import { ValueTransferPartyStateService } from './ValueTransferPartyStateService'
import { ValueTransferService } from './ValueTransferService'
import { ValueTransferTransportService } from './ValueTransferTransportService'

@injectable()
export class ValueTransferIssuerService {
  private logger: Logger
  private label: string
  private valueTransferService: ValueTransferService
  private giver: Giver
  private eventEmitter: EventEmitter

  public constructor(
    config: AgentConfig,
    valueTransferService: ValueTransferService,
    valueTransferCryptoService: ValueTransferCryptoService,
    valueTransferStateService: ValueTransferPartyStateService,
    valueTransferTransportService: ValueTransferTransportService,
    eventEmitter: EventEmitter
  ) {
    this.label = config.label
    this.logger = tryCreateSicpaContextLogger(config.logger, ['VTP'])
    this.valueTransferService = valueTransferService
    this.eventEmitter = eventEmitter
    this.giver = new Giver(
      {
        crypto: valueTransferCryptoService,
        storage: valueTransferStateService,
        transport: valueTransferTransportService,
        logger: tryCreateSicpaContextLogger(this.logger, ['Giver']),
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
    this.logger.info(`> Issuer ${this.label}: mint cash with`)

    // Get party public DID from the storage
    const publicDid = await this.valueTransferService.getPartyPublicDid()
    if (!publicDid) {
      throw new AriesFrameworkError('Public DID is not found')
    }

    // Call VTP library to start cash minting
    const { error, transaction, message } = await this.giver.startCashMinting(publicDid.did, amount, witness, send)
    if (error || !transaction || !message) {
      this.logger.error(`Issuer: Failed to mint cash: ${error?.message}`)
      return
    }

    if (awaitResponse) {
      // Await acknowledge from witness if requested
      await this.awaitCashMinted(timeoutMs)
    } else {
      // Complete cash minting without awaiting response
      const { error } = await this.giver.completeCashMinting(transaction.id)
      if (error) {
        this.logger.error(`  Issuer: Failed to mint cash: ${error?.message}`)
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
    this.logger.info(`> Issuer ${this.label}: process cash mint response ${messageContext.message.thid}`)

    // Call VTP library to complete cash minting
    const { error, transaction } = await this.giver.completeCashMinting(messageContext.message.thid)
    if (error || !transaction) {
      this.logger.error(`  Issuer: Failed to mint cash: ${error?.message}`)
      return
    }

    // Raise event
    this.eventEmitter.emit<CashMintedEvent>({
      type: ValueTransferEventTypes.CashMinted,
      payload: {},
    })

    this.logger.info(`< Issuer ${this.label}: process cash mint response ${messageContext.message.thid} completed!`)
  }
}
