import { Equals } from "class-validator"

import { BaseMessage, BaseCommonMessageParams, ValueTransferBody } from "./BaseMessage"
import { MessageType } from "./MessageType"
import { PartyProof, Proof } from "../types"

export type RequestAcceptedMessageParams = BaseCommonMessageParams & {
    request: ValueTransferBody
    proof: Proof
    thid: string
}

export class RequestAcceptedMessage extends BaseMessage {
    public constructor({ from, to, request, proof, thid }: RequestAcceptedMessageParams) {
        const body = new ValueTransferBody({
            payment: request.payment,
            proofs: [new PartyProof({ party: from, proof })]
        })
        super({ from, to, body, thid })
    }

    @Equals(RequestAcceptedMessage.type)
    public readonly type = RequestAcceptedMessage.type
    public static readonly type = MessageType.ACCEPTED
}
