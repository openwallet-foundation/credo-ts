import type { ValidationOptions } from 'class-validator'

import { IsString, ValidateBy, buildMessage, isString } from 'class-validator'

import { type SingleOrArray, isJsonObject } from '../../../../types'

type ServiceEndpointType = SingleOrArray<string | Record<string, unknown>>

export class DidDocumentService {
  public constructor(options: { id: string; serviceEndpoint: ServiceEndpointType; type: string }) {
    if (options) {
      this.id = options.id
      this.serviceEndpoint = options.serviceEndpoint
      this.type = options.type
    }
  }

  @IsString()
  public id!: string

  @IsStringOrJsonObjectSingleOrArray()
  public serviceEndpoint!: SingleOrArray<string | Record<string, unknown>>

  @IsString()
  public type!: string
}

/**
 * Checks if a given value is a string, a json object, or an array of strings and json objects
 */
function IsStringOrJsonObjectSingleOrArray(validationOptions?: Omit<ValidationOptions, 'each'>): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isStringOrJsonObjectSingleOrArray',
      validator: {
        validate: (value): boolean =>
          isString(value) ||
          isJsonObject(value) ||
          (Array.isArray(value) && value.every((v) => isString(v) || isJsonObject(v))),
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must be a string, JSON object, or an array consisting of strings and JSON objects`,
          validationOptions
        ),
      },
    },
    validationOptions
  )
}
