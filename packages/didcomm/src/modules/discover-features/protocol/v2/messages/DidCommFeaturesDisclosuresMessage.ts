import { JsonTransformer } from '@credo-ts/core'
import { Type } from 'class-transformer'
import { IsInstance } from 'class-validator'

import { DidCommMessage } from '../../../../../DidCommMessage'
import { DidCommFeature } from '../../../../../models'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'
import type { DidCommV2PlaintextMessage } from '../../../../../v2/types'

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

  // DIDComm v2 names this message disclose (spec v2.1 disclose Message Type)
  public toV2Plaintext(): DidCommV2PlaintextMessage {
    const v2: DidCommV2PlaintextMessage = {
      id: this.id,
      type: 'https://didcomm.org/discover-features/2.0/disclose',
      body: { disclosures: JsonTransformer.toJSON(this).disclosures },
    }
    if (this.thread?.threadId) v2.thid = this.thread.threadId
    if (this.thread?.parentThreadId) v2.pthid = this.thread.parentThreadId
    if (this.transport?.returnRoute) v2.return_route = this.transport.returnRoute
    return v2
  }
}
