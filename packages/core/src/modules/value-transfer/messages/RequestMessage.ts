import { Equals } from "class-validator"

import { BaseMessage, BaseCommonMessageParams, ValueTransferBody } from "./BaseMessage"
import { MessageType } from "./MessageType"
import { Payment } from "../types"

export type RequestMessageParams = BaseCommonMessageParams & {
    payment: Payment
}

export class RequestMessage extends BaseMessage {
    public constructor({ from, to, payment }: RequestMessageParams) {
        const body = new ValueTransferBody({
            payment
        })
        super({ from, to, body })
    }

    @Equals(RequestMessage.type)
    public readonly type = RequestMessage.type
    public static readonly type = MessageType.REQUESTED
}
