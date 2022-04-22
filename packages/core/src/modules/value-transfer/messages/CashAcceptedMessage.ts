import { Equals } from "class-validator"

import { BaseCommonMessageParams, BaseMessage, ValueTransferBody } from "./BaseMessage"
import { MessageType } from "./MessageType"
import { PartyProof, Proof } from "../types"

export type CashAcceptedMessageParams = BaseCommonMessageParams & {
    request: ValueTransferBody
    proof: Proof
    thid: string
}

export class CashAcceptedMessage extends BaseMessage {
    public constructor({ from, to, request, proof, thid }: CashAcceptedMessageParams) {
        const body = new ValueTransferBody({
            payment: request.payment,
            proofs: [new PartyProof({ party: from, proof })]
        })
        super({ from, to, body, thid })
    }

    @Equals(CashAcceptedMessage.type)
    public readonly type = CashAcceptedMessage.type
    public static readonly type = MessageType.GETTER_PROOF
}
