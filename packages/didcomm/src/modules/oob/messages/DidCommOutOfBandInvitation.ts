import type { PlaintextDidCommMessage } from '../../../types'

import { CredoError, IsStringOrInstance, JsonEncoder, JsonTransformer } from '@credo-ts/core'
import { Exclude, Expose, Transform, TransformationType, Type } from 'class-transformer'
import { ArrayNotEmpty, IsArray, IsInstance, IsOptional, IsUrl, ValidateNested } from 'class-validator'
import { parseUrl } from 'query-string'

import { DidCommMessage } from '../../../DidCommMessage'
import { DidCommAttachment, DidCommAttachmentData } from '../../../decorators/attachment/DidCommAttachment'
import { IsValidMessageType, parseMessageType, replaceLegacyDidSovPrefix } from '../../../util/messageType'
import { OutOfBandDidCommService } from '../domain/OutOfBandDidCommService'
import { outOfBandServiceToNumAlgo2Did } from '../helpers'

export interface DidCommOutOfBandInvitationOptions {
  id?: string
  label?: string
  goalCode?: string
  goal?: string
  accept?: string[]
  handshakeProtocols?: string[]
  services: Array<OutOfBandDidCommService | string>
  imageUrl?: string
  appendedAttachments?: DidCommAttachment[]
}

export class DidCommOutOfBandInvitation extends DidCommMessage {
  public constructor(options: DidCommOutOfBandInvitationOptions) {
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
      this.appendedAttachments = options.appendedAttachments
    }
  }

  /**
   * The original type of the invitation. This is not part of the RFC, but allows to identify
   * from what the oob invitation was originally created (e.g. legacy connectionless invitation).
   */
  @Exclude()
  public invitationType?: InvitationType

  public addRequest(message: DidCommMessage) {
    if (!this.requests) this.requests = []
    const requestAttachment = new DidCommAttachment({
      id: this.generateId(),
      mimeType: 'application/json',
      data: new DidCommAttachmentData({
        base64: JsonEncoder.toBase64(message.toJSON()),
      }),
    })
    this.requests.push(requestAttachment)
  }

  public getRequests(): PlaintextDidCommMessage[] | undefined {
    return this.requests?.map((request) => request.getDataAsJson())
  }

  public toUrl({ domain }: { domain: string }) {
    const invitationJson = this.toJSON()
    const encodedInvitation = JsonEncoder.toBase64URL(invitationJson)
    const invitationUrl = `${domain}?oob=${encodedInvitation}`
    return invitationUrl
  }

  public static fromUrl(invitationUrl: string) {
    const parsedUrl = parseUrl(invitationUrl).query
    const encodedInvitation = parsedUrl.oob
    if (typeof encodedInvitation === 'string') {
      const invitationJson = JsonEncoder.fromBase64(encodedInvitation)
      const invitation = DidCommOutOfBandInvitation.fromJson(invitationJson)

      return invitation
    }
    throw new CredoError(
      'InvitationUrl is invalid. It needs to contain one, and only one, of the following parameters; `oob`'
    )
  }

  public static fromJson(json: Record<string, unknown>) {
    return JsonTransformer.fromJSON(json, DidCommOutOfBandInvitation)
  }

  public get invitationDids() {
    const dids = this.getServices().map((didOrService) => {
      if (typeof didOrService === 'string') {
        return didOrService
      }
      return outOfBandServiceToNumAlgo2Did(didOrService)
    })
    return dids
  }

  // shorthand for services without the need to deal with the String DIDs
  public getServices(): Array<OutOfBandDidCommService | string> {
    return this.services.map((service) => {
      if (service instanceof String) return service.toString()
      return service
    })
  }
  public getDidServices(): Array<string> {
    return this.getServices().filter((service): service is string => typeof service === 'string')
  }
  public getInlineServices(): Array<OutOfBandDidCommService> {
    return this.getServices().filter((service): service is OutOfBandDidCommService => typeof service !== 'string')
  }

  @Transform(({ value }) => replaceLegacyDidSovPrefix(value), {
    toClassOnly: true,
  })
  @IsValidMessageType(DidCommOutOfBandInvitation.type)
  public readonly type = DidCommOutOfBandInvitation.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/out-of-band/1.1/invitation')

  public readonly label?: string

  @Expose({ name: 'goal_code' })
  public readonly goalCode?: string

  public readonly goal?: string

  public readonly accept?: string[]
  @Transform(({ value }) => value?.map(replaceLegacyDidSovPrefix), { toClassOnly: true })
  @Expose({ name: 'handshake_protocols' })
  public handshakeProtocols?: string[]

  @Expose({ name: 'requests~attach' })
  @Type(() => DidCommAttachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(DidCommAttachment, { each: true })
  @IsOptional()
  private requests?: DidCommAttachment[]

  @IsArray()
  @ArrayNotEmpty()
  @OutOfBandServiceTransformer()
  @IsStringOrInstance(OutOfBandDidCommService, { each: true })
  private services!: Array<OutOfBandDidCommService | string | string>

  /**
   * Custom property. It is not part of the RFC.
   */
  @IsOptional()
  @IsUrl()
  public readonly imageUrl?: string
}

/**
 * Decorator that transforms services json to corresponding class instances
 * @note Because of ValidateNested limitation, this produces instances of String for DID services except plain js string
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
    }
    if (type === TransformationType.CLASS_TO_PLAIN) {
      return value.map((service) =>
        typeof service === 'string' || service instanceof String ? service.toString() : JsonTransformer.toJSON(service)
      )
    }

    // PLAIN_TO_PLAIN
    return value
  })
}

/**
 * The original invitation an out of band invitation was derived from.
 */
export enum InvitationType {
  OutOfBand = 'out-of-band/1.x',
  Connection = 'connections/1.x',
  Connectionless = 'connectionless',
}
