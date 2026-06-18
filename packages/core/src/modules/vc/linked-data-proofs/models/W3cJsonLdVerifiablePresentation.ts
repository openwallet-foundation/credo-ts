import { CredoError } from '../../../../error'
import type { SingleOrArray } from '../../../../types'
import { asArray, IsInstanceOrArrayOfInstances, JsonTransformer } from '../../../../utils'
import type { AnonCredsW3cBridgeProofOptions } from '../../anoncreds-w3c-bridge'
import { ANONCREDS_W3C_BRIDGE_CRYPTOSUITE, AnonCredsW3cBridgeProof } from '../../anoncreds-w3c-bridge'
import { ClaimFormat } from '../../models'
import type { W3cPresentationOptions } from '../../models/presentation/W3cPresentation'
import { W3cPresentation } from '../../models/presentation/W3cPresentation'
import { ProofTransformer } from '../proof-ops/ProofTransformer'
import type { LinkedDataProofOptions } from './LinkedDataProof'
import { LinkedDataProof } from './LinkedDataProof'

export interface W3cJsonLdVerifiablePresentationOptions extends W3cPresentationOptions {
  proof: LinkedDataProofOptions | AnonCredsW3cBridgeProofOptions
}

const mapProofOptionToProofClass = (proof: LinkedDataProofOptions | AnonCredsW3cBridgeProofOptions) => {
  if ('cryptosuite' in proof) {
    if (proof.type !== 'DataIntegrityProof' || proof.cryptosuite !== ANONCREDS_W3C_BRIDGE_CRYPTOSUITE) {
      throw new CredoError(
        `W3C bridge proofs only support DataIntegrityProof with cryptosuite ${ANONCREDS_W3C_BRIDGE_CRYPTOSUITE}`
      )
    }

    return new AnonCredsW3cBridgeProof(proof)
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
  @IsInstanceOrArrayOfInstances({ classType: [LinkedDataProof, AnonCredsW3cBridgeProof] })
  public proof!: SingleOrArray<LinkedDataProof | AnonCredsW3cBridgeProof>

  public get proofTypes(): Array<string> {
    const proofArray = asArray(this.proof) ?? []
    return proofArray.map((proof) => proof.type)
  }

  public get anoncredsW3cBridgeCryptosuites(): Array<string> {
    const proofArray = asArray(this.proof) ?? []
    return proofArray
      .filter(
        (proof): proof is AnonCredsW3cBridgeProof => proof.type === 'DataIntegrityProof' && 'cryptosuite' in proof
      )
      .map((proof) => proof.cryptosuite)
  }

  /** @deprecated Use anoncredsW3cBridgeCryptosuites */
  public get dataIntegrityCryptosuites(): Array<string> {
    return this.anoncredsW3cBridgeCryptosuites
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
