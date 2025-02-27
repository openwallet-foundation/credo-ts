/*
 * Copyright 2020 - MATTR Limited
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { DocumentLoader, JsonObject, Proof, VerificationMethod } from '@credo-ts/core'
import type {
  CanonizeOptions,
  CreateProofOptions,
  CreateVerifyDataOptions,
  SignatureSuiteOptions,
  SuiteSignOptions,
  VerifyProofOptions,
  VerifySignatureOptions,
} from '../types'

import {
  CredoError,
  SECURITY_CONTEXT_BBS_URL,
  SECURITY_CONTEXT_URL,
  TypedArrayEncoder,
  vcLibraries,
  w3cDate,
} from '@credo-ts/core'

const { jsonld, jsonldSignatures } = vcLibraries
const LinkedDataProof = jsonldSignatures.suites.LinkedDataProof

/**
 * A BBS+ signature suite for use with BLS12-381 key pairs
 */
export class BbsBlsSignature2020 extends LinkedDataProof {
  private proof: Record<string, unknown>
  /**
   * Default constructor
   * @param options {SignatureSuiteOptions} options for constructing the signature suite
   */
  public constructor(options: SignatureSuiteOptions = {}) {
    const { verificationMethod, signer, key, date, useNativeCanonize, LDKeyClass } = options
    // validate common options
    if (verificationMethod !== undefined && typeof verificationMethod !== 'string') {
      throw new TypeError('"verificationMethod" must be a URL string.')
    }
    super({
      type: 'BbsBlsSignature2020',
    })

    this.proof = {
      '@context': [
        {
          sec: 'https://w3id.org/security#',
          proof: {
            '@id': 'sec:proof',
            '@type': '@id',
            '@container': '@graph',
          },
        },
        SECURITY_CONTEXT_BBS_URL,
      ],
      type: 'BbsBlsSignature2020',
    }

    this.LDKeyClass = LDKeyClass
    this.signer = signer
    this.verificationMethod = verificationMethod
    this.proofSignatureKey = 'proofValue'
    if (key) {
      if (verificationMethod === undefined) {
        this.verificationMethod = key.id
      }
      this.key = key
      if (typeof key.signer === 'function') {
        this.signer = key.signer()
      }
      if (typeof key.verifier === 'function') {
        this.verifier = key.verifier()
      }
    }
    if (date) {
      this.date = new Date(date)

      if (Number.isNaN(this.date)) {
        throw TypeError(`"date" "${date}" is not a valid date.`)
      }
    }
    this.useNativeCanonize = useNativeCanonize
  }

  public ensureSuiteContext({ document }: { document: Record<string, unknown> }) {
    if (
      document['@context'] === SECURITY_CONTEXT_BBS_URL ||
      (Array.isArray(document['@context']) && document['@context'].includes(SECURITY_CONTEXT_BBS_URL))
    ) {
      // document already includes the required context
      return
    }
    throw new TypeError(`The document to be signed must contain this suite's @context, "${SECURITY_CONTEXT_BBS_URL}".`)
  }

  /**
   * @param options {CreateProofOptions} options for creating the proof
   *
   * @returns {Promise<object>} Resolves with the created proof object.
   */
  public async createProof(options: CreateProofOptions): Promise<Record<string, unknown>> {
    const { document, purpose, documentLoader, compactProof } = options

    let proof: JsonObject

    // use proof JSON-LD document passed to API
    if (this.proof) {
      proof = await jsonld.compact(this.proof, SECURITY_CONTEXT_URL, {
        documentLoader,
        compactToRelative: true,
      })
    } else {
      // create proof JSON-LD document
      proof = { '@context': SECURITY_CONTEXT_URL }
    }

    // ensure proof type is set
    proof.type = this.type

    // set default `now` date if not given in `proof` or `options`
    let date = this.date
    if (proof.created === undefined && date === undefined) {
      date = new Date()
    }

    // ensure date is in string format
    if (date !== undefined && typeof date !== 'string') {
      date = w3cDate(date)
    }

    // add API overrides
    if (date !== undefined) {
      proof.created = date
    }

    if (this.verificationMethod !== undefined) {
      proof.verificationMethod = this.verificationMethod
    }

    // allow purpose to update the proof; the `proof` is in the
    // SECURITY_CONTEXT_URL `@context` -- therefore the `purpose` must
    // ensure any added fields are also represented in that same `@context`
    proof = await purpose.update(proof, {
      document,
      suite: this,
      documentLoader,
    })

    // create data to sign
    const verifyData = (
      await this.createVerifyData({
        document,
        proof,
        documentLoader,

        compactProof,
      })
    ).map((item) => new Uint8Array(TypedArrayEncoder.fromString(item)))

    // sign data
    proof = await this.sign({
      verifyData,
      document,
      proof,
      documentLoader,
    })
    delete proof['@context']

    return proof
  }

