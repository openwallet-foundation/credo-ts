import { CredoError } from '../../../error'
import { JsonTransformer, MessageValidator } from '../../../utils'
import { ClaimFormat } from '../models/ClaimFormat'
import { W3cV2Credential } from '../models/credential/W3cV2Credential'

export interface W3cV2DataIntegrityVerifiableCredentialOptions {
  securedCredential: Record<string, unknown> & { proof: unknown }
}

/**
 * Represents a Verifiable Credential secured with Data Integrity proof(s).
 *
 * @see https://www.w3.org/TR/vc-data-integrity/
 */
export class W3cV2DataIntegrityVerifiableCredential {
  public constructor(options: W3cV2DataIntegrityVerifiableCredentialOptions) {
    this.securedCredential = options.securedCredential
    this.resolvedCredential = JsonTransformer.fromJSON(options.securedCredential, W3cV2Credential, {
      validate: false,
    })

    // Validates the credential structure and proof presence
    this.validate()
  }

  public static fromObject(credential: Record<string, unknown> & { proof: unknown }) {
    return new W3cV2DataIntegrityVerifiableCredential({
      securedCredential: credential,
    })
  }

  /**
   * The original credential object with embedded Data Integrity proof(s).
   */
  public readonly securedCredential: Record<string, unknown> & { proof: unknown }

  /**
   * Resolved credential is the fully resolved {@link W3cV2Credential} instance.
   */
  public readonly resolvedCredential: W3cV2Credential

  /**
   * The JSON representation of this credential.
   */
  public get encoded() {
    return JSON.stringify(this.securedCredential)
  }

  /**
   * The {@link ClaimFormat} of the credential.
   *
   * For W3C VC Data Integrity credentials this is always `di_vc`.
   */
  public get claimFormat(): ClaimFormat.DiVc {
    return ClaimFormat.DiVc
  }

  /**
   * Validates the credential and proof structure.
   */
  public validate() {
    // Validate the resolved credential according to the data model
    MessageValidator.validateSync(this.resolvedCredential)

    // Validate that proof field exists and is properly structured
    const proof = this.securedCredential.proof
    if (!proof) {
      throw new CredoError('The provided credential does not have a proof field.')
    }

    // Proof should be either a single proof object or an array of proofs
    if (typeof proof !== 'object') {
      throw new CredoError('The proof field must be an object or array of objects.')
    }

    if (
      !Array.isArray(proof) &&
      typeof proof === 'object' &&
      (!('type' in proof) || proof.type !== 'DataIntegrityProof')
    ) {
      throw new CredoError('The proof must have type "DataIntegrityProof".')
    }

    if (Array.isArray(proof)) {
      for (const p of proof) {
        if (typeof p !== 'object' || !('type' in p) || p.type !== 'DataIntegrityProof') {
          throw new CredoError('All proofs in the proof array must have type "DataIntegrityProof".')
        }
      }
    }
  }
}
