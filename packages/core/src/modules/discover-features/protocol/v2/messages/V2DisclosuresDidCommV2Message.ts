import type { V2DisclosuresMessageOptions } from './V2DisclosuresMessageOptions'

import { Type } from 'class-transformer'
import { IsInstance, IsObject, ValidateNested } from 'class-validator'

import { Feature } from '../../../../../agent/models'
import { DidCommV2Message } from '../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'

class V2DisclosuresMessageBody {
  public constructor(options: { disclosures: Feature[] }) {
    if (options) {
      this.disclosures = options.disclosures
    }
  }
  @IsInstance(Feature, { each: true })
  @Type(() => Feature)
  public disclosures!: Feature[]
}

export class V2DisclosuresDidCommV2Message extends DidCommV2Message {
  public readonly allowDidSovPrefix = false

  public constructor(options: V2DisclosuresMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.body = new V2DisclosuresMessageBody({ disclosures: options.features ?? [] })

      if (options.threadId) {
        this.setThread({
          threadId: options.threadId,
        })
      }
    }
  }

  @IsValidMessageType(V2DisclosuresDidCommV2Message.type)
  public readonly type = V2DisclosuresDidCommV2Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/discover-features/2.0/disclosures')

  @IsObject()
  @ValidateNested()
  @Type(() => V2DisclosuresMessageBody)
  public body!: V2DisclosuresMessageBody

  public get disclosures() {
    return this.body.disclosures
  }
}
