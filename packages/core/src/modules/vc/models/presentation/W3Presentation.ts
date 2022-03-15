import { IsOptional, IsString } from 'class-validator'
import { ContextDefinition } from 'jsonld'
import { SingleOrArray } from '../../../../utils/type'
import { IsUri, IsInstanceOrArrayOfInstances } from '../../../../utils/validators'
import { VerifiableCredentialTransformer, LinkedDataProofTransformer } from '../../transformers'
import { IsVerifiablePresentationType } from '../../validators'
import { W3cVerifiableCredential, W3cVerifiableCredentialOptions } from '../credential/W3cVerifiableCredential'
import { LinkedDataProof } from '../LinkedDataProof'

export interface W3cPresentationOptions {
  id?: string
  // context: SingleOrArray<string | ContextDefinition> // VERIFY if this really needs to be here
  type: Array<string>
  verifiableCredential: SingleOrArray<W3cVerifiableCredentialOptions>
  holder?: string
}

export class W3cPresentation {
  public constructor(options: W3cPresentationOptions) {
    if (options) {
      this.id = options.id
      // this.context = options.context
      this.type = options.type
      this.verifiableCredential = Array.isArray(options.verifiableCredential)
        ? options.verifiableCredential.map((vc) => new W3cVerifiableCredential(vc))
        : new W3cVerifiableCredential(options.verifiableCredential)
      this.holder = options.holder
    }
  }

  @IsOptional()
  @IsUri()
  public id?: string

  @IsVerifiablePresentationType()
  public type!: Array<string>

  @IsOptional()
  @IsString()
  @IsUri()
  public holder?: string

  @VerifiableCredentialTransformer()
  @IsInstanceOrArrayOfInstances({ classType: W3cVerifiableCredential })
  public verifiableCredential!: SingleOrArray<W3cVerifiableCredential>

  @LinkedDataProofTransformer()
  @IsInstanceOrArrayOfInstances({ classType: LinkedDataProof })
  public proof!: SingleOrArray<LinkedDataProof>
}
