import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { Expose } from 'class-transformer'
import { Equals, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'

export interface OutOfBandInvitationBody {
  label?: string
  imageUrl?: string
  goalCode?: string
  accept?: string[]
}

type OutOfBandInvitationOptions = DIDCommV2MessageParams & {
  body: OutOfBandInvitationBody
}

export class OutOfBandInvitationMessage extends DIDCommV2Message {
  public constructor(options: OutOfBandInvitationOptions) {
    super(options)
  }

  @Equals(OutOfBandInvitationMessage.type)
  public readonly type = OutOfBandInvitationMessage.type
  public static readonly type = 'https://didcomm.org/out-of-band/2.0/invitation'

  @Expose({ name: 'body' })
  @ValidateNested()
  public body!: OutOfBandInvitationBody
}
