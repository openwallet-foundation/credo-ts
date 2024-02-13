import type { ValidationArguments, ValidationOptions } from 'class-validator'

import { IsValidMessageType, parseMessageType, AgentMessage } from '@credo-ts/core'
import { Expose } from 'class-transformer'
import { ValidateBy, ValidationError, buildMessage } from 'class-validator'

export function IsValidDRPCResponse(validationOptions?: ValidationOptions): PropertyDecorator {
  return function (target: any, propertyKey: string | symbol) {
    ValidateBy(
      {
        name: 'isValidDRPCResponse',
        validator: {
          validate: (value: any, _: ValidationArguments): boolean => {
            // Check if value is a valid DRPCResponseObject, an array of DRPCResponseObject (possibly mixed with empty objects), or an empty object
            let isValid = false
            if (Array.isArray(value)) {
              if (value.length > 0) {
                isValid = value.every(isValidDRPCResponse)
              }
            } else {
              isValid = isValidDRPCResponse(value)
            }
            if (!isValid) {
              throw new ValidationError()
            }
            return isValid
          },
          defaultMessage: buildMessage(
            (eachPrefix) => eachPrefix + '$property is not a valid DRPCResponse',
            validationOptions
          ),
        },
      },
      validationOptions
    )(target, propertyKey)
  }
}

function isValidDRPCResponse(value: any): boolean {
  // Check if value is an object
  if (typeof value !== 'object' || value === null) {
    return false
  }

  // Check if it's an empty object
  if (Object.keys(value).length === 0) {
    return true
  }

  // Check if it's a valid DRPCResponseObject
  if ('jsonrpc' in value && 'id' in value) {
    // Check if 'result' and 'error' are valid
    if ('result' in value && typeof value.result === 'undefined') {
      return false
    }
    if ('error' in value && !isValidDRPCResponseError(value.error)) {
      return false
    }
    return true
  }

  return false
}

function isValidDRPCResponseError(error: any): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error
}

export function IsValidDRPCRequest(validationOptions?: ValidationOptions): PropertyDecorator {
  return function (target: any, propertyKey: string | symbol) {
    ValidateBy(
      {
        name: 'isValidDRPCRequest',
        validator: {
          validate: (value: any, _: ValidationArguments): boolean => {
            // Check if value is a DRPCRequestObject or an array of DRPCRequestObject
            let isValid = false
            if (!Array.isArray(value)) {
              isValid = isValidDRPCRequestObject(value)
            } else {
              isValid = value.every(isValidDRPCRequestObject)
            }

            if (!isValid) {
              throw new ValidationError()
            }

            return isValid
          },
          defaultMessage: buildMessage(
            (eachPrefix) => eachPrefix + '$property is not a valid DRPCRequest',
            validationOptions
          ),
        },
      },
      validationOptions
    )(target, propertyKey)
  }
}

export function isValidDRPCRequestObject(value: any): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  return 'jsonrpc' in value && 'method' in value && 'id' in value
}

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
