import { CredoError, JsonEncoder, JsonTransformer } from '@credo-ts/core'
import { Transform } from 'class-transformer'
import { ArrayNotEmpty, IsArray, IsOptional, IsString, IsUrl, ValidateIf } from 'class-validator'
import queryString from 'query-string'
import { DidCommMessage } from '../../../DidCommMessage'
import type { DidCommAttachment } from '../../../decorators/attachment/DidCommAttachment'
import { IsValidMessageType, parseMessageType, replaceLegacyDidSovPrefix } from '../../../util/messageType'

export interface BaseInvitationOptions {
  id?: string
  label: string
  imageUrl?: string
  appendedAttachments?: DidCommAttachment[]
}

export interface InlineInvitationOptions {
  recipientKeys: string[]
  serviceEndpoint: string
  routingKeys?: string[]
}

export interface DIDInvitationOptions {
  did: string
}

export type DidCommConnectionInvitationMessageOptions = BaseInvitationOptions &
  (DIDInvitationOptions | InlineInvitationOptions)

/**
 * Message to invite another agent to create a connection
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0160-connection-protocol/README.md#0-invitation-to-connect
 */
export class DidCommConnectionInvitationMessage extends DidCommMessage {
  public readonly allowDidSovPrefix = true

  /**
   * Create new DidCommConnectionInvitationMessage instance.
   * @param options
   */
  public constructor(options: DidCommConnectionInvitationMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.label = options.label
      this.imageUrl = options.imageUrl
      this.appendedAttachments = options.appendedAttachments

      if (isDidInvitation(options)) {
        this.did = options.did
      } else {
        this.recipientKeys = options.recipientKeys
        this.serviceEndpoint = options.serviceEndpoint
        this.routingKeys = options.routingKeys
      }

      // @ts-expect-error
      if (options.did && (options.recipientKeys || options.routingKeys || options.serviceEndpoint)) {
        throw new CredoError(
          'either the did or the recipientKeys/serviceEndpoint/routingKeys must be set, but not both'
        )
      }
    }
  }

  @IsValidMessageType(DidCommConnectionInvitationMessage.type)
  @Transform(({ value }) => replaceLegacyDidSovPrefix(value), {
    toClassOnly: true,
  })
  public readonly type = DidCommConnectionInvitationMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/connections/1.0/invitation')

  @IsString()
  public label!: string

  @IsString()
  @ValidateIf((o: DidCommConnectionInvitationMessage) => o.recipientKeys === undefined)
  public did?: string

  @IsString({
    each: true,
  })
  @IsArray()
  @ValidateIf((o: DidCommConnectionInvitationMessage) => o.did === undefined)
  @ArrayNotEmpty()
  public recipientKeys?: string[]

  @IsString()
  @ValidateIf((o: DidCommConnectionInvitationMessage) => o.did === undefined)
  public serviceEndpoint?: string

  @IsString({
    each: true,
  })
  @ValidateIf((o: DidCommConnectionInvitationMessage) => o.did === undefined)
  @IsOptional()
  public routingKeys?: string[]

  @IsOptional()
  @IsUrl()
  public imageUrl?: string

  /**
   * Create an invitation url from this instance
   *
   * @param domain domain name to use for invitation url
   * @returns invitation url with base64 encoded invitation
   */
  public toUrl({
    domain,
    useDidSovPrefixWhereAllowed = false,
  }: {
    domain: string
    useDidSovPrefixWhereAllowed?: boolean
  }) {
    const invitationJson = this.toJSON({ useDidSovPrefixWhereAllowed })

    const encodedInvitation = JsonEncoder.toBase64URL(invitationJson)
    const invitationUrl = `${domain}?c_i=${encodedInvitation}`

    return invitationUrl
  }

  /**
   * Create a `DidCommConnectionInvitationMessage` instance from the `c_i` or `d_m` parameter of an URL
   *
   * @param invitationUrl invitation url containing c_i or d_m parameter
   *
   * @throws Error when the url can not be decoded to JSON, or decoded message is not a valid 'DidCommConnectionInvitationMessage'
   */
  public static fromUrl(invitationUrl: string) {
    const parsedUrl = queryString.parseUrl(invitationUrl).query
    const encodedInvitation = parsedUrl.c_i ?? parsedUrl.d_m
    if (typeof encodedInvitation === 'string') {
      const invitationJson = JsonEncoder.fromBase64(encodedInvitation)
      const invitation = JsonTransformer.fromJSON(invitationJson, DidCommConnectionInvitationMessage)

      return invitation
    }
    throw new CredoError('InvitationUrl is invalid. Needs to be encoded with either c_i, d_m, or oob')
  }
}

/**
 * Check whether an invitation is a `DIDInvitationData` object
 *
 * @param invitation invitation object
 */
function isDidInvitation(
  invitation: InlineInvitationOptions | DIDInvitationOptions
): invitation is DIDInvitationOptions {
  return (invitation as DIDInvitationOptions).did !== undefined
}
