import { Transform, TransformationType } from 'class-transformer'
import { IsOptional, IsUrl, isInstance } from 'class-validator'
import { CredoError } from '../../../../error'

export interface W3cV2CredentialSubjectOptions {
  id?: string
  [property: string]: unknown
}

/**
 * Represents a credential subject.
 *
 * @see https://www.w3.org/TR/vc-data-model-2.0/#credential-subject
 */
export class W3cV2CredentialSubject {
  public constructor(options: W3cV2CredentialSubjectOptions) {
    if (options) {
      const { id, ...properties } = options

      this.id = id
      this.properties = properties
    }
  }

  @IsOptional()
  @IsUrl()
  public id?: string

  @IsOptional()
  public properties?: Record<string, unknown>
}

const jsonToClass = (v: unknown) => {
  if (!v || typeof v !== 'object') {
    throw new CredoError('Invalid plain W3cV2CredentialSubject')
  }

  if (isInstance(v, W3cV2CredentialSubject)) {
    return v
  }

  return new W3cV2CredentialSubject(v as W3cV2CredentialSubjectOptions)
}

const classToJson = (v: unknown) => {
  if (v instanceof W3cV2CredentialSubject) {
    return { ...v.properties, id: v.id }
  }

  return v
}

export function W3cV2CredentialSubjectTransformer() {
  return Transform(({ value, type }: { value: W3cV2CredentialSubjectOptions; type: TransformationType }) => {
    if (type === TransformationType.PLAIN_TO_CLASS) {
      if (Array.isArray(value) && value.length === 0) {
        throw new CredoError('At least one credential subject is required')
      }

      return Array.isArray(value) ? value.map(jsonToClass) : jsonToClass(value)
    }

    if (type === TransformationType.CLASS_TO_PLAIN) {
      return Array.isArray(value) ? value.map(classToJson) : classToJson(value)
    }

    // PLAIN_TO_PLAIN
    return value
  })
}
