import { Expose } from "class-transformer";
import { Equals, IsArray, IsOptional } from "class-validator";
import { AgentMessage } from "../../../agent/AgentMessage";

export interface MessagesReceivedMessageOptions {
    id?: string,
    messageIdList: string[]
}

export class MessagesReceivedMessage extends AgentMessage {
    public constructor(options: MessagesReceivedMessageOptions) {
        super()

        if(options) {
            this.id = options.id || this.generateId()
            this.messageIdList = options.messageIdList
        }
    }

    @Equals(MessagesReceivedMessage.type)
    public readonly type = MessagesReceivedMessage.type
    public static readonly type = 'https://didcomm.org/messagepickup/2.0/messages-received'

    @IsArray()
    @IsOptional()
    @Expose({name: 'message_id_list'})
    public messageIdList?: string[]


}