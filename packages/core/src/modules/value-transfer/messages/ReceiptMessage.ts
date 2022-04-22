import { Equals } from "class-validator"

import { BaseMessage, BaseCommonMessageParams, ValueTransferBody, SigningMessage } from "./BaseMessage"
import { MessageType } from "./MessageType"
import { PartyProof, Payment, Signature } from "../types"
import { ErrorCodes, ValueTransferError } from "../error"

export type ReceiptMessageParams = BaseCommonMessageParams & {
    payment: Payment
    proofs: PartyProof[]
    signatures: Signature[]
    thid: string
}

export class ReceiptMessage extends BaseMessage implements SigningMessage {
    public constructor({ from, to, payment, proofs, signatures, thid }: ReceiptMessageParams) {
        const body = new ValueTransferBody({
            payment,
            proofs,
            signatures
        })
        super({ from, to, body, thid })
    }

    @Equals(ReceiptMessage.type)
    public readonly type = ReceiptMessage.type
    public static readonly type = MessageType.WITNESSED

    public signingPayload(): ValueTransferBody | Payment {
        return {
            ...this.body,
            signatures: this.body.signatures.filter((it) => it.party !== this.body.payment.witness)
        }
    }

    public signature(): Signature {
        const signature = this.body.signatures.find((it) => it.party === this.body.payment.witness)
        if (!signature) {
            throw new ValueTransferError(ErrorCodes.MissingSignature)
        }
        return signature
    }
}
