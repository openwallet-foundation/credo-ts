import type { LinkedDataProofOptions } from '../LinkedDataProof'
import type { W3cVerifiableCredentialOptions } from '../credential/W3cVerifiableCredential'
import type { TypeHelpOptions } from 'class-transformer'
import type { ContextDefinition } from 'jsonld'

import { Type } from 'class-transformer'
import { IsOptional } from 'class-validator'

import { SingleOrArray } from '../../../../utils/type'
import { IsInstanceOrArrayOfInstances, IsUri } from '../../../../utils/validators'
import { LinkedDataProofTransformer, VerifiableCredentialTransformer } from '../../transformers'
import { IsVerifiablePresentationType } from '../../validators'

import { LinkedDataProof } from '../LinkedDataProof'
import { W3cVerifiableCredential } from '../credential/W3cVerifiableCredential'
import { W3cPresentation, W3cPresentationOptions } from './W3Presentation'

export interface W3cVerifiablePresentationOptions extends W3cPresentationOptions {
  proof: LinkedDataProofOptions
}

export class W3cVerifiablePresentation extends W3cPresentation {
  public constructor(options: W3cVerifiablePresentationOptions) {
    super(options)
    this.proof = new LinkedDataProof(options.proof)
  }

  @LinkedDataProofTransformer()
  @IsInstanceOrArrayOfInstances({ classType: LinkedDataProof })
  public proof!: SingleOrArray<LinkedDataProof>
}
