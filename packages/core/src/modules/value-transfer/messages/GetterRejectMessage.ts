import { Equals } from "class-validator"

import { MessageType } from "./MessageType"
import { RejectMessage, RejectMessageParams } from "./RejectMessage"

export class GetterRejectMessage extends RejectMessage {
    public constructor(params: RejectMessageParams) {
        super(params)
    }

    @Equals(GetterRejectMessage.type)
    public readonly type = GetterRejectMessage.type
    public static readonly type = MessageType.GETTER_REJECTED
}
