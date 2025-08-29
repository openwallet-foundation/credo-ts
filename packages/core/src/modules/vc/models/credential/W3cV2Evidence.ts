import { Transform, TransformationType } from 'class-transformer'
import { IsOptional, IsString, IsUrl, isInstance } from 'class-validator'
import { CredoError } from '../../../../error'

export interface W3cV2EvidenceOptions {
  id?: string
  type: string
}

/**
 * Represents an evidence.
 *
 * @see https://www.w3.org/TR/vc-data-model-2.0/#evidence
 */
export class W3cV2Evidence {
  public constructor(options: W3cV2EvidenceOptions) {
    if (options) {
      const { id, type, ...properties } = options

      this.id = id
      this.type = type
      this.properties = properties
    }
  }

  @IsOptional()
  @IsUrl()
  public id?: string

  @IsString()
  public type!: string

  @IsOptional()
  public properties?: Record<string, unknown>
}

const jsonToClass = (v: unknown) => {
  if (!v || typeof v !== 'object') {
    throw new CredoError('Invalid plain W3cV2CredentialEvidence')
  }

  if (isInstance(v, W3cV2Evidence)) {
    return v
  }

  return new W3cV2Evidence(v as W3cV2EvidenceOptions)
}

const classToJson = (v: unknown) => {
  if (v instanceof W3cV2Evidence) {
    return { ...v.properties, id: v.id, type: v.type }
  }

  return v
}

export function W3cV2EvidenceTransformer() {
  return Transform(({ value, type }: { value: W3cV2EvidenceOptions; type: TransformationType }) => {
    if (type === TransformationType.PLAIN_TO_CLASS) {
      if (Array.isArray(value) && value.length === 0) {
        throw new CredoError('At least one evidence is required')
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
