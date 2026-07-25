import { ValidateNested } from 'class-validator'
import { CredoError } from '../../../../error'
import type { SingleOrArray } from '../../../../types'
import { asArray, IsInstanceOrArrayOfInstances, JsonTransformer, mapSingleOrArray } from '../../../../utils'
import type { AnonCredsW3cCredentialProofOptions } from '../../anoncreds-w3c-credential'
import { ANONCREDS_W3C_CREDENTIAL_CRYPTOSUITE, AnonCredsW3cCredentialProof } from '../../anoncreds-w3c-credential'
import { ClaimFormat } from '../../models/ClaimFormat'
import type { W3cCredentialOptions } from '../../models/credential/W3cCredential'
import { W3cCredential } from '../../models/credential/W3cCredential'
import type { W3cJsonCredential } from '../../models/credential/W3cJsonCredential'
import { ProofTransformer } from '../proof-ops/ProofTransformer'
import type { LinkedDataProofOptions } from './LinkedDataProof'
import { LinkedDataProof } from './LinkedDataProof'

export interface W3cJsonLdVerifiableCredentialOptions extends W3cCredentialOptions {
  proof: SingleOrArray<LinkedDataProofOptions | AnonCredsW3cCredentialProofOptions>
}

const mapProofOptionToProofClass = (proof: LinkedDataProofOptions | AnonCredsW3cCredentialProofOptions) => {
  if ('cryptosuite' in proof) {
    if (proof.type !== 'DataIntegrityProof' || proof.cryptosuite !== ANONCREDS_W3C_CREDENTIAL_CRYPTOSUITE) {
      throw new CredoError(
        `W3C credential proofs only support DataIntegrityProof with cryptosuite ${ANONCREDS_W3C_CREDENTIAL_CRYPTOSUITE}`
      )
    }

    return new AnonCredsW3cCredentialProof(proof)
  }

  return new LinkedDataProof(proof)
}

export class W3cJsonLdVerifiableCredential extends W3cCredential {
  public constructor(options: W3cJsonLdVerifiableCredentialOptions) {
    super(options)
    if (options) {
      this.proof = mapSingleOrArray(options.proof, mapProofOptionToProofClass)
    }
  }

  @ProofTransformer()
  @IsInstanceOrArrayOfInstances({ classType: [LinkedDataProof, AnonCredsW3cCredentialProof] })
  @ValidateNested()
  public proof!: SingleOrArray<LinkedDataProof | AnonCredsW3cCredentialProof>

  public get proofTypes(): Array<string> {
    const proofArray = asArray(this.proof) ?? []
    return proofArray.map((proof) => proof.type)
  }

  public get anoncredsW3cCredentialCryptosuites(): Array<string> {
    const proofArray = asArray(this.proof) ?? []
    return proofArray
      .filter(
        (proof): proof is AnonCredsW3cCredentialProof => proof.type === 'DataIntegrityProof' && 'cryptosuite' in proof
      )
      .map((proof) => proof.cryptosuite)
  }

  /** @deprecated Use anoncredsW3cCredentialCryptosuites */
  public get dataIntegrityCryptosuites(): Array<string> {
    return this.anoncredsW3cCredentialCryptosuites
  }

  public toJson() {
    return JsonTransformer.toJSON(this) as W3cJsonCredential
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
