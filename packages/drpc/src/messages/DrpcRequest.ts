import type { ValidationArguments, ValidationOptions } from 'class-validator'

import { IsValidMessageType, parseMessageType, AgentMessage } from '@credo-ts/core'
import { Expose } from 'class-transformer'
import { ValidateBy, ValidationError, buildMessage } from 'class-validator'

export function IsValidDrpcRequest(validationOptions?: ValidationOptions): PropertyDecorator {
  return function (target: any, propertyKey: string | symbol) {
    ValidateBy(
      {
        name: 'isValidDrpcRequest',
        validator: {
          validate: (value: any, _: ValidationArguments): boolean => {
            // Check if value is a DrpcRequestObject or an array of DrpcRequestObject
            let isValid = false
            if (!Array.isArray(value)) {
              isValid = isValidDrpcRequestObject(value)
            } else {
              isValid = value.every(isValidDrpcRequestObject)
            }

            if (!isValid) {
              throw new ValidationError()
            }

            return isValid
          },
          defaultMessage: buildMessage(
            (eachPrefix) => eachPrefix + '$property is not a valid DrpcRequest',
            validationOptions
          ),
        },
      },
      validationOptions
    )(target, propertyKey)
  }
}

export function isValidDrpcRequestObject(value: any): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  return 'jsonrpc' in value && 'method' in value && 'id' in value
}

export interface DrpcRequestObject {
  jsonrpc: string
  method: string
  params?: any[] | object
  id: string | number | null
}

export type DrpcRequest = DrpcRequestObject | DrpcRequestObject[]

export class DrpcRequestMessage extends AgentMessage {
  public readonly allowDidSovPrefix = true

  public constructor(options: { request: DrpcRequest }, messageId?: string) {
    super()

    if (options) {
      this.id = messageId ?? this.generateId()
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
