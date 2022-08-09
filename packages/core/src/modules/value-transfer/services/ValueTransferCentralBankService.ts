import { createVerifiableNotes } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Lifecycle, scoped } from 'tsyringe'

import { AriesFrameworkError } from '../../../error'
import { DidService } from '../../dids/services/DidService'
import { MintMessage } from '../messages/MintMessage'

import { ValueTransferService } from './ValueTransferService'
import { ValueTransferStateService } from './ValueTransferStateService'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferCentralBankService {
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

  public async mintCash(amount: number, witness: string): Promise<MintMessage> {
    const publicDid = await this.didService.getPublicDid()
    if (!publicDid) {
      throw new AriesFrameworkError('Public DID is not found')
    }

    const mintedNotes = createVerifiableNotes(amount)
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
