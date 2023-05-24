import { Transform, TransformationType, plainToInstance, instanceToPlain } from 'class-transformer'
import { IsOptional, isString } from 'class-validator'

import { IsUri } from '../../../../utils/validators'

/**
 * TODO: check how to support arbitrary data in class
 * @see https://www.w3.org/TR/vc-data-model/#credential-subject
 */

export interface W3cCredentialSubjectOptions {
  id?: string
}

export class W3cCredentialSubject {
  public constructor(options: W3cCredentialSubjectOptions) {
    if (options) {
      this.id = options.id
    }
  }

  @IsUri()
  @IsOptional()
  public id?: string
}

// Custom transformers

export function W3cCredentialSubjectTransformer() {
  return Transform(({ value, type }: { value: string | W3cCredentialSubjectOptions; type: TransformationType }) => {
    if (type === TransformationType.PLAIN_TO_CLASS) {
      if (isString(value)) return value
      return plainToInstance(W3cCredentialSubject, value)
    } else if (type === TransformationType.CLASS_TO_PLAIN) {
      if (isString(value)) return value
      return instanceToPlain(value)
    }
    // PLAIN_TO_PLAIN
    return value
  })
}
