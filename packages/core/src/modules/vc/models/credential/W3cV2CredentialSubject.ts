import { Transform, TransformationType } from 'class-transformer'
import { IsOptional, IsUrl, isInstance } from 'class-validator'
import { CredoError } from '../../../../error'

export interface W3cV2CredentialSubjectOptions {
  id?: string
  claims?: Record<string, unknown>
}

/**
 * Represents a credential subject.
 *
 * TODO: figure out how to retain arbitrary properties and make them accessible in the class.
 *
 * @see https://www.w3.org/TR/vc-data-model-2.0/#credential-subject
 */
export class W3cV2CredentialSubject {
  public constructor(options: W3cV2CredentialSubjectOptions) {
    if (options) {
      this.id = options.id

      const { id, ...claims } = options.claims ?? {}
      this.claims = Object.keys(claims).length > 0 ? claims : undefined
    }
  }

  @IsOptional()
  @IsUrl()
  public id?: string

  @IsOptional()
  public claims?: Record<string, unknown>
}

const jsonToClass = (v: unknown) => {
  if (!v || typeof v !== 'object') {
    throw new CredoError('Invalid plain W3cV2CredentialSubject')
  }

  if (isInstance(v, W3cV2CredentialSubject)) {
    return v
  }

  const { id, ...claims } = v as Record<string, unknown>
  if (id !== undefined && typeof id !== 'string') {
    throw new CredoError('Invalid credential subject id')
  }

  return new W3cV2CredentialSubject({ id, claims })
}

const classToJson = (v: unknown) => {
  if (v instanceof W3cV2CredentialSubject) {
    return v.id ? { ...v.claims, id: v.id } : { ...v.claims }
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
