import { createVerifiableNotes } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Lifecycle, scoped } from 'tsyringe'

import { AriesFrameworkError } from '../../../error'
import { DidService } from '../../dids/services/DidService'
import { MintMessage } from '../messages/MintMessage'

import { ValueTransferService } from './ValueTransferService'
import { ValueTransferStateService } from './ValueTransferStateService'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferIssuerService {
  private valueTransferService: ValueTransferService
  private valueTransferStateService: ValueTransferStateService
  private didService: DidService

  public constructor(
    valueTransferService: ValueTransferService,
    valueTransferStateService: ValueTransferStateService,
    didService: DidService
  ) {
    this.valueTransferService = valueTransferService
    this.valueTransferStateService = valueTransferStateService
    this.didService = didService
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
    const transactionRecord = await this.valueTransferService.receiveNotes(mintedNotes)

    if (!transactionRecord) {
      throw new AriesFrameworkError('Got empty transaction record on receiving notes')
    }

    return new MintMessage({
      from: publicDid.did,
      to: witness,
      body: { startHash: transactionRecord.start, endHash: transactionRecord.end },
    })
  }
}
