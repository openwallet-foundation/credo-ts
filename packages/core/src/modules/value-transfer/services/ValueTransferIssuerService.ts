import type { CashMintedEvent } from '../ValueTransferEvents'
import type { MintResponseMessage } from '../messages/MintResponseMessage'
import type { InboundMessageContext } from '@aries-framework/core'
import type { VerifiableNote } from '@sicpa-dlab/value-transfer-protocol-ts'

import { createVerifiableNotes, TransactionRecord, ValueTransfer } from '@sicpa-dlab/value-transfer-protocol-ts'
import { firstValueFrom, ReplaySubject } from 'rxjs'
import { first, timeout } from 'rxjs/operators'
import { Lifecycle, scoped } from 'tsyringe'
import { v4 } from 'uuid'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../error'
import { DidService } from '../../dids/services/DidService'
import { ValueTransferEventTypes } from '../ValueTransferEvents'
import { MintMessage } from '../messages/MintMessage'

import { ValueTransferCryptoService } from './ValueTransferCryptoService'
import { ValueTransferService } from './ValueTransferService'
import { ValueTransferStateService } from './ValueTransferStateService'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferIssuerService {
  private config: AgentConfig
  private valueTransferService: ValueTransferService
  private valueTransferCryptoService: ValueTransferCryptoService
  private valueTransferStateService: ValueTransferStateService
  private didService: DidService
  private valueTransfer: ValueTransfer
  private eventEmitter: EventEmitter

  public constructor(
    config: AgentConfig,
    valueTransferService: ValueTransferService,
    valueTransferCryptoService: ValueTransferCryptoService,
    valueTransferStateService: ValueTransferStateService,
    didService: DidService,
    eventEmitter: EventEmitter
  ) {
    this.config = config
    this.valueTransferService = valueTransferService
    this.valueTransferCryptoService = valueTransferCryptoService
    this.valueTransferStateService = valueTransferStateService
    this.didService = didService
    this.eventEmitter = eventEmitter
    this.valueTransfer = new ValueTransfer(
      {
        crypto: this.valueTransferCryptoService,
        storage: this.valueTransferStateService,
      },
      {}
    )
  }

  /**
   * Mint (generate and receive) specified amount of Verifiable Notes.
   * @param amount Amount of cash to mint
   * @param witness DID of Witness to send mint message
   *
   * @returns Mint message for specified Witness DID
   */
  public async mintCash(amount: number, witness: string, timeoutMs = 20000): Promise<void> {
    const id = v4()
    this.config.logger.info(`> Issuer: mint cash with id ${id}`)

    const publicDid = await this.didService.getPublicDid()
    if (!publicDid) {
      throw new AriesFrameworkError('Public DID is not found')
    }
    if (this.config.valueTransferConfig?.witness) {
      throw new AriesFrameworkError(`Witness cannot add notes`)
    }

    // no notes to add
    if (!amount) return

    const state = await this.valueTransferStateService.getPartyState()

    const notes = createVerifiableNotes(amount)
    const { proof } = await this.valueTransfer.giver().startAddingNotes(notes)

    const start = state.wallet.previousHash ? proof.currentState : null
    const transactionRecord = new TransactionRecord({ start: start || null, end: proof.nextState })

    const message = new MintMessage({
      from: publicDid.did,
      to: witness,
      body: { startHash: transactionRecord.start, endHash: transactionRecord.end },
    })

    try {
      // Send mint message to Witness to update state
      await this.valueTransferService.sendMessage(message)

      this.config.logger.info(`> Issuer: await witness response for mint cash with id ${id}`)

      // await acknowledge from witness
      await this.awaitCashMinted(timeoutMs)

      this.config.logger.info(`> Issuer: mint cash with id ${id} completed!`)
    } catch (e) {
      // either could not send mint message to witness or did not receive response
      await this.valueTransfer.giver().abortTransaction()
      this.config.logger.info(`> Issuer: mint cash with id ${id} failed!`)
      throw e
    }
  }

  private async awaitCashMinted(timeoutMs = 20000): Promise<CashMintedEvent> {
    const observable = this.eventEmitter.observable<CashMintedEvent>(ValueTransferEventTypes.CashMinted)
    const subject = new ReplaySubject<CashMintedEvent>(1)
    observable.pipe(first(), timeout(timeoutMs)).subscribe(subject)
    return firstValueFrom(subject)
  }

  public async processCashMintResponse(messageContext: InboundMessageContext<MintResponseMessage>): Promise<void> {
    this.config.logger.info(`> Issuer: process cash mint response ${messageContext.message.thid}`)

    // Commit transaction and raise event
    const state = await this.valueTransferStateService.getPartyState()
    if (!state.proposedNextWallet) {
      return
    }

    await this.valueTransfer.giver().commitTransaction()
    this.eventEmitter.emit<CashMintedEvent>({
      type: ValueTransferEventTypes.CashMinted,
      payload: {},
    })

    this.config.logger.info(`< Issuer: process cash mint response ${messageContext.message.thid} completed!`)
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

      const state = await this.valueTransferStateService.getPartyState()

      const { proof } = await this.valueTransfer.giver().startAddingNotes(notes)
      await this.valueTransfer.giver().commitTransaction()

      const start = state.wallet.previousHash ? proof.currentState : null

      return new TransactionRecord({ start: start || null, end: proof.nextState })
    } catch (e) {
      throw new AriesFrameworkError(`Unable to add verifiable notes. Err: ${e}`)
    }
  }
}
