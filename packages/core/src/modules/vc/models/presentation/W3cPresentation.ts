import type { ValidationOptions } from 'class-validator'
import type { JsonObject } from '../../../../types'
import type { W3cVerifiableCredential } from '../credential/W3cVerifiableCredential'
import type { W3cHolderOptions } from './W3cHolder'
import type { W3cJsonPresentation } from './W3cJsonPresentation'

import { Expose } from 'class-transformer'
import { IsOptional, ValidateBy, ValidateNested, buildMessage } from 'class-validator'

import { JsonTransformer } from '../../../../utils'
import { SingleOrArray } from '../../../../utils/type'
import { IsInstanceOrArrayOfInstances, IsUri } from '../../../../utils/validators'
import { CREDENTIALS_CONTEXT_V1_URL, VERIFIABLE_PRESENTATION_TYPE } from '../../constants'
import { W3cJsonLdVerifiableCredential } from '../../data-integrity/models/W3cJsonLdVerifiableCredential'
import { W3cJwtVerifiableCredential } from '../../jwt-vc/W3cJwtVerifiableCredential'
import { IsCredentialJsonLdContext } from '../../validators'
import { W3cVerifiableCredentialTransformer } from '../credential/W3cVerifiableCredential'

import { IsW3cHolder, W3cHolder, W3cHolderTransformer } from './W3cHolder'

export interface W3cPresentationOptions {
  id?: string
  context?: Array<string | JsonObject>
  type?: Array<string>
  verifiableCredential: SingleOrArray<W3cVerifiableCredential>
  holder?: string | W3cHolderOptions
}

export class W3cPresentation {
  public constructor(options: W3cPresentationOptions) {
    if (options) {
      this.id = options.id
      this.context = options.context ?? [CREDENTIALS_CONTEXT_V1_URL]
      this.type = options.type ?? [VERIFIABLE_PRESENTATION_TYPE]
      this.verifiableCredential = options.verifiableCredential

      if (options.holder) {
        this.holder = typeof options.holder === 'string' ? options.holder : new W3cHolder(options.holder)
      }
    }
  }

  @Expose({ name: '@context' })
  @IsCredentialJsonLdContext()
  public context!: Array<string | JsonObject>

  @IsOptional()
  @IsUri()
  public id?: string

  @IsVerifiablePresentationType()
  public type!: Array<string>

  @W3cHolderTransformer()
  @IsW3cHolder()
  @IsOptional()
  public holder?: string | W3cHolder

  @W3cVerifiableCredentialTransformer()
  @IsInstanceOrArrayOfInstances({ classType: [W3cJsonLdVerifiableCredential, W3cJwtVerifiableCredential] })
  @ValidateNested({ each: true })
  public verifiableCredential!: SingleOrArray<W3cVerifiableCredential>

  public get holderId(): string | null {
    if (!this.holder) return null

    return this.holder instanceof W3cHolder ? this.holder.id : this.holder
  }

  public toJSON() {
    return JsonTransformer.toJSON(this) as W3cJsonPresentation
  }
}

// Custom validators

export function IsVerifiablePresentationType(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'IsVerifiablePresentationType',
      validator: {
        validate: (value): boolean => {
          if (Array.isArray(value)) {
            return value.includes(VERIFIABLE_PRESENTATION_TYPE)
          }
          return false
        },
        defaultMessage: buildMessage(
          (eachPrefix) => `${eachPrefix}$property must be an array of strings which includes "VerifiablePresentation"`,
          validationOptions
        ),
      },
    },
    validationOptions
  )
}
