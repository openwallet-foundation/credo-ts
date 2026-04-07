import { CredoError, JsonEncoder, utils } from '@credo-ts/core'
import queryString from 'query-string'

const LINK_PARAM = 'oob'

export interface DidCommOutOfBandInvitationV2Body {
  goalCode?: string
  goal?: string
  accept?: string[]
}

export interface DidCommOutOfBandInvitationV2Options {
  id?: string
  from: string
  body?: DidCommOutOfBandInvitationV2Body
}

/**
 * DIDComm v2 Out-of-Band Invitation (https://didcomm.org/out-of-band/2.0/invitation).
 * Structure: { type, id, from, body: { goal_code, goal, accept } }
 */
export class DidCommOutOfBandInvitationV2 {
  public static readonly type = 'https://didcomm.org/out-of-band/2.0/invitation'

  public id!: string
  public from!: string
  public body?: DidCommOutOfBandInvitationV2Body

  public constructor(options?: DidCommOutOfBandInvitationV2Options) {
    if (options) {
      this.id = options.id ?? utils.uuid()
      this.from = options.from
      this.body = options.body
    }
  }

  public toJSON(): Record<string, unknown> {
    return {
      type: DidCommOutOfBandInvitationV2.type,
      id: this.id,
      from: this.from,
      body: this.body
        ? {
            goal_code: this.body.goalCode,
            goal: this.body.goal,
            accept: this.body.accept,
          }
        : undefined,
    }
  }

  public toUrl({ domain }: { domain: string }): string {
    const invitationJson = this.toJSON()
    const encodedInvitation = JsonEncoder.toBase64Url(invitationJson)
    return `${domain}?${LINK_PARAM}=${encodedInvitation}`
  }

  public static fromJson(json: Record<string, unknown>): DidCommOutOfBandInvitationV2 {
    const type = json.type as string
    if (type !== DidCommOutOfBandInvitationV2.type) {
      throw new CredoError(
        `Invalid v2 OOB invitation type: expected ${DidCommOutOfBandInvitationV2.type}, got ${type}`
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
    return new DidCommOutOfBandInvitationV2({ id, from, body })
  }

  public static fromUrl(invitationUrl: string): DidCommOutOfBandInvitationV2 {
    const parsedUrl = queryString.parseUrl(invitationUrl).query
    const encodedInvitation = parsedUrl[LINK_PARAM]
    if (typeof encodedInvitation === 'string') {
      const invitationJson = JsonEncoder.fromBase64(encodedInvitation) as Record<string, unknown>
      return DidCommOutOfBandInvitationV2.fromJson(invitationJson)
    }
    throw new CredoError(
      'InvitationUrl is invalid. It needs to contain one, and only one, of the following parameters; `oob`'
    )
  }
}
