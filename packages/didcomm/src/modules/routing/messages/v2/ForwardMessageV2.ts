import { Expose } from 'class-transformer'
import { IsArray, IsString } from 'class-validator'

import { DidCommMessage } from '../../../../DidCommMessage'
import type { DidCommEncryptedMessage } from '../../../../types'
import { IsValidMessageType, parseMessageType } from '../../../../util/messageType'

export interface DidCommForwardMessageV2Options {
  id?: string
  /** DIDs of the mediator(s) receiving this forward */
  to: string[]
  /** Next hop: DID or key identifier for the party to receive the attachment */
  next: string
  /** Encrypted payload(s) to forward (populated via ~attach when parsing) */
  attachments?: Array<{ id: string; data: { json?: DidCommEncryptedMessage } }>
}

/**
 * DIDComm v2 Forward message (routing/2.0/forward).
 * Uses body.next and attachments instead of v1's to (key) and msg.
 *
 * @see https://identity.foundation/didcomm-messaging/spec/v2.1/#routing-protocol
 */
export class DidCommForwardMessageV2 extends DidCommMessage {
  public readonly allowDidSovPrefix = true
  public readonly supportedDidCommVersions: ('v1' | 'v2')[] = ['v2']

  public constructor(options?: DidCommForwardMessageV2Options) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.to = options.to
      this.next = options.next
    }
  }

  @IsValidMessageType(DidCommForwardMessageV2.type)
  public readonly type = DidCommForwardMessageV2.type.messageTypeUri
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
}
