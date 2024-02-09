import { Expose } from 'class-transformer'

import { AgentMessage } from '../../../agent/AgentMessage'
import {
  IsValidDRPCRequest,
  IsValidDRPCResponse,
  IsValidMessageType,
  parseMessageType,
} from '../../../utils/messageType'

export interface DRPCRequestObject {
  jsonrpc: string
  method: string
  params?: any[] | object
  id: string | number | null
}

export enum DRPCErrorCode {
  METHOD_NOT_FOUND = -32601,
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  SERVER_ERROR = -32000,
}

export type DRPCRequest = DRPCRequestObject | DRPCRequestObject[]
export type DRPCResponse = DRPCResponseObject | (DRPCResponseObject | Record<string, never>)[] | Record<string, never>

export interface DRPCResponseError {
  code: DRPCErrorCode
  message: string
  data?: any
}

export interface DRPCResponseObject {
  jsonrpc: string
  result?: any
  error?: DRPCResponseError
  id: string | number | null
}

export class DRPCRequestMessage extends AgentMessage {
  public readonly allowDidSovPrefix = true

  /**
   * Create new BasicMessage instance.
   * sentTime will be assigned to new Date if not passed, id will be assigned to uuid/v4 if not passed
   * @param options
   */
  public constructor(options: { request: DRPCRequest }, messageId?: string) {
    super()

    if (options) {
      this.id = messageId ?? this.generateId()
      this.request = options.request
    }
  }

  @IsValidMessageType(DRPCRequestMessage.type)
  public readonly type = DRPCRequestMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/drpc/1.0/request')

  @Expose({ name: 'request' })
  @IsValidDRPCRequest()
  public request!: DRPCRequest
}

export class DRPCResponseMessage extends AgentMessage {
  public readonly allowDidSovPrefix = true

  /**
   * Create new BasicMessage instance.
   * sentTime will be assigned to new Date if not passed, id will be assigned to uuid/v4 if not passed
   * @param options
   */
  public constructor(options: { response: DRPCResponse }, messageId?: string) {
    super()

    if (options) {
      this.id = messageId ?? this.generateId()
      this.response = options.response
    }
  }

  @IsValidMessageType(DRPCResponseMessage.type)
  public readonly type = DRPCResponseMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/drpc/1.0/response')

  @Expose({ name: 'response' })
  @IsValidDRPCResponse()
  public response!: DRPCResponse
}
