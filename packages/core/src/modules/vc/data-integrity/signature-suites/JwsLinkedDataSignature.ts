/*!
 * Copyright (c) 2020-2021 Digital Bazaar, Inc. All rights reserved.
 */
import type { DocumentLoader, Proof, VerificationMethod } from '../jsonldUtil'
import type { LdKeyPair } from '../models/LdKeyPair'

import { CredoError } from '../../../../error'
import type { AnyUint8Array, Uint8ArrayBuffer } from '../../../../types'
import { JsonEncoder, TypedArrayEncoder } from '../../../../utils'
import { suites } from '../libraries/jsonld-signatures'

const LinkedDataSignature = suites.LinkedDataSignature
export interface JwsLinkedDataSignatureOptions {
  type: string
  algorithm: string
  LDKeyClass: typeof LdKeyPair
  key?: LdKeyPair
  proof: Proof
  date: string
  contextUrl: string
  useNativeCanonize: boolean
}

export class JwsLinkedDataSignature extends LinkedDataSignature {
  /**
   * @param options - Options hashmap.
   * @param options.type - Provided by subclass.
   * @param options.alg - JWS alg provided by subclass.
   * @param [options.LDKeyClass] - Provided by subclass or subclass
   *   overrides `getVerificationMethod`.
   *
   * Either a `key` OR at least one of `signer`/`verifier` is required.
   *
   * @param [options.key] - An optional key object (containing an
   *   `id` property, and either `signer` or `verifier`, depending on the
   *   intended operation. Useful for when the application is managing keys
   *   itself (when using a KMS, you never have access to the private key,
   *   and so should use the `signer` param instead).
   *
   * Advanced optional parameters and overrides.
   *
   * @param [options.proof] - A JSON-LD document with options to use
   *   for the `proof` node. Any other custom fields can be provided here
   *   using a context different from `security-v2`.
   * @param [options.date] - Signing date to use if not passed.
   * @param options.contextUrl - JSON-LD context url that corresponds
   *   to this signature suite. Used for enforcing suite context during the
   *   `sign()` operation.
   * @param [options.useNativeCanonize] - Whether to use a native
   *   canonize algorithm.
   */
  public constructor(options: JwsLinkedDataSignatureOptions) {
    super({
      type: options.type,
      LDKeyClass: options.LDKeyClass,
      contextUrl: options.contextUrl,
      key: options.key,
      signer: undefined,
      verifier: undefined,
      proof: options.proof,
      date: options.date,
      useNativeCanonize: options.useNativeCanonize,
    })
    this.alg = options.algorithm
  }

  /**
   * @param options - Options hashmap.
   * @param options.verifyData - The data to sign.
   * @param options.proof - A JSON-LD document with options to use
   *   for the `proof` node. Any other custom fields can be provided here
   *   using a context different from `security-v2`.
   *
   * @returns The proof containing the signature value.
   */
  public async sign(options: { verifyData: AnyUint8Array; proof: Proof }) {
    if (!(this.signer && typeof this.signer.sign === 'function')) {
      throw new Error('A signer API has not been specified.')
    }
    // JWS header
    const header = {
      alg: this.alg,
      b64: false,
      crit: ['b64'],
    }

    /*
    +-------+-----------------------------------------------------------+
    | "b64" | JWS Signing Input Formula                                 |
    +-------+-----------------------------------------------------------+
    | true  | ASCII(BASE64URL(UTF8(JWS Protected Header)) || '.' ||     |
    |       | BASE64URL(JWS Payload))                                   |
    |       |                                                           |
    | false | ASCII(BASE64URL(UTF8(JWS Protected Header)) || '.') ||    |
    |       | JWS Payload                                               |
    +-------+-----------------------------------------------------------+
    */

    // create JWS data and sign
    const encodedHeader = JsonEncoder.toBase64URL(header)

    const data = _createJws({ encodedHeader, verifyData: options.verifyData })

    const signature = await this.signer.sign({ data })

    // create detached content signature
    const encodedSignature = TypedArrayEncoder.toBase64URL(signature)
    options.proof.jws = `${encodedHeader}..${encodedSignature}`
    return options.proof
  }

