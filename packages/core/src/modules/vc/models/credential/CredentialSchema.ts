import type { SingleOrArray } from '../../../../utils/type'

import { Transform, TransformationType, plainToInstance, instanceToPlain } from 'class-transformer'
import { IsString } from 'class-validator'

import { IsUri } from '../../../../utils/validators'

export interface CredentialSchemaOptions {
  id: string
  type: string
}

export class CredentialSchema {
  public constructor(options: CredentialSchemaOptions) {
    if (options) {
      this.id = options.id
      this.type = options.type
    }
  }

  @IsUri()
  public id!: string

  @IsString()
  public type!: string
}

// Custom transformers

export function CredentialSchemaTransformer() {
  return Transform(({ value, type }: { value: SingleOrArray<CredentialSchema>; type: TransformationType }) => {
    if (type === TransformationType.PLAIN_TO_CLASS) {
      if (Array.isArray(value)) return value.map((v) => plainToInstance(CredentialSchema, v))
      return plainToInstance(CredentialSchema, value)
    } else if (type === TransformationType.CLASS_TO_PLAIN) {
      if (Array.isArray(value)) return value.map((v) => instanceToPlain(v))
      return instanceToPlain(value)
    }
    // PLAIN_TO_PLAIN
    return value
  })
}
