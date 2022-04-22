import { Equals } from "class-validator"

import { MessageType } from "./MessageType"
import { RejectMessage, RejectMessageParams } from "./RejectMessage"

export class GiverRejectMessage extends RejectMessage {
    public constructor(params: RejectMessageParams) {
        super(params)
    }

    @Equals(GiverRejectMessage.type)
    public readonly type = GiverRejectMessage.type
    public static readonly type = MessageType.GIVER_REJECTED
}
