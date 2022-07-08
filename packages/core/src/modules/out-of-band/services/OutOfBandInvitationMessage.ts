import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { Type } from 'class-transformer'
import { IsInstance, ValidateNested, Equals } from 'class-validator'

import { DIDCommV2Message } from '@aries-framework/core'

export enum OutOfBandGoalCode {
  makeConnection = 'make-connection',
}

export type OutOfBandInvitationParams = DIDCommV2MessageParams

export class OutOfBandInvitationBody {
  public goalCode!: OutOfBandGoalCode
}

export class OutOfBandInvitationMessage extends DIDCommV2Message {
  public constructor(options?: OutOfBandInvitationParams) {
    super(options)
  }

  @Type(() => OutOfBandInvitationBody)
  @ValidateNested()
  @IsInstance(OutOfBandInvitationBody)
  public body!: OutOfBandInvitationBody
  @Equals(OutOfBandInvitationMessage.type)
  public static readonly type = 'https://didcomm.org/out-of-band/2.0/invitation'
}
