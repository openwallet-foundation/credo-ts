import { Expose } from "class-transformer"

import { BaseMessage, BaseCommonMessageParams, ValueTransferBody } from "./BaseMessage"
import { Error } from "../error"

export type RejectMessageParams = BaseCommonMessageParams & {
    request: ValueTransferBody
    rejectionReason: Error
    thid: string
}

export class RejectMessage extends BaseMessage {
    @Expose({ name: "rejectionReason" })
    public rejectionReason: Error

    public constructor({ from, to, request, rejectionReason, thid }: RejectMessageParams) {
        super({ from, to, body: request, thid })
        this.rejectionReason = rejectionReason
    }
}
