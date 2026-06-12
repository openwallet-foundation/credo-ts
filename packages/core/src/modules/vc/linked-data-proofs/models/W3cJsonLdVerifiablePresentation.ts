import { CredoError } from '../../../../error'
import type { SingleOrArray } from '../../../../types'
import { asArray, IsInstanceOrArrayOfInstances, JsonTransformer } from '../../../../utils'
import type { AnonCredsVc1BridgeProofOptions } from '../../anoncreds-vc1-bridge/AnonCredsVc1BridgeProof'
import { AnonCredsVc1BridgeProof } from '../../anoncreds-vc1-bridge/AnonCredsVc1BridgeProof'
import { ANONCREDS_VC1_BRIDGE_CRYPTOSUITE } from '../../anoncreds-vc1-bridge/IAnonCredsVc1BridgeService'
import { ClaimFormat } from '../../models'
import type { W3cPresentationOptions } from '../../models/presentation/W3cPresentation'
import { W3cPresentation } from '../../models/presentation/W3cPresentation'
import { ProofTransformer } from '../proof-ops/ProofTransformer'
import type { LinkedDataProofOptions } from './LinkedDataProof'
import { LinkedDataProof } from './LinkedDataProof'

export interface W3cJsonLdVerifiablePresentationOptions extends W3cPresentationOptions {
  proof: LinkedDataProofOptions | AnonCredsVc1BridgeProofOptions
}

const mapProofOptionToProofClass = (proof: LinkedDataProofOptions | AnonCredsVc1BridgeProofOptions) => {
  if ('cryptosuite' in proof) {
    if (proof.type !== 'DataIntegrityProof' || proof.cryptosuite !== ANONCREDS_VC1_BRIDGE_CRYPTOSUITE) {
      throw new CredoError(
        `VC1 bridge proofs only support DataIntegrityProof with cryptosuite ${ANONCREDS_VC1_BRIDGE_CRYPTOSUITE}`
      )
    }

    return new AnonCredsVc1BridgeProof(proof)
  }

  return new LinkedDataProof(proof)
}

export class W3cJsonLdVerifiablePresentation extends W3cPresentation {
  public constructor(options: W3cJsonLdVerifiablePresentationOptions) {
    super(options)
    if (options) {
      this.proof = mapProofOptionToProofClass(options.proof)
    }
  }

  @ProofTransformer()
  @IsInstanceOrArrayOfInstances({ classType: [LinkedDataProof, AnonCredsVc1BridgeProof] })
  public proof!: SingleOrArray<LinkedDataProof | AnonCredsVc1BridgeProof>

  public get proofTypes(): Array<string> {
    const proofArray = asArray(this.proof) ?? []
    return proofArray.map((proof) => proof.type)
  }

  public get anoncredsVc1BridgeCryptosuites(): Array<string> {
    const proofArray = asArray(this.proof) ?? []
    return proofArray
      .filter(
        (proof): proof is AnonCredsVc1BridgeProof => proof.type === 'DataIntegrityProof' && 'cryptosuite' in proof
      )
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
