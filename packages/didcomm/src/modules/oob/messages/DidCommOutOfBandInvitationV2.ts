import { CredoError, JsonEncoder } from '@credo-ts/core'
import { Expose } from 'class-transformer'
import { IsOptional, IsString } from 'class-validator'
import queryString from 'query-string'

import { DidCommMessage } from '../../../DidCommMessage'
import type { DidCommPlaintextMessage } from '../../../types'
import type { DidCommVersion } from '../../../util/didcommVersion'
import { IsValidMessageType, parseMessageType } from '../../../util/messageType'
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
      this.attachments = options.attachments
    }
  }

  @IsValidMessageType(DidCommOutOfBandInvitationV2.type)
  public readonly type = DidCommOutOfBandInvitationV2.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/out-of-band/2.0/invitation')

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

  @Expose({ name: 'attachments' })
  @IsOptional()
  public attachments?: DidCommV2Attachment[]

  public get body(): DidCommOutOfBandInvitationV2Body | undefined {
    if (this.goal === undefined && this.goalCode === undefined && this.accept === undefined) return undefined
    return { goal: this.goal, goalCode: this.goalCode, accept: this.accept }
  }

  public toJSON(): DidCommPlaintextMessage {
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
      attachments: this.attachments && this.attachments.length > 0 ? this.attachments : undefined,
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
    if (this.attachments && this.attachments.length > 0) plaintext.attachments = this.attachments
    return plaintext
  }

  public toUrl({ domain }: { domain: string }): string {
    const encodedInvitation = JsonEncoder.toBase64Url(this.toJSON())
    return `${domain}?${LINK_PARAM}=${encodedInvitation}`
  }

  public static fromJson(json: Record<string, unknown>): DidCommOutOfBandInvitationV2 {
    const type = json.type as string
    if (type !== DidCommOutOfBandInvitationV2.type.messageTypeUri) {
      throw new CredoError(
        `Invalid v2 OOB invitation type: expected ${DidCommOutOfBandInvitationV2.type.messageTypeUri}, got ${type}`
      )
    }
    const id = json.id as string
    const from = json.from as string
    if (!from) {
      throw new CredoError('Invalid v2 OOB invitation: missing from')
    }
    const bodyJson = json.body as Record<string, unknown> | undefined
    const body = bodyJson
      ? {
          goalCode: bodyJson.goal_code as string | undefined,
          goal: bodyJson.goal as string | undefined,
          accept: bodyJson.accept as string[] | undefined,
        }
      : undefined
    const attachments = Array.isArray(json.attachments) ? (json.attachments as DidCommV2Attachment[]) : undefined
    return new DidCommOutOfBandInvitationV2({ id, from, body, attachments })
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
