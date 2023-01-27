import type { W3cPresentationOptions } from './W3cPresentation'
import type { LinkedDataProofOptions } from '../LinkedDataProof'

import { SingleOrArray } from '../../../../utils/type'
import { IsInstanceOrArrayOfInstances } from '../../../../utils/validators'
import { LinkedDataProof, LinkedDataProofTransformer } from '../LinkedDataProof'

import { W3cPresentation } from './W3cPresentation'

export interface W3cVerifiablePresentationOptions extends W3cPresentationOptions {
  proof: LinkedDataProofOptions
}

export class W3cVerifiablePresentation extends W3cPresentation {
  public constructor(options: W3cVerifiablePresentationOptions) {
    super(options)
    if (options) {
      this.proof = new LinkedDataProof(options.proof)
    }
  }

  @LinkedDataProofTransformer()
  @IsInstanceOrArrayOfInstances({ classType: LinkedDataProof })
  public proof!: SingleOrArray<LinkedDataProof>
}
