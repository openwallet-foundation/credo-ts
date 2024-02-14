import type { ValidationArguments, ValidationOptions } from 'class-validator'

import { IsValidMessageType, parseMessageType, AgentMessage } from '@credo-ts/core'
import { Expose } from 'class-transformer'
import { ValidateBy, ValidationError, buildMessage } from 'class-validator'

export function IsValidDrpcResponse(validationOptions?: ValidationOptions): PropertyDecorator {
  return function (target: any, propertyKey: string | symbol) {
    ValidateBy(
      {
        name: 'isValidDrpcResponse',
        validator: {
          validate: (value: any, _: ValidationArguments): boolean => {
            // Check if value is a valid DrpcResponseObject, an array of DrpcResponseObject (possibly mixed with empty objects), or an empty object
            let isValid = false
            if (Array.isArray(value)) {
              if (value.length > 0) {
                isValid = value.every(isValidDrpcResponse)
              }
            } else {
              isValid = isValidDrpcResponse(value)
            }
            if (!isValid) {
              throw new ValidationError()
            }
            return isValid
          },
          defaultMessage: buildMessage(
            (eachPrefix) => eachPrefix + '$property is not a valid DrpcResponse',
            validationOptions
          ),
        },
      },
      validationOptions
    )(target, propertyKey)
  }
}

export function isValidDrpcResponse(value: any): boolean {
  // Check if value is an object
  if (typeof value !== 'object' || value === null) {
    return false
  }

  // Check if it's an empty object
  if (Object.keys(value).length === 0) {
    return true
  }

  // Check if it's a valid DrpcResponseObject
  if ('jsonrpc' in value && 'id' in value) {
    // Check if 'result' and 'error' are valid
    if ('result' in value && typeof value.result === 'undefined') {
      return false
    }
    if ('error' in value && !isValidDrpcResponseError(value.error)) {
      return false
    }
    return true
  }

  return false
}

function isValidDrpcResponseError(error: any): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error
}

export enum DrpcErrorCode {
  METHOD_NOT_FOUND = -32601,
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  SERVER_ERROR = -32000,
}

export type DrpcResponse = DrpcResponseObject | (DrpcResponseObject | Record<string, never>)[] | Record<string, never>

export interface DrpcResponseError {
  code: DrpcErrorCode
  message: string
  data?: any
}

export interface DrpcResponseObject {
  jsonrpc: string
  result?: any
  error?: DrpcResponseError
  id: string | number | null
}

export class DrpcResponseMessage extends AgentMessage {
  public readonly allowDidSovPrefix = true

  public constructor(options: { response: DrpcResponse; threadId: string }) {
    super()
    if (options) {
      this.id = this.generateId()
      this.response = options.response
      this.setThread({ threadId: options.threadId })
    }
  }

  @IsValidMessageType(DrpcResponseMessage.type)
  public readonly type = DrpcResponseMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/drpc/1.0/response')

  @Expose({ name: 'response' })
  @IsValidDrpcResponse()
  public response!: DrpcResponse
}
