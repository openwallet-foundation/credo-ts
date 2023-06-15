import type { LinkedDataProofOptions } from './LinkedDataProof'
import type { W3cCredentialOptions } from '../../models/credential/W3cCredential'

import { ValidateNested } from 'class-validator'

import {
  IsInstanceOrArrayOfInstances,
  SingleOrArray,
  asArray,
  mapSingleOrArray,
  JsonTransformer,
} from '../../../../utils'
import { ClaimFormat } from '../../models/ClaimFormat'
import { W3cCredential } from '../../models/credential/W3cCredential'

import { LinkedDataProof, LinkedDataProofTransformer } from './LinkedDataProof'

export interface W3cJsonLdVerifiableCredentialOptions extends W3cCredentialOptions {
  proof: SingleOrArray<LinkedDataProofOptions>
}

export class W3cJsonLdVerifiableCredential extends W3cCredential {
  public constructor(options: W3cJsonLdVerifiableCredentialOptions) {
    super(options)
    if (options) {
      this.proof = mapSingleOrArray(options.proof, (proof) => new LinkedDataProof(proof))
    }
  }

  @LinkedDataProofTransformer()
  @IsInstanceOrArrayOfInstances({ classType: LinkedDataProof })
  @ValidateNested()
  public proof!: SingleOrArray<LinkedDataProof>

  public get proofTypes(): Array<string> {
    const proofArray = asArray(this.proof) ?? []
    return proofArray.map((proof) => proof.type)
  }

  public toJson() {
    return JsonTransformer.toJSON(this)
  }

  /**
   * The {@link ClaimFormat} of the credential. For JSON-LD credentials this is always `ldp_vc`.
   */
  public get claimFormat(): ClaimFormat.LdpVc {
    return ClaimFormat.LdpVc
  }

  /**
   * Get the encoded variant of the W3C Verifiable Credential. For JSON-LD credentials this is
   * a JSON object.
   */
  public get encoded() {
    return this.toJson()
  }
}
