import { Expose } from 'class-transformer'
import { IsOptional, ValidateNested } from 'class-validator'
import type { JsonObject, SingleOrArray } from '../../../../types'
import { JsonTransformer, mapSingleOrArray } from '../../../../utils'
import { IsInstanceOrArrayOfInstances, IsNever, IsUri } from '../../../../utils/validators'
import { CREDENTIALS_CONTEXT_V2_URL, VERIFIABLE_PRESENTATION_TYPE } from '../../constants'
import { IsCredentialJsonLdContext, IsVerifiablePresentationType } from '../../validators'
import {
  W3cV2EnvelopedVerifiableCredential,
  W3cV2EnvelopedVerifiableCredentialOptions,
  W3cV2EnvelopedVerifiableCredentialTransformer,
} from '../credential/W3cV2EnvelopedVerifiableCredential'
import { IsW3cV2Holder, W3cV2Holder, W3cV2HolderOptions, W3cV2HolderTransformer } from './W3cV2Holder'
import { W3cV2JsonPresentation } from './W3cV2JsonPresentation'

export interface W3cV2PresentationOptions {
  id?: string
  context?: Array<string | JsonObject>
  type?: SingleOrArray<string>
  // TODO: eventually add support for Verifiable Credentials with embedded proofs.
  verifiableCredential: SingleOrArray<W3cV2EnvelopedVerifiableCredentialOptions>
  holder?: string | W3cV2HolderOptions
}

export class W3cV2Presentation {
  public constructor(options: W3cV2PresentationOptions) {
    if (options) {
      this.id = options.id
      this.context = options.context ?? [CREDENTIALS_CONTEXT_V2_URL]
      this.type = options.type ?? [VERIFIABLE_PRESENTATION_TYPE]
      this.verifiableCredential = mapSingleOrArray(
        options.verifiableCredential,
        (options) => new W3cV2EnvelopedVerifiableCredential(options)
      )

      if (options.holder) {
        this.holder = typeof options.holder === 'string' ? options.holder : new W3cV2Holder(options.holder)
      }
    }
  }

  @Expose({ name: '@context' })
  @IsCredentialJsonLdContext({ credentialContext: CREDENTIALS_CONTEXT_V2_URL })
  public context!: Array<string | JsonObject>

  @IsOptional()
  @IsUri()
  public id?: string

  @IsVerifiablePresentationType()
  public type!: SingleOrArray<string>

  @W3cV2HolderTransformer()
  @IsW3cV2Holder()
  @IsOptional()
  public holder?: string | W3cV2Holder

  @W3cV2EnvelopedVerifiableCredentialTransformer()
  @IsInstanceOrArrayOfInstances({ classType: W3cV2EnvelopedVerifiableCredential })
  @ValidateNested({ each: true })
  public verifiableCredential!: SingleOrArray<W3cV2EnvelopedVerifiableCredential>

  @IsNever()
  public vc?: never

  @IsNever()
  public vp?: never

  public get holderId(): string | undefined {
    if (!this.holder) return undefined

    return this.holder instanceof W3cV2Holder ? this.holder.id : this.holder
  }

  public toJSON() {
    return JsonTransformer.toJSON(this) as W3cV2JsonPresentation
  }
}
