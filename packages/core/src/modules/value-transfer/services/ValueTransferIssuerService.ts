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
  public async mintCash(amount: number, witness: string): Promise<MintMessage> {
    const publicDid = await this.didService.getPublicDid()
    if (!publicDid) {
      throw new AriesFrameworkError('Public DID is not found')
    }

    const mintedNotes = createVerifiableNotes(amount)

    // FIXME It will be better to use PartyState current/previous hash instead of returning transaction record on receiving notes
    // Will be possible after PartyState.previousHash fix in VTP lib
    const transactionRecord = await this.receiveNotes(mintedNotes)

    if (!transactionRecord) {
      throw new AriesFrameworkError('Got empty transaction record on receiving notes')
    }

    return new MintMessage({
      from: publicDid.did,
      to: witness,
      body: { startHash: transactionRecord.start, endHash: transactionRecord.end },
    })
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

      const { proof } = await this.valueTransfer.giver().startAddingNotes(notes)
      await this.valueTransfer.giver().commitTransaction()

      return new TransactionRecord({ start: proof.currentState || null, end: proof.nextState })
    } catch (e) {
      throw new AriesFrameworkError(`Unable to add verifiable notes. Err: ${e}`)
    }
  }
}
