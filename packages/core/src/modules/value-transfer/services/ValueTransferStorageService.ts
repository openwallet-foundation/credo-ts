import type { ValueTransferRecord } from '../repository'

import { Lifecycle, scoped } from 'tsyringe'

import { ValueTransferRepository } from '../repository'
import { ReceiptMessage, State, StorageInterface } from "@value-transfer/value-transfer-lib";
import { ValueTransferStateRepository } from "../repository/ValueTransferStateRepository";

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferStorageService implements StorageInterface {
    private valueTransferRepository: ValueTransferRepository
    private valueTransferStateRepository: ValueTransferStateRepository

    public constructor(
        valueTransferRepository: ValueTransferRepository,
        valueTransferStateRepository: ValueTransferStateRepository
    ) {
        this.valueTransferRepository = valueTransferRepository
        this.valueTransferStateRepository = valueTransferStateRepository
    }

    async getState(): Promise<State> {
        return this.valueTransferStateRepository.getSingleByQuery({})
    }

    async storeState(state: State): Promise<void> {
        let record = await this.valueTransferStateRepository.getSingleByQuery({})
        record.verifiableNotes = state.verifiableNotes
        record.previousHash = state.previousHash
        record.stateAccumulator = state.stateAccumulator
        await this.valueTransferStateRepository.update(record)
    }

    async storeReceipt(request: ReceiptMessage): Promise<void> {
        const valueTransferRecord: ValueTransferRecord = await this.valueTransferRepository.getById(request.payload.payment.txId)
        valueTransferRecord.receipt = request
        await this.valueTransferRepository.update(valueTransferRecord)
    }
}
