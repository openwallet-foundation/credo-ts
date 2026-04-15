import { Expose } from 'class-transformer'
import { IsArray, IsString } from 'class-validator'

import { utils } from '@credo-ts/core'
import { DidCommMessage } from '../../../../../DidCommMessage'
import type { DidCommEncryptedMessage } from '../../../../../types'
import type { DidCommVersion } from '../../../../../util/didcommVersion'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'
import type { DidCommV2Attachment, DidCommV2PlaintextMessage } from '../../../../../v2/types'

export interface DidCommForwardV2MessageOptions {
  id?: string
  /** DIDs of the mediator(s) receiving this forward */
  to: string[]
  /** Next hop: DID or key identifier for the party to receive the attachment */
  next: string
  /** Encrypted payload(s) to forward (populated via ~attach when parsing) */
  attachments?: Array<{ id: string; data: { json?: DidCommEncryptedMessage } }>
}

/**
 * Options for building an outbound routing/2.0/forward plaintext message.
 */
export interface DidCommForwardV2PlaintextOptions {
  id?: string
  /** DIDs of the mediator(s) receiving this forward (e.g. first hop) */
  to: string[]
  /** Next hop: DID or key identifier for the party to receive the attached payload */
  next: string
  /** Payload(s) to forward; encrypted for the `next` recipient */
  attachments: DidCommV2Attachment[]
  expiresTime?: number
}

/**
 * DIDComm v2 Forward message (routing/2.0/forward).
 * Uses body.next and attachments instead of v1's to (key) and msg.
 *
 * @see https://identity.foundation/didcomm-messaging/spec/v2.1/#routing-protocol
 */
export class DidCommForwardV2Message extends DidCommMessage {
  public readonly allowDidSovPrefix = true
  public readonly supportedDidCommVersions: DidCommVersion[] = ['v2']

  public constructor(options?: DidCommForwardV2MessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.to = options.to
      this.next = options.next
    }
  }

  @IsValidMessageType(DidCommForwardV2Message.type)
  public readonly type = DidCommForwardV2Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/routing/2.0/forward')

  @IsArray()
  @IsString({ each: true })
  public to!: string[]

  @Expose({ name: 'next' })
  @IsString()
  public next!: string

  /** Extract the encrypted message from the first attachment (for mediator forwarding). Uses parent's appendedAttachments (~attach). */
  public getMessage(): DidCommEncryptedMessage | null {
    const att = this.appendedAttachments?.[0]
    if (!att) return null
    try {
      return att.getDataAsJson<DidCommEncryptedMessage>()
    } catch {
      return null
    }
  }

  /**
   * Build a DIDComm v2 Forward plaintext message for outbound mediator wrapping.
   * The outer envelope is anoncrypt; this returns the plaintext JSON to be packed.
   */
  public static createV2PlaintextMessage(options: DidCommForwardV2PlaintextOptions): DidCommV2PlaintextMessage {
    const { id, to, next, attachments, expiresTime } = options
    const msg: DidCommV2PlaintextMessage = {
      id: id ?? utils.uuid(),
      type: DidCommForwardV2Message.type.messageTypeUri,
      to,
      body: { next },
      attachments,
    }
    if (expiresTime !== undefined) msg.expires_time = expiresTime
    return msg
  }
}