  /**
   * @param options {object} options for verifying the proof.
   *
   * @returns {Promise<{object}>} Resolves with the verification result.
   */
  public async verifyProof(options: VerifyProofOptions): Promise<Record<string, unknown>> {
    const { proof, document, documentLoader, purpose } = options

    try {
      // create data to verify
      const verifyData = (
        await this.createVerifyData({
          document,
          proof,
          documentLoader,
          compactProof: false,
        })
      ).map((item) => new Uint8Array(TypedArrayEncoder.fromString(item)))

      // fetch verification method
      const verificationMethod = await this.getVerificationMethod({
        proof,
        documentLoader,
      })

      // verify signature on data
      const verified = await this.verifySignature({
        verifyData,
        verificationMethod,
        document,
        proof,
        documentLoader,
      })
      if (!verified) {
        throw new Error('Invalid signature.')
      }

      // ensure proof was performed for a valid purpose
      const { valid, error } = await purpose.validate(proof, {
        document,
        suite: this,
        verificationMethod,
        documentLoader,
      })
      if (!valid) {
        throw error
      }

      return { verified: true }
    } catch (error) {
      return { verified: false, error }
    }
  }

  public async canonize(input: Record<string, unknown>, options: CanonizeOptions): Promise<string> {
    const { documentLoader, skipExpansion } = options
    return jsonld.canonize(input, {
      algorithm: 'URDNA2015',
      format: 'application/n-quads',
      documentLoader,
      skipExpansion,
      useNative: this.useNativeCanonize,
    })
  }

  public async canonizeProof(proof: Record<string, unknown>, options: CanonizeOptions): Promise<string> {
    const { documentLoader } = options
    // biome-ignore lint/style/noParameterAssign: <explanation>
    proof = { ...proof }
    delete proof[this.proofSignatureKey]
    return this.canonize(proof, {
      documentLoader,
      skipExpansion: false,
    })
  }

  /**
   * @param document {CreateVerifyDataOptions} options to create verify data
   *
   * @returns {Promise<{string[]>}.
   */
  public async createVerifyData(options: CreateVerifyDataOptions): Promise<string[]> {
    const { proof, document, documentLoader } = options

    const proof2 = { ...proof, '@context': document['@context'] }

    const proofStatements = await this.createVerifyProofData(proof2, {
      documentLoader,
    })
    const documentStatements = await this.createVerifyDocumentData(document, {
      documentLoader,
    })

    // concatenate c14n proof options and c14n document
    return proofStatements.concat(documentStatements)
  }

  /**
   * @param proof to canonicalize
   * @param options to create verify data
   *
   * @returns {Promise<{string[]>}.
   */
  public async createVerifyProofData(
    proof: Record<string, unknown>,
    { documentLoader }: { documentLoader?: DocumentLoader }
  ): Promise<string[]> {
    const c14nProofOptions = await this.canonizeProof(proof, {
      documentLoader,
    })

    return c14nProofOptions.split('\n').filter((_) => _.length > 0)
  }

  /**
   * @param document to canonicalize
   * @param options to create verify data
   *
   * @returns {Promise<{string[]>}.
   */
  public async createVerifyDocumentData(
    document: Record<string, unknown>,
    { documentLoader }: { documentLoader?: DocumentLoader }
  ): Promise<string[]> {
    const c14nDocument = await this.canonize(document, {
      documentLoader,
    })

    return c14nDocument.split('\n').filter((_) => _.length > 0)
  }

  /**
   * @param document {object} to be signed.
   * @param proof {object}
   * @param documentLoader {function}
   */
  public async getVerificationMethod({
    proof,
    documentLoader,
  }: {
    proof: Proof
    documentLoader?: DocumentLoader
  }): Promise<VerificationMethod> {
    let { verificationMethod } = proof

    if (typeof verificationMethod === 'object' && verificationMethod !== null) {
      verificationMethod = verificationMethod.id
    }

    if (!verificationMethod) {
      throw new Error('No "verificationMethod" found in proof.')
    }

    if (!documentLoader) {
      throw new CredoError('Missing custom document loader. This is required for resolving verification methods.')
    }

    const { document } = await documentLoader(verificationMethod)

    if (!document) {
      throw new Error(`Verification method ${verificationMethod} not found.`)
    }

    // ensure verification method has not been revoked
    if (document.revoked !== undefined) {
      throw new Error('The verification method has been revoked.')
    }

    return document as unknown as VerificationMethod
  }

  /**
   * @param options {SuiteSignOptions} Options for signing.
   *
   * @returns {Promise<{object}>} the proof containing the signature value.
   */
  public async sign(options: SuiteSignOptions): Promise<Proof> {
    const { verifyData, proof } = options

    if (!(this.signer && typeof this.signer.sign === 'function')) {
      throw new Error('A signer API with sign function has not been specified.')
    }

    const proofValue: Uint8Array = await this.signer.sign({
      data: verifyData,
    })

    proof[this.proofSignatureKey] = TypedArrayEncoder.toBase64(proofValue)

    return proof as Proof
  }

  /**
   * @param verifyData {VerifySignatureOptions} Options to verify the signature.
   *
   * @returns {Promise<boolean>}
   */
  public async verifySignature(options: VerifySignatureOptions): Promise<boolean> {
    const { verificationMethod, verifyData, proof } = options
    let { verifier } = this

    if (!verifier) {
      const key = await this.LDKeyClass.from(verificationMethod)
      verifier = key.verifier(key, this.alg, this.type)
    }

    return await verifier.verify({
      data: verifyData,
      signature: new Uint8Array(TypedArrayEncoder.fromBase64(proof[this.proofSignatureKey] as string)),
    })
  }

  public static proofType = [
    'BbsBlsSignature2020',
    'sec:BbsBlsSignature2020',
    'https://w3id.org/security#BbsBlsSignature2020',
  ]
}
