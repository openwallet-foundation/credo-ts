import type { SingleOrArray } from '../../../../types'
import { asArray, IsInstanceOrArrayOfInstances, JsonTransformer } from '../../../../utils'
import { ClaimFormat } from '../../models'
import type { W3cPresentationOptions } from '../../models/presentation/W3cPresentation'
import { W3cPresentation } from '../../models/presentation/W3cPresentation'
import type { DataIntegrityProofOptions } from './DataIntegrityProof'
import { DataIntegrityProof } from './DataIntegrityProof'
import type { LinkedDataProofOptions } from './LinkedDataProof'
import { LinkedDataProof } from './LinkedDataProof'
import { ProofTransformer } from './ProofTransformer'

export interface W3cJsonLdVerifiablePresentationOptions extends W3cPresentationOptions {
  proof: LinkedDataProofOptions | DataIntegrityProofOptions
}

export class W3cJsonLdVerifiablePresentation extends W3cPresentation {
  public constructor(options: W3cJsonLdVerifiablePresentationOptions) {
    super(options)
    if (options) {
      if (options.proof.cryptosuite) this.proof = new DataIntegrityProof(options.proof)
      else this.proof = new LinkedDataProof(options.proof as LinkedDataProofOptions)
    }
  }

  @ProofTransformer()
  @IsInstanceOrArrayOfInstances({ classType: [LinkedDataProof, DataIntegrityProof] })
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

  /**
   * The {@link ClaimFormat} of the presentation. For JSON-LD credentials this is always `ldp_vp`.
   */
  public get claimFormat(): ClaimFormat.LdpVp {
    return ClaimFormat.LdpVp
  }

  /**
   * Get the encoded variant of the W3C Verifiable Presentation. For JSON-LD presentations this is
   * a JSON object.
   */
  public get encoded() {
    return this.toJson()
  }
}
