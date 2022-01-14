import type { ValidationOptions } from 'class-validator'

import { Transform, TransformationType } from 'class-transformer'
import { ValidateBy, buildMessage } from 'class-validator'
import { DateTime } from 'luxon'

import { CredentialMetadataKeys } from '../modules/credentials/repository/credentialMetadataTypes'
import { Metadata } from '../storage/Metadata'

import { JsonTransformer } from './JsonTransformer'

/**
 * Decorator that transforms json to and from corresponding record.
 *
 * @example
 * class Example {
 *   RecordTransformer(Service)
 *   private services: Record<string, Service>;
 * }
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function RecordTransformer<T>(Class: { new (...args: any[]): T }) {
  return Transform(({ value, type }) => {
    switch (type) {
      case TransformationType.CLASS_TO_PLAIN:
        return Object.entries(value).reduce(
          (accumulator, [key, attribute]) => ({
            ...accumulator,
            [key]: JsonTransformer.toJSON(attribute),
          }),
          {}
        )

      case TransformationType.PLAIN_TO_CLASS:
        return Object.entries(value).reduce(
          (accumulator, [key, attribute]) => ({
            ...accumulator,
            [key]: JsonTransformer.fromJSON(attribute, Class),
          }),
          {}
        )

      default:
        return value
    }
  })
}

/*
 * Decorator that transforms to and from a metadata instance.
 *
 * @todo remove the conversion at 0.1.0 release via a migration script
 */
export function MetadataTransformer() {
  return Transform(({ value, type }) => {
    if (type === TransformationType.CLASS_TO_PLAIN) {
      return { ...value.data }
    }

    if (type === TransformationType.PLAIN_TO_CLASS) {
      const { requestMetadata, schemaId, credentialDefinitionId, ...rest } = value
      const metadata = new Metadata(rest)

      if (requestMetadata) metadata.add(CredentialMetadataKeys.IndyRequest, { ...value.requestMetadata })

      if (schemaId) metadata.add(CredentialMetadataKeys.IndyCredential, { schemaId: value.schemaId })

      if (credentialDefinitionId)
        metadata.add(CredentialMetadataKeys.IndyCredential, { credentialDefinitionId: value.credentialDefinitionId })

      return metadata
    }

    if (type === TransformationType.CLASS_TO_CLASS) {
      return value
    }
  })
}

/*
 * Function that parses date from multiple formats
 * including SQL formats.
 */

export function DateParser(value: string): Date {
  const parsedDate = new Date(value)
  if (parsedDate instanceof Date && !isNaN(parsedDate.getTime())) {
    return parsedDate
  }
  const luxonDate = DateTime.fromSQL(value)
  if (luxonDate.isValid) {
    return new Date(luxonDate.toString())
  }
  return new Date()
}

/**
 * Checks if a given value is a Map
 */
export function IsMap(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isMap',
      validator: {
        validate: (value: unknown): boolean => value instanceof Map,
        defaultMessage: buildMessage((eachPrefix) => eachPrefix + '$property must be a Map', validationOptions),
      },
    },
    validationOptions
  )
}
