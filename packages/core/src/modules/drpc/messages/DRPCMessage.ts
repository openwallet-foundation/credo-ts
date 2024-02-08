import { Expose, Transform } from 'class-transformer'
import { IsDate, IsObject, IsString, isObject, isString } from 'class-validator'

import { AgentMessage } from '../../../agent/AgentMessage'
import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'
import { DateParser } from '../../../utils/transformers'

export interface DRPCRequestObject {
  jsonrpc: string,
  method: string,
  params?: any[] | Object,
  id?: string | number,
}

export enum DRPCErrorCode {
  METHOD_NOT_FOUND = -32601,
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  SERVER_ERROR = -32000,
}

export interface DRPCResponseError {
  code: DRPCErrorCode,
  message: string,
  data?: Object,
}

export interface DRPCResponseObject {
  jsonrpc: string,
  result?: any,
  error?: DRPCResponseError,
  id?: string | number,
}

export class DRPCRequestMessage extends AgentMessage {
  public readonly allowDidSovPrefix = true

  /**
   * Create new BasicMessage instance.
   * sentTime will be assigned to new Date if not passed, id will be assigned to uuid/v4 if not passed
   * @param options
   */
  public constructor(options: { request: DRPCRequestObject }) {
    super()

    if (options) {
      this.id = this.generateId()
      this.request = options.request
    }
  }

  @IsValidMessageType(DRPCRequestMessage.type)
  public readonly type = DRPCRequestMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/drpc/1.0/request')


  @Expose({ name: 'request' })
  @IsObject()
  public request!: DRPCRequestObject
}

export class DRPCResponseMessage extends AgentMessage {
  public readonly allowDidSovPrefix = true

  /**
   * Create new BasicMessage instance.
   * sentTime will be assigned to new Date if not passed, id will be assigned to uuid/v4 if not passed
   * @param options
   */
  public constructor(options: { response: DRPCResponseObject | {} }) {
    super()

    if (options) {
      this.id = this.generateId()
      this.response = options.response
    }
  }

  @IsValidMessageType(DRPCResponseMessage.type)
  public readonly type = DRPCResponseMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/drpc/1.0/response')


  @Expose({ name: 'response' })
  @IsObject()
  public response!: DRPCResponseObject | {}
}
