import type { JsonObject } from '../../../../types'
import type { DocumentLoader, Proof } from '../jsonldUtil'

import { purposes, suites } from '../libraries/jsonld-signatures'

const AssertionProofPurpose = purposes.AssertionProofPurpose
const LinkedDataProof = suites.LinkedDataProof
/**
 * Creates a proof purpose that will validate whether or not the verification
 * method in a proof was authorized by its declared controller for the
 * proof's purpose.
 */
export class CredentialIssuancePurpose extends AssertionProofPurpose {
  /**
   * @param {object} options - The options to use.
   * @param {object} [options.controller] - The description of the controller,
   *   if it is not to be dereferenced via a `documentLoader`.
   * @param {string|Date|number} [options.date] - The expected date for
   *   the creation of the proof.
   * @param {number} [options.maxTimestampDelta=Infinity] - A maximum number
   *   of seconds that the date on the signature can deviate from.
   */
  public constructor(options: { controller?: Record<string, unknown>; date: string; maxTimestampDelta?: number }) {
    options.maxTimestampDelta = options.maxTimestampDelta || Number.POSITIVE_INFINITY
    super(options)
  }

  /**
   * Validates the purpose of a proof. This method is called during
   * proof verification, after the proof value has been checked against the
   * given verification method (in the case of a digital signature, the
   * signature has been cryptographically verified against the public key).
   *
   * @param {object} proof - The proof to validate.
   * @param {object} options - The options to use.
   * @param {object} options.document - The document whose signature is
   *   being verified.
   * @param {object} options.suite - Signature suite used in
   *   the proof.
   * @param {string} options.verificationMethod - Key id URL to the paired
   *   public key.
   * @param {object} [options.documentLoader] - A document loader.
   *
   * @throws {Error} If verification method not authorized by controller.
   * @throws {Error} If proof's created timestamp is out of range.
   *
   * @returns {Promise<{valid: boolean, error: Error}>} Resolves on completion.
   */
  public async validate(
    proof: Proof,
    options?: {
      document: JsonObject
      suite: typeof LinkedDataProof
      verificationMethod: string
      documentLoader?: DocumentLoader
    }
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  ): Promise<{ valid: boolean; error?: any }> {
    try {
      const result = await super.validate(proof, options)

      if (!result.valid) {
        throw result.error
      }

      // This @ts-ignore is necessary because the .getValues() method is not part of the public API.
      //@ts-ignore
      const issuer = jsonld.util.getValues(options.document, 'issuer')

      if (!issuer || issuer.length === 0) {
        throw new Error('Credential issuer is required.')
      }

      const issuerId = typeof issuer[0] === 'string' ? issuer[0] : issuer[0].id

      if (result.controller.id !== issuerId) {
        throw new Error('Credential issuer must match the verification method controller.')
      }

      return { valid: true }
    } catch (error) {
      return { valid: false, error }
    }
  }
}
