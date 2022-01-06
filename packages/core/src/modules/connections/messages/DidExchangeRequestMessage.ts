import type { DidDoc } from '../models'

import { Expose, Type } from 'class-transformer'
import { Equals, IsString } from 'class-validator'

import { AgentMessage } from '../../../agent/AgentMessage'

import { Attachment, AttachmentData } from 'packages/core/src/decorators/attachment/Attachment'
import { JsonEncoder } from 'packages/core/src/utils/JsonEncoder'

export interface DidExchangeRequestMessageOptions {
  id?: string
  parentThreadId: string
  label: string
  goalCode?: string
  goal?: string
  did: string
  didDoc: DidDoc
}

/**
 * Message to communicate the DID document to the other agent when creating a connection
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/main/features/0023-did-exchange/README.md#1-exchange-request
 */
export class DidExchangeRequestMessage extends AgentMessage {
  /**
   * Create new DidExchangeRequestMessage instance.
   * @param options
   */
  public constructor(options: DidExchangeRequestMessageOptions) {
    super()

    this.id = options.id || this.generateId()
    this.label = options.label
    this.goalCode = options.goalCode
    this.goal = options.goal

    this.did = options.did
    this.didDoc =
      options.didDoc &&
      new Attachment({
        id: this.generateId(),
        mimeType: 'application/json',
        data: new AttachmentData({
          base64: JsonEncoder.toBase64(options.didDoc),
        }),
      })

    this.setThread({
      threadId: this.id,
      parentThreadId: options.parentThreadId,
    })
  }

  @Equals(DidExchangeRequestMessage.type)
  public readonly type = DidExchangeRequestMessage.type
  public static readonly type = 'https://didcomm.org/didexchange/1.0/request'

  @IsString()
  public readonly label?: string

  @Expose({ name: 'goal_code' })
  public readonly goalCode?: string

  @IsString()
  public readonly goal?: string

  @IsString()
  public readonly did: string

  @Expose({ name: 'did_doc~attach' })
  @Type(() => Attachment)
  public readonly didDoc?: Attachment
}
