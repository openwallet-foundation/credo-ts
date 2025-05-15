import type { W3cCredentialOptions } from '../../models/credential/W3cCredential'
import type { W3cJsonCredential } from '../../models/credential/W3cJsonCredential'
import type { DataIntegrityProofOptions } from './DataIntegrityProof'
import type { LinkedDataProofOptions } from './LinkedDataProof'

import { ValidateNested } from 'class-validator'

import { IsInstanceOrArrayOfInstances, JsonTransformer, asArray, mapSingleOrArray } from '../../../../utils'
import { ClaimFormat } from '../../models/ClaimFormat'
import { W3cCredential } from '../../models/credential/W3cCredential'

import { SingleOrArray } from '../../../../types'
import { DataIntegrityProof } from './DataIntegrityProof'
import { LinkedDataProof } from './LinkedDataProof'
import { ProofTransformer } from './ProofTransformer'

export interface W3cJsonLdVerifiableCredentialOptions extends W3cCredentialOptions {
  proof: SingleOrArray<LinkedDataProofOptions | DataIntegrityProofOptions>
}

export class W3cJsonLdVerifiableCredential extends W3cCredential {
  public constructor(options: W3cJsonLdVerifiableCredentialOptions) {
    super(options)
    if (options) {
      this.proof = mapSingleOrArray(options.proof, (proof) => {
        if (proof.cryptosuite) return new DataIntegrityProof(proof)
        return new LinkedDataProof(proof as LinkedDataProofOptions)
      })
    }
  }

  @ProofTransformer()
  @IsInstanceOrArrayOfInstances({ classType: [LinkedDataProof, DataIntegrityProof] })
  @ValidateNested()
  public proof!: SingleOrArray<LinkedDataProof | DataIntegrityProof>

  public get proofTypes(): Array<string> {
    const proofArray = asArray(this.proof) ?? []
    return proofArray.map((proof) => proof.type)
  }

  public get dataIntegrityCryptosuites(): Array<string> {
    const proofArray = asArray(this.proof) ?? []
    return proofArray
      .filter((proof): proof is DataIntegrityProof => proof.type === 'DataIntegrityProof' && 'cryptosuite' in proof)
      .map((proof) => proof.cryptosuite)
  }

  public toJson() {
    return JsonTransformer.toJSON(this)
  }

  public static fromJson(json: Record<string, unknown>) {
    return JsonTransformer.fromJSON(json, W3cJsonLdVerifiableCredential)
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

  public get jsonCredential(): W3cJsonCredential {
    return this.toJson() as W3cJsonCredential
  }
}
