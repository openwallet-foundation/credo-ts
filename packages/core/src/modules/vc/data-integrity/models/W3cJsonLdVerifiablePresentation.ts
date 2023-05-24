import type { LinkedDataProofOptions } from './LinkedDataProof'
import type { W3cPresentationOptions } from '../../models/presentation/W3cPresentation'

import { SingleOrArray, IsInstanceOrArrayOfInstances } from '../../../../utils'
import { W3cPresentation } from '../../models/presentation/W3cPresentation'

import { LinkedDataProof, LinkedDataProofTransformer } from './LinkedDataProof'

export interface W3cJsonLdVerifiablePresentationOptions extends W3cPresentationOptions {
  proof: LinkedDataProofOptions
}

export class W3cJsonLdVerifiablePresentation extends W3cPresentation {
  public constructor(options: W3cJsonLdVerifiablePresentationOptions) {
    super(options)
    if (options) {
      this.proof = new LinkedDataProof(options.proof)
    }
  }

  @LinkedDataProofTransformer()
  @IsInstanceOrArrayOfInstances({ classType: LinkedDataProof })
  public proof!: SingleOrArray<LinkedDataProof>
}
