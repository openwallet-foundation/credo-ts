import type { LinkedDataProofOptions } from '../LinkedDataProof'
import type { W3cCredentialOptions } from './W3cCredential'

import { SingleOrArray } from '../../../../utils/type'
import { IsInstanceOrArrayOfInstances } from '../../../../utils/validators'
import { LinkedDataProofTransformer } from '../../transformers'

import { LinkedDataProof } from '../LinkedDataProof'
import { W3cCredential } from './W3cCredential'

export interface W3cVerifiableCredentialOptions extends W3cCredentialOptions {
  proof: SingleOrArray<LinkedDataProofOptions>
}

export class W3cVerifiableCredential extends W3cCredential {
  public constructor(options: W3cVerifiableCredentialOptions) {
    if (options.proof) {
      super(options)
      this.proof = Array.isArray(options.proof)
        ? options.proof.map((proof) => new LinkedDataProof(proof))
        : new LinkedDataProof(options.proof)
    }
  }

  @LinkedDataProofTransformer()
  @IsInstanceOrArrayOfInstances({ classType: LinkedDataProof })
  public proof!: SingleOrArray<LinkedDataProof>
}
