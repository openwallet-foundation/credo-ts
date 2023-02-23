import type { ValidationOptions } from 'class-validator'

import { Transform, TransformationType } from 'class-transformer'
import { isString, ValidateBy, buildMessage } from 'class-validator'
import { DateTime } from 'luxon'

import { Metadata } from '../storage/Metadata'

/*
 * Decorator that transforms to and from a metadata instance.
 */
export function MetadataTransformer() {
  return Transform(({ value, type }) => {
    if (type === TransformationType.CLASS_TO_PLAIN) {
      return { ...value.data }
    }

    if (type === TransformationType.PLAIN_TO_CLASS) {
      return new Metadata(value)
    }

    if (type === TransformationType.CLASS_TO_CLASS) {
      return new Metadata({ ...value.data })
    }
  })
}

/**
 * Decorator that transforms to and from a date instance.
 */
export function DateTransformer() {
  return Transform(({ value, type }) => {
    if (type === TransformationType.CLASS_TO_PLAIN) {
      return value.toISOString()
    }

    if (type === TransformationType.PLAIN_TO_CLASS) {
      return new Date(value)
    }

    if (type === TransformationType.CLASS_TO_CLASS) {
      return new Date(value.getTime())
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

/**
 * Checks if a given value is a string or string array.
 */
export function IsStringOrStringArray(validationOptions?: Omit<ValidationOptions, 'each'>): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isStringOrStringArray',
      validator: {
        validate: (value): boolean => isString(value) || (Array.isArray(value) && value.every((v) => isString(v))),
        defaultMessage: buildMessage(
          (eachPrefix) => eachPrefix + '$property must be a string or string array',
          validationOptions
        ),
      },
    },
    validationOptions
  )
}
