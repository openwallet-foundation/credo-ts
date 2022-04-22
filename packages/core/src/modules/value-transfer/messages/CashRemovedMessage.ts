import { Equals } from "class-validator"

import { BaseMessage, BaseCommonMessageParams, ValueTransferBody } from "./BaseMessage"
import { MessageType } from "./MessageType"
import { PartyProof, Proof } from "../types"

export type CashRemovedMessageParams = BaseCommonMessageParams & {
    request: ValueTransferBody
    proof: Proof
    thid: string
}

export class CashRemovedMessage extends BaseMessage {
    public constructor({ from, to, request, proof, thid }: CashRemovedMessageParams) {
        const body = new ValueTransferBody({
            payment: request.payment,
            proofs: [new PartyProof({ party: from, proof })]
        })
        super({ from, to, body, thid })
    }

    @Equals(CashRemovedMessage.type)
    public readonly type = CashRemovedMessage.type
    public static readonly type = MessageType.GIVER_ROOF
}
