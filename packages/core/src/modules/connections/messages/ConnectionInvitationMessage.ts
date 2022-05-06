import { Transform } from 'class-transformer'
import { ArrayNotEmpty, Equals, IsArray, IsOptional, IsString, IsUrl, ValidateIf } from 'class-validator'
// eslint-disable-next-line import/no-extraneous-dependencies
import fetch from 'node-fetch'
import { parseUrl } from 'query-string'

import { AgentMessage } from '../../../agent/AgentMessage'
import { AriesFrameworkError } from '../../../error'
import { JsonEncoder } from '../../../utils/JsonEncoder'
import { JsonTransformer } from '../../../utils/JsonTransformer'
import { MessageValidator } from '../../../utils/MessageValidator'
import { replaceLegacyDidSovPrefix } from '../../../utils/messageType'

export interface BaseInvitationOptions {
  id?: string
  label: string
  imageUrl?: string
}

export interface InlineInvitationOptions {
  recipientKeys: string[]
  serviceEndpoint: string
  routingKeys?: string[]
}

export interface DIDInvitationOptions {
  did: string
}

/**
 * Message to invite another agent to create a connection
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0160-connection-protocol/README.md#0-invitation-to-connect
 */
export class ConnectionInvitationMessage extends AgentMessage {
  /**
   * Create new ConnectionInvitationMessage instance.
   * @param options
   */
  public constructor(options: BaseInvitationOptions & (DIDInvitationOptions | InlineInvitationOptions)) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.label = options.label
      this.imageUrl = options.imageUrl

      if (isDidInvitation(options)) {
        this.did = options.did
      } else {
        this.recipientKeys = options.recipientKeys
        this.serviceEndpoint = options.serviceEndpoint
        this.routingKeys = options.routingKeys
      }

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (options.did && (options.recipientKeys || options.routingKeys || options.serviceEndpoint)) {
        throw new AriesFrameworkError(
          'either the did or the recipientKeys/serviceEndpoint/routingKeys must be set, but not both'
        )
      }
    }
  }

  @Equals(ConnectionInvitationMessage.type)
  @Transform(({ value }) => replaceLegacyDidSovPrefix(value), {
    toClassOnly: true,
  })
  public readonly type = ConnectionInvitationMessage.type
  public static readonly type = 'https://didcomm.org/connections/1.0/invitation'

  @IsString()
  public label!: string

  @IsString()
  @ValidateIf((o: ConnectionInvitationMessage) => o.recipientKeys === undefined)
  public did?: string

  @IsString({
    each: true,
  })
  @IsArray()
  @ValidateIf((o: ConnectionInvitationMessage) => o.did === undefined)
  @ArrayNotEmpty()
  public recipientKeys?: string[]

  @IsString()
  @ValidateIf((o: ConnectionInvitationMessage) => o.did === undefined)
  public serviceEndpoint?: string

  @IsString({
    each: true,
  })
  @ValidateIf((o: ConnectionInvitationMessage) => o.did === undefined)
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
  public toUrl({ domain, useLegacyDidSovPrefix = false }: { domain: string; useLegacyDidSovPrefix?: boolean }) {
    const invitationJson = this.toJSON({ useLegacyDidSovPrefix })

    const encodedInvitation = JsonEncoder.toBase64URL(invitationJson)
    const invitationUrl = `${domain}?c_i=${encodedInvitation}`

    return invitationUrl
  }

  /**
   * Create a `ConnectionInvitationMessage` instance from the `c_i` or `d_m` parameter of an URL
   *
   * @param invitationUrl invitation url containing c_i or d_m parameter
   *
   * @throws Error when url can not be decoded to JSON, or decoded message is not a valid `ConnectionInvitationMessage`
   * @throws Error when the url is invalid encrypted url or shortened url is invalid
   */
  public static async fromUrl(invitationUrl: string) {
    const parsedUrl = parseUrl(invitationUrl).query
    const encodedInvitation = parsedUrl['c_i'] ?? parsedUrl['d_m']

    try {
      if (typeof encodedInvitation === 'string') {
        const invitationJson = JsonEncoder.fromBase64(encodedInvitation)
        const invitation = JsonTransformer.fromJSON(invitationJson, ConnectionInvitationMessage)

        await MessageValidator.validate(invitation)

        return invitation
      } else {
        throw new AriesFrameworkError(
          'InvitationUrl is invalid. Needs to be encrypted with either c_i or d_m or must be valid shortened URL'
        )
      }
    } catch (error) {
      return await this.fromShortUrl(invitationUrl)
    }
  }

  public static async fromShortUrl(invitationUrl: string) {
    // eslint-disable-next-line no-restricted-globals
    const abortController = new AbortController()
    const id = setTimeout(() => abortController.abort(), 15000)
    let response
    try {
      response = await fetch(invitationUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    } catch (error) {
      throw new AriesFrameworkError('Get request failed on provided Url')
    }
    clearTimeout(id)
    if (response) {
      if (response.headers.get('Content-Type') === 'application/json' && response.ok) {
        const inviatationJson = await response.json()
        const invitation = JsonTransformer.fromJSON(inviatationJson, ConnectionInvitationMessage)

        await MessageValidator.validate(invitation)

        return invitation
      } else if (response['url']) {
        const parsedUrl = parseUrl(response['url']).query
        const encodedInvitation = parsedUrl['c_i'] ?? parsedUrl['d_m']

        if (typeof encodedInvitation === 'string') {
          const invitationJson = JsonEncoder.fromBase64(encodedInvitation)
          const invitation = JsonTransformer.fromJSON(invitationJson, ConnectionInvitationMessage)

          await MessageValidator.validate(invitation)

          return invitation
        } else {
          throw new AriesFrameworkError(
            'InvitationUrl is invalid. Needs to be encrypted with either c_i or d_m or must be valid shortened URL'
          )
        }
      }
    }
    throw new AriesFrameworkError('HTTP request time out or did not receive valid response')
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
