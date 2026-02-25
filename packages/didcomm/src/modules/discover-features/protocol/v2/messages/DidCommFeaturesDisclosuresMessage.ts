import { Type } from 'class-transformer'
import { IsInstance } from 'class-validator'

import { DidCommMessage } from '../../../../../DidCommMessage'
import { DidCommFeature } from '../../../../../models'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'

export interface DidCommFeaturesDisclosuresMessageOptions {
  id?: string
  threadId?: string
  features?: DidCommFeature[]
}

export class DidCommFeaturesDisclosuresMessage extends DidCommMessage {
  public constructor(options: DidCommFeaturesDisclosuresMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.disclosures = options.features ?? []
      if (options.threadId) {
        this.setThread({
          threadId: options.threadId,
        })
      }
    }
  }

  @IsValidMessageType(DidCommFeaturesDisclosuresMessage.type)
  public readonly type = DidCommFeaturesDisclosuresMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/discover-features/2.0/disclosures')

  @IsInstance(DidCommFeature, { each: true })
  @Type(() => DidCommFeature)
  public disclosures!: DidCommFeature[]
}
