import type { LinkedDataProofOptions } from './LinkedDataProof'
import type { ClaimFormat } from '../../W3cCredentialServiceOptions'
import type { W3cCredentialOptions } from '../../models/credential/W3cCredential'

import { ValidateNested } from 'class-validator'

import { IsInstanceOrArrayOfInstances, SingleOrArray, asArray } from '../../../../utils'
import { W3cCredential } from '../../models/credential/W3cCredential'

import { LinkedDataProof, LinkedDataProofTransformer } from './LinkedDataProof'

export interface W3cJsonLdVerifiableCredentialOptions extends W3cCredentialOptions {
  proof: SingleOrArray<LinkedDataProofOptions>
}

export class W3cJsonLdVerifiableCredential extends W3cCredential {
  public constructor(options: W3cJsonLdVerifiableCredentialOptions) {
    super(options)
    if (options) {
      this.proof = Array.isArray(options.proof)
        ? options.proof.map((proof) => new LinkedDataProof(proof))
        : new LinkedDataProof(options.proof)
    }
  }

  @LinkedDataProofTransformer()
  @IsInstanceOrArrayOfInstances({ classType: LinkedDataProof })
  @ValidateNested()
  public proof!: SingleOrArray<LinkedDataProof>

  public get proofTypes(): Array<string> {
    const proofArray = asArray<LinkedDataProof>(this.proof)
    return proofArray?.map((x) => x.type) ?? []
  }

  /**
   * The {@link ClaimFormat} of the credential. For JSON-LD credentials this is always `ldp_vc`.
   */
  public get claimFormat(): Extract<ClaimFormat, 'ldp_vc'> {
    return 'ldp_vc'
  }
}
