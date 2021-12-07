import { AgentMessage } from '../../../agent/AgentMessage'
import { Equals, IsOptional, IsString} from 'class-validator'
import { Expose} from 'class-transformer'
import { AckDecorator } from 'packages/core/src/decorators/ack/AckDecorator'

export interface RevocationNotificationMessageOptions{
    issueThread: string
    id?: string
    comment?: string
    pleaseAck?: AckDecorator
}

export class RevocationNotificationMessage extends AgentMessage{
    public constructor(options: RevocationNotificationMessageOptions){
        super()
        if(options){
            this.issueThread = options.issueThread
            this.id = options.id ?? this.generateId()
            this.comment = options.comment
            this.pleaseAck = options.pleaseAck
        }
    }

    
    @Equals(RevocationNotificationMessage.type)
    public readonly type = RevocationNotificationMessage.type
    public static readonly type = "https://didcomm.org/revocation_notification/1.0/revoke"

    @IsString()
    @IsOptional()
    public comment?: string

    @Expose({ name: 'thread_id' })
    @IsString()
    public issueThread?: string

}