import { Equals } from "class-validator"

import { MessageType } from "./MessageType"
import { RejectMessage, RejectMessageParams } from "./RejectMessage"

export class WitnessRejectMessage extends RejectMessage {
    public constructor(params: RejectMessageParams) {
        super(params)
    }

    @Equals(WitnessRejectMessage.type)
    public readonly type = WitnessRejectMessage.type
    public static readonly type = MessageType.WITNESS_REJECTED
}
