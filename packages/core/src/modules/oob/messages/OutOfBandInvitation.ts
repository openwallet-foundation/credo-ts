import type { PlaintextMessage } from '../../../types'
import type { HandshakeProtocol } from '../../connections'
import type { Key } from '../../dids'

import { Expose, Transform, TransformationType, Type } from 'class-transformer'
import { ArrayNotEmpty, IsArray, IsInstance, IsOptional, IsUrl, ValidateNested } from 'class-validator'
// eslint-disable-next-line import/no-extraneous-dependencies
import fetch from 'node-fetch'
import { parseUrl } from 'query-string'

import { AgentMessage } from '../../../agent/AgentMessage'
import { Attachment, AttachmentData } from '../../../decorators/attachment/Attachment'
import { AriesFrameworkError } from '../../../error'
import { JsonEncoder } from '../../../utils/JsonEncoder'
import { JsonTransformer } from '../../../utils/JsonTransformer'
import { MessageValidator } from '../../../utils/MessageValidator'
import { IsValidMessageType, parseMessageType, replaceLegacyDidSovPrefix } from '../../../utils/messageType'
import { IsStringOrInstance } from '../../../utils/validators'
import { DidKey } from '../../dids'
import { outOfBandServiceToNumAlgo2Did } from '../../dids/methods/peer/peerDidNumAlgo2'
import { OutOfBandDidCommService } from '../domain/OutOfBandDidCommService'

export interface OutOfBandInvitationOptions {
  id?: string
  label: string
  goalCode?: string
  goal?: string
  accept?: string[]
  handshakeProtocols?: HandshakeProtocol[]
  services: Array<OutOfBandDidCommService | string>
  imageUrl?: string
}

export class OutOfBandInvitation extends AgentMessage {
  public constructor(options: OutOfBandInvitationOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.label = options.label
      this.goalCode = options.goalCode
      this.goal = options.goal
      this.accept = options.accept
      this.handshakeProtocols = options.handshakeProtocols
      this.services = options.services
      this.imageUrl = options.imageUrl
    }
  }

  public addRequest(message: AgentMessage) {
    if (!this.requests) this.requests = []
    const requestAttachment = new Attachment({
      id: this.generateId(),
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(message.toJSON()),
      }),
    })
    this.requests.push(requestAttachment)
  }

  public getRequests(): PlaintextMessage[] | undefined {
    return this.requests?.map((request) => request.getDataAsJson())
  }

  public toUrl({ domain }: { domain: string }) {
    const invitationJson = this.toJSON()
    const encodedInvitation = JsonEncoder.toBase64URL(invitationJson)
    const invitationUrl = `${domain}?oob=${encodedInvitation}`
    return invitationUrl
  }

  public static async fromUrl(invitationUrl: string) {
    const parsedUrl = parseUrl(invitationUrl).query
    const encodedInvitation = parsedUrl['oob']
    try {
      if (typeof encodedInvitation === 'string') {
        const invitationJson = JsonEncoder.fromBase64(encodedInvitation)
        const invitation = this.fromJson(invitationJson)

        return invitation
      } else {
        throw new AriesFrameworkError(
          'InvitationUrl is invalid. It needs to contain one, and only one, of the following parameters; `oob`'
        )
      }
    } catch (error) {
      return await this.fromShortUrl(invitationUrl)
    }
  }
  //This currently does not follow the RFC because of issues with fetch, currently uses a janky work around
  public static async fromShortUrl(invitationUrl: string) {
    // eslint-disable-next-line no-restricted-globals
    const abortController = new AbortController()
    const id = setTimeout(() => abortController.abort(), 15000)
    let response
    try {
      response = await fetch(invitationUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      })
    } catch (error) {
      throw new AriesFrameworkError('Get request failed on provided Url')
    }
    clearTimeout(id)
    if (response) {
      if (response.headers.get('Content-Type') === 'application/json' && response.ok) {
        const inviatationJson = await response.json()
        const invitation = this.fromJson(inviatationJson)

        await MessageValidator.validate(invitation)

        return invitation
      } else if (response['url']) {
        const parsedUrl = parseUrl(response['url']).query
        const encodedInvitation = parsedUrl['oob']

        if (typeof encodedInvitation === 'string') {
          const invitationJson = JsonEncoder.fromBase64(encodedInvitation)
          const invitation = this.fromJson(invitationJson)

          await MessageValidator.validate(invitation)

          return invitation
        } else {
          throw new AriesFrameworkError(
            'InvitationUrl is invalid. Needs to be encrypted with either c_i, d_m, or oob or must be valid shortened URL'
          )
        }
      }
    }
    throw new AriesFrameworkError('HTTP request time out or did not receive valid response')
  }

  public static async fromJson(json: Record<string, unknown>) {
    const invitation = JsonTransformer.fromJSON(json, OutOfBandInvitation)
    await MessageValidator.validate(invitation)
    return invitation
  }

  public get invitationDids() {
    const dids = this.services.map((didOrService) => {
      if (typeof didOrService === 'string') {
        return didOrService
      }
      return outOfBandServiceToNumAlgo2Did(didOrService)
    })
    return dids
  }

  // TODO: this only takes into account inline didcomm services, won't work for public dids
  public getRecipientKeys(): Key[] {
    return this.services
      .filter((s): s is OutOfBandDidCommService => typeof s !== 'string' && !(s instanceof String))
      .map((s) => s.recipientKeys)
      .reduce((acc, curr) => [...acc, ...curr], [])
      .map((didKey) => DidKey.fromDid(didKey).key)
  }

  @Transform(({ value }) => replaceLegacyDidSovPrefix(value), {
    toClassOnly: true,
  })
  @IsValidMessageType(OutOfBandInvitation.type)
  public readonly type = OutOfBandInvitation.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/out-of-band/1.1/invitation')

  public readonly label!: string

  @Expose({ name: 'goal_code' })
  public readonly goalCode?: string

  public readonly goal?: string

  public readonly accept?: string[]
  @Transform(({ value }) => value.map(replaceLegacyDidSovPrefix), { toClassOnly: true })
  @Expose({ name: 'handshake_protocols' })
  public handshakeProtocols?: HandshakeProtocol[]

  @Expose({ name: 'requests~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(Attachment, { each: true })
  @IsOptional()
  private requests?: Attachment[]

  @IsArray()
  @ArrayNotEmpty()
  @OutOfBandServiceTransformer()
  @IsStringOrInstance(OutOfBandDidCommService, { each: true })
  @ValidateNested({ each: true })
  public services!: Array<OutOfBandDidCommService | string>

  /**
   * Custom property. It is not part of the RFC.
   */
  @IsOptional()
  @IsUrl()
  public readonly imageUrl?: string
}

/**
 * Decorator that transforms authentication json to corresponding class instances
 *
 * @example
 * class Example {
 *   VerificationMethodTransformer()
 *   private authentication: VerificationMethod
 * }
 */
function OutOfBandServiceTransformer() {
  return Transform(({ value, type }: { value: Array<string | { type: string }>; type: TransformationType }) => {
    if (type === TransformationType.PLAIN_TO_CLASS) {
      return value.map((service) => {
        // did
        if (typeof service === 'string') return new String(service)

        // inline didcomm service
        return JsonTransformer.fromJSON(service, OutOfBandDidCommService)
      })
    } else if (type === TransformationType.CLASS_TO_PLAIN) {
      return value.map((service) =>
        typeof service === 'string' || service instanceof String ? service.toString() : JsonTransformer.toJSON(service)
      )
    }

    // PLAIN_TO_PLAIN
    return value
  })
}
