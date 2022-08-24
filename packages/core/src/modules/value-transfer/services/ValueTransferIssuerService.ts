import type { VerifiableNote } from '@sicpa-dlab/value-transfer-protocol-ts'

import { createVerifiableNotes, TransactionRecord, ValueTransfer } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { AriesFrameworkError } from '../../../error'
import { DidService } from '../../dids/services/DidService'
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

  public constructor(
    config: AgentConfig,
    valueTransferService: ValueTransferService,
    valueTransferCryptoService: ValueTransferCryptoService,
    valueTransferStateService: ValueTransferStateService,
    didService: DidService
  ) {
    this.config = config
    this.valueTransferService = valueTransferService
    this.valueTransferCryptoService = valueTransferCryptoService
    this.valueTransferStateService = valueTransferStateService
    this.didService = didService
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
  public async mintCash(amount: number, witness: string): Promise<void> {
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

      // Commit transaction
      await this.valueTransfer.giver().commitTransaction()
    } catch (e) {
      // could not send message to witness or commit transaction
      await this.valueTransfer.giver().abortTransaction()
      throw e
    }
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
