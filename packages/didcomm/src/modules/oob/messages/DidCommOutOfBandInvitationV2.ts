import { CredoError, JsonEncoder, JsonTransformer } from '@credo-ts/core'
import { Expose } from 'class-transformer'
import { IsOptional, IsString } from 'class-validator'
import queryString from 'query-string'

import { DidCommMessage } from '../../../DidCommMessage'
import { DidCommAttachment } from '../../../decorators/attachment/DidCommAttachment'
import type { DidCommPlaintextMessage } from '../../../types'
import type { DidCommVersion } from '../../../util/didcommVersion'
import { IsValidMessageType, parseMessageType } from '../../../util/messageType'
import { normalizeV2PlaintextToV1 } from '../../../v2/normalize'
import { mapV1AttachmentToV2, mapV2AttachmentToV1 } from '../../../v2/plaintextBuilder'
import type { DidCommV2Attachment, DidCommV2PlaintextMessage } from '../../../v2/types'

const LINK_PARAM = '_oob'

export interface DidCommOutOfBandInvitationV2Body {
  goalCode?: string
  goal?: string
  accept?: string[]
}

export interface DidCommOutOfBandInvitationV2Options {
  id?: string
  from: string
  body?: DidCommOutOfBandInvitationV2Body
  attachments?: DidCommV2Attachment[]
}

/**
 * DIDComm v2 Out-of-Band Invitation (https://didcomm.org/out-of-band/2.0/invitation).
 * Wire structure: { type, id, from, body: { goal_code, goal, accept }, attachments? }.
 */
export class DidCommOutOfBandInvitationV2 extends DidCommMessage {
  public readonly allowDidSovPrefix = false
  public readonly supportedDidCommVersions: DidCommVersion[] = ['v2']

  public constructor(options?: DidCommOutOfBandInvitationV2Options) {
    super()
    if (options) {
      this.id = options.id ?? this.generateId()
      this.from = options.from
      this.goal = options.body?.goal
      this.goalCode = options.body?.goalCode
      this.accept = options.body?.accept
      if (options.attachments) {
        for (const v2Att of options.attachments) {
          this.addAppendedAttachment(JsonTransformer.fromJSON(mapV2AttachmentToV1(v2Att), DidCommAttachment))
        }
      }
    }
  }

  @IsValidMessageType(DidCommOutOfBandInvitationV2.type)
  public readonly type = DidCommOutOfBandInvitationV2.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/out-of-band/2.0/invitation')

  @IsString()
  public declare from: string

  @Expose({ name: 'goal' })
  @IsString()
  @IsOptional()
  public goal?: string

  @Expose({ name: 'goal_code' })
  @IsString()
  @IsOptional()
  public goalCode?: string

  @Expose({ name: 'accept' })
  @IsString({ each: true })
  @IsOptional()
  public accept?: string[]

  public get body(): DidCommOutOfBandInvitationV2Body | undefined {
    if (this.goal === undefined && this.goalCode === undefined && this.accept === undefined) return undefined
    return { goal: this.goal, goalCode: this.goalCode, accept: this.accept }
  }

  public get attachments(): DidCommV2Attachment[] | undefined {
    if (!this.appendedAttachments?.length) return undefined
    return this.appendedAttachments.map((att) =>
      mapV1AttachmentToV2(JsonTransformer.toJSON(att) as Record<string, unknown>)
    )
  }

  public toJSON(): DidCommPlaintextMessage {
    const attachments = this.attachments
    const wire = {
      type: DidCommOutOfBandInvitationV2.type.messageTypeUri,
      id: this.id,
      from: this.from,
      body: this.body
        ? {
            goal_code: this.goalCode,
            goal: this.goal,
            accept: this.accept,
          }
        : undefined,
      attachments,
    }
    return wire as unknown as DidCommPlaintextMessage
  }

  public toV2Plaintext(): DidCommV2PlaintextMessage {
    const body: Record<string, unknown> = {}
    if (this.goal !== undefined) body.goal = this.goal
    if (this.goalCode !== undefined) body.goal_code = this.goalCode
    if (this.accept !== undefined) body.accept = this.accept
    const plaintext: DidCommV2PlaintextMessage = {
      id: this.id,
      type: DidCommOutOfBandInvitationV2.type.messageTypeUri,
      from: this.from,
      body,
    }
    const attachments = this.attachments
    if (attachments) plaintext.attachments = attachments
    return plaintext
  }

  public toUrl({ domain }: { domain: string }): string {
    const encodedInvitation = JsonEncoder.toBase64Url(this.toJSON())
    return `${domain}?${LINK_PARAM}=${encodedInvitation}`
  }

  public static fromJson(json: Record<string, unknown>): DidCommOutOfBandInvitationV2 {
    return JsonTransformer.fromJSON(
      normalizeV2PlaintextToV1(json as DidCommV2PlaintextMessage),
      DidCommOutOfBandInvitationV2
    )
  }

  public static fromUrl(invitationUrl: string): DidCommOutOfBandInvitationV2 {
    const parsedUrl = queryString.parseUrl(invitationUrl).query
    const encodedInvitation = parsedUrl[LINK_PARAM]
    if (typeof encodedInvitation === 'string') {
      const invitationJson = JsonEncoder.fromBase64Url(encodedInvitation) as Record<string, unknown>
      return DidCommOutOfBandInvitationV2.fromJson(invitationJson)
    }
    throw new CredoError(
      'InvitationUrl is invalid. It needs to contain one, and only one, of the following parameters; `oob`'
    )
  }
}
