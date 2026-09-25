import { Expose } from 'class-transformer'
import { IsInt, IsOptional, IsString } from 'class-validator'

import { DidCommMessage } from '../../../../../DidCommMessage'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'
import type { DidCommV2PlaintextMessage } from '../../../../../v2/types'

/**
 * BasicMessage 2.0 message.
 * @see https://didcomm.org/basicmessage/2.0/
 *
 * Works over both DIDComm v1 and v2 envelopes.
 * V2 format: id, type, lang, created_time (Unix epoch), body: { content }
 */
export class DidCommBasicMessageV2 extends DidCommMessage {
  public readonly allowDidSovPrefix = false

  /**
   * Create new DidCommBasicMessageV2 instance.
   *
   * @param options
   */
  public constructor(options: {
    content: string
    createdTime?: number
    id?: string
    lang?: string
    parentThreadId?: string
  }) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.content = options.content
      this.createdTime = options.createdTime ?? Math.floor(Date.now() / 1000)
      if (options.lang) this.lang = options.lang
      if (options.parentThreadId) this.setThread({ parentThreadId: options.parentThreadId })
    }
  }

  @IsValidMessageType(DidCommBasicMessageV2.type)
  public readonly type = DidCommBasicMessageV2.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/basicmessage/2.0/message')

  @Expose({ name: 'content' })
  @IsString()
  public content!: string

  @Expose({ name: 'created_time' })
  @IsInt()
  public createdTime!: number

  @Expose({ name: 'lang' })
  @IsString()
  @IsOptional()
  public lang?: string

  /**
   * Returns the message in DIDComm v2 plaintext format for v2 packing.
   * Used when packing BM 2.0 for DIDComm v2 envelope.
   */
  public toV2Plaintext(): DidCommV2PlaintextMessage {
    const v2: DidCommV2PlaintextMessage = {
      id: this.id,
      type: DidCommBasicMessageV2.type.messageTypeUri,
      created_time: this.createdTime,
      body: { content: this.content },
    }
    if (this.lang !== undefined) v2.lang = this.lang
    if (this.threadId) v2.thid = this.threadId
    if (this.thread?.parentThreadId) v2.pthid = this.thread.parentThreadId
    return v2
  }
}