  /**
   * @param options - Options hashmap.
   * @param options.verifyData - The data to verify.
   * @param options.verificationMethod - A verification method.
   * @param options.proof - The proof to be verified.
   *
   * @returns Resolves with the verification result.
   */
  public async verifySignature(options: {
    verifyData: AnyUint8Array
    verificationMethod: VerificationMethod
    proof: Proof
  }) {
    if (!(options.proof.jws && typeof options.proof.jws === 'string' && options.proof.jws.includes('.'))) {
      throw new TypeError('The proof does not include a valid "jws" property.')
    }
    // add payload into detached content signature
    const [encodedHeader /*payload*/, , encodedSignature] = options.proof.jws.split('.')

    // biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
    let header
    try {
      header = JsonEncoder.fromBase64(encodedHeader)
    } catch (e) {
      throw new Error(`Could not parse JWS header; ${e}`)
    }
    if (!(header && typeof header === 'object')) {
      throw new Error('Invalid JWS header.')
    }

    // confirm header matches all expectations
    if (
      !(
        header.alg === this.alg &&
        header.b64 === false &&
        Array.isArray(header.crit) &&
        header.crit.length === 1 &&
        header.crit[0] === 'b64'
      ) &&
      Object.keys(header).length === 3
    ) {
      throw new Error(`Invalid JWS header parameters for ${this.type}.`)
    }

    // do signature verification
    const signature = TypedArrayEncoder.fromBase64(encodedSignature)

    const data = _createJws({ encodedHeader, verifyData: options.verifyData })

    let { verifier } = this
    if (!verifier) {
      const key = await this.LDKeyClass.from(options.verificationMethod)
      verifier = key.verifier()
    }
    return verifier.verify({ data, signature })
  }

  public async getVerificationMethod(options: { proof: Proof; documentLoader?: DocumentLoader }) {
    if (this.key) {
      // This happens most often during sign() operations. For verify(),
      // the expectation is that the verification method will be fetched
      // by the documentLoader (below), not provided as a `key` parameter.
      return this.key.export({ publicKey: true })
    }

    let { verificationMethod } = options.proof

    if (typeof verificationMethod === 'object' && verificationMethod !== null) {
      verificationMethod = verificationMethod.id
    }

    if (!verificationMethod) {
      throw new Error('No "verificationMethod" found in proof.')
    }

    if (!options.documentLoader) {
      throw new CredoError('Missing custom document loader. This is required for resolving verification methods.')
    }

    const { document } = await options.documentLoader(verificationMethod)

    verificationMethod = typeof document === 'string' ? JSON.parse(document) : document

    await this.assertVerificationMethod(verificationMethod)
    return verificationMethod
  }

  /**
   * Checks whether a given proof exists in the document.
   *
   * @param options - Options hashmap.
   * @param options.proof - A proof.
   * @param options.document - A JSON-LD document.
   * @param options.purpose - A jsonld-signatures ProofPurpose
   *  instance (e.g. AssertionProofPurpose, AuthenticationProofPurpose, etc).
   * @param options.documentLoader  - A secure document loader (it is
   *   recommended to use one that provides static known documents, instead of
   *   fetching from the web) for returning contexts, controller documents,
   *   keys, and other relevant URLs needed for the proof.
   *
   * @returns Whether a match for the proof was found.
   */
  public async matchProof(options: {
    proof: Proof
    document: VerificationMethod
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    purpose: any
    documentLoader?: DocumentLoader
  }) {
    const proofMatches = await super.matchProof({
      proof: options.proof,
      document: options.document,
      purpose: options.purpose,
      documentLoader: options.documentLoader,
    })
    if (!proofMatches) {
      return false
    }
    // NOTE: When subclassing this suite: Extending suites will need to check

    if (!this.key) {
      // no key specified, so assume this suite matches and it can be retrieved
      return true
    }

    const { verificationMethod } = options.proof

    // only match if the key specified matches the one in the proof
    if (typeof verificationMethod === 'object') {
      return verificationMethod.id === this.key.id
    }
    return verificationMethod === this.key.id
  }
}

/**
 * Creates the bytes ready for signing.
 *
 * @param {object} options -  Options hashmap.
 * @param {string} options.encodedHeader - A base64url encoded JWT header.
 * @param {Uint8Array} options.verifyData - Payload to sign/verify.
 * @returns {Uint8Array} A combined byte array for signing.
 */
function _createJws(options: { encodedHeader: string; verifyData: AnyUint8Array }): Uint8ArrayBuffer {
  const encodedHeaderBytes = TypedArrayEncoder.fromString(`${options.encodedHeader}.`)

  // concatenate the two uint8arrays
  const data = new Uint8Array(encodedHeaderBytes.length + options.verifyData.length)
  data.set(encodedHeaderBytes, 0)
  data.set(options.verifyData, encodedHeaderBytes.length)
  return data
}
