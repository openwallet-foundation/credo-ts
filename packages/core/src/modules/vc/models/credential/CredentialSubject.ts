import { Transform, TransformationType, plainToInstance, instanceToPlain } from 'class-transformer'
import { isString } from 'class-validator'

import { IsUri } from '../../../../utils/validators'

/**
 * TODO: check how to support arbitrary data in class
 * @see https://www.w3.org/TR/vc-data-model/#credential-subject
 */

export interface CredentialSubjectOptions {
  id: string
}

export class CredentialSubject {
  public constructor(options: CredentialSubjectOptions) {
    if (options) {
      this.id = options.id
    }
  }

  @IsUri()
  public id!: string
}

// Custom transformers

export function CredentialSubjectTransformer() {
  return Transform(({ value, type }: { value: string | CredentialSubjectOptions; type: TransformationType }) => {
    if (type === TransformationType.PLAIN_TO_CLASS) {
      if (isString(value)) return value
      return plainToInstance(CredentialSubject, value)
    } else if (type === TransformationType.CLASS_TO_PLAIN) {
      if (isString(value)) return value
      return instanceToPlain(value)
    }
    // PLAIN_TO_PLAIN
    return value
  })
}
