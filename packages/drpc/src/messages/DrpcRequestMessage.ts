import { AgentMessage, IsValidMessageType, parseMessageType } from '@credo-ts/didcomm'
import { Expose } from 'class-transformer'

import { IsValidDrpcRequest } from '../models'

export interface DrpcRequestObject {
  jsonrpc: string
  method: string
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  params?: any[] | object
  id: string | number | null
}

export type DrpcRequest = DrpcRequestObject | DrpcRequestObject[]

export class DrpcRequestMessage extends AgentMessage {
  public constructor(options: { request: DrpcRequest }) {
    super()
    if (options) {
      this.id = this.generateId()
      this.request = options.request
    }
  }

  @IsValidMessageType(DrpcRequestMessage.type)
  public readonly type = DrpcRequestMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/drpc/1.0/request')

  @Expose({ name: 'request' })
  @IsValidDrpcRequest()
  public request!: DrpcRequest
}
