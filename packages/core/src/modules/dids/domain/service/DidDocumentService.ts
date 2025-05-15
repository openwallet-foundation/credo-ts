import type { ValidationOptions } from 'class-validator'

import { IsString, ValidateBy, buildMessage, isString } from 'class-validator'

import { CredoError } from '../../../../error'
import { SingleOrArray, isJsonObject } from '../../../../types'
import { getProtocolScheme } from '../../../../utils/uri'

type ServiceEndpointType = SingleOrArray<string | Record<string, unknown>>

export class DidDocumentService {
  public constructor(options: { id: string; serviceEndpoint: ServiceEndpointType; type: string }) {
    if (options) {
      this.id = options.id
      this.serviceEndpoint = options.serviceEndpoint
      this.type = options.type
    }
  }

  /**
   * @deprecated will be removed in 0.6, as it's not possible from the base did document service class to determine
   * the protocol scheme. It needs to be implemented on a specific did document service class.
   */
  public get protocolScheme(): string {
    if (typeof this.serviceEndpoint !== 'string') {
      throw new CredoError('Unable to extract protocol scheme from serviceEndpoint as it is not a string.')
    }

    return getProtocolScheme(this.serviceEndpoint)
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
