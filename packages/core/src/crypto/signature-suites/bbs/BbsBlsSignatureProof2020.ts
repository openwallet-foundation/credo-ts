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

/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  DeriveProofOptions,
  DidDocumentPublicKey,
  VerifyProofOptions,
  CreateVerifyDataOptions,
  CanonizeOptions,
} from './types'
import type { VerifyProofResult } from './types/VerifyProofResult'

import { suites, SECURITY_CONTEXT_URL } from '@digitalcredentials/jsonld-signatures'
import { blsCreateProof, blsVerifyProof } from '@mattrglobal/bbs-signatures'
import { Bls12381G2KeyPair } from '@mattrglobal/bls12381-key-pair'
import { randomBytes } from '@stablelib/random'
import jsonld from 'jsonld'

import { TypedArrayEncoder } from '../../../utils'

import { BbsBlsSignature2020 } from './BbsBlsSignature2020'

export class BbsBlsSignatureProof2020 extends suites.LinkedDataProof {
  public constructor({ useNativeCanonize, key, LDKeyClass }: any = {}) {
    super({
      type: 'sec:BbsBlsSignatureProof2020',
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
        'https://w3id.org/security/bbs/v1',
      ],
      type: 'BbsBlsSignatureProof2020',
    }
    this.mappedDerivedProofType = 'https://w3id.org/security#BbsBlsSignature2020'
    this.supportedDeriveProofType = BbsBlsSignatureProof2020.supportedDerivedProofType

    this.LDKeyClass = LDKeyClass ?? Bls12381G2KeyPair
    this.proofSignatureKey = 'proofValue'
    this.key = key
    this.useNativeCanonize = useNativeCanonize
  }

  /**
   * Derive a proof from a proof and reveal document
   *
   * @param options {object} options for deriving a proof.
   *
   * @returns {Promise<object>} Resolves with the derived proof object.
   */
  public async deriveProof(options: DeriveProofOptions): Promise<Record<string, any>> {
    const { document, proof, revealDocument, documentLoader, expansionMap, skipProofCompaction } = options
    let { nonce } = options

    // Validate that the input proof document has a proof compatible with this suite
    if (!BbsBlsSignatureProof2020.supportedDerivedProofType.includes(proof.type)) {
      throw new TypeError(
        `proof document proof incompatible, expected proof types of ${JSON.stringify(
          BbsBlsSignatureProof2020.supportedDerivedProofType
        )} received ${proof.type}`
      )
    }

    //Extract the BBS signature from the input proof
    const signature = TypedArrayEncoder.fromBase64(proof[this.proofSignatureKey])

    //Initialize the BBS signature suite
    const suite = new BbsBlsSignature2020()

    //Initialize the derived proof
    let derivedProof
    if (this.proof) {
      // use proof JSON-LD document passed to API
      derivedProof = await jsonld.compact(this.proof, SECURITY_CONTEXT_URL, {
        documentLoader,
        expansionMap,
        compactToRelative: false,
      })
    } else {
      // create proof JSON-LD document
      derivedProof = { '@context': SECURITY_CONTEXT_URL }
    }

    // ensure proof type is set
    derivedProof.type = this.type

    // Get the input document statements
    const documentStatements = await suite.createVerifyDocumentData(document, {
      documentLoader,
      expansionMap,
      compactProof: !skipProofCompaction,
    })

    // Get the proof statements
    const proofStatements = await suite.createVerifyProofData(proof, {
      documentLoader,
      expansionMap,
      compactProof: !skipProofCompaction,
    })

    // Transform any blank node identifiers for the input
    // document statements into actual node identifiers
    // e.g _:c14n0 => urn:bnid:_:c14n0
    const transformedInputDocumentStatements = documentStatements.map((element) =>
      element.replace(/(_:c14n[0-9]+)/g, '<urn:bnid:$1>')
    )

    //Transform the resulting RDF statements back into JSON-LD
    const compactInputProofDocument = await jsonld.fromRDF(transformedInputDocumentStatements.join('\n'))

    // Frame the result to create the reveal document result
    const revealDocumentResult = await jsonld.frame(compactInputProofDocument, revealDocument, { documentLoader })

    // Canonicalize the resulting reveal document
    const revealDocumentStatements = await suite.createVerifyDocumentData(revealDocumentResult, {
      documentLoader,
      expansionMap,
    })

    //Get the indicies of the revealed statements from the transformed input document offset
    //by the number of proof statements
    const numberOfProofStatements = proofStatements.length

    //Always reveal all the statements associated to the original proof
    //these are always the first statements in the normalized form
    const proofRevealIndicies = Array.from(Array(numberOfProofStatements).keys())

    //Reveal the statements indicated from the reveal document
    const documentRevealIndicies = revealDocumentStatements.map(
      (key) => transformedInputDocumentStatements.indexOf(key) + numberOfProofStatements
    )

    // Check there is not a mismatch
    if (documentRevealIndicies.length !== revealDocumentStatements.length) {
      throw new Error('Some statements in the reveal document not found in original proof')
    }

    // Combine all indicies to get the resulting list of revealed indicies
    const revealIndicies = proofRevealIndicies.concat(documentRevealIndicies)

    // Create a nonce if one is not supplied
    if (!nonce) {
      nonce = await randomBytes(50)
    }

    // Set the nonce on the derived proof
    // derivedProof.nonce = Buffer.from(nonce).toString('base64')
    derivedProof.nonce = TypedArrayEncoder.toBase64(nonce)

    //Combine all the input statements that
    //were originally signed to generate the proof
    const allInputStatements: Uint8Array[] = proofStatements
      .concat(documentStatements)
      .map((item) => new Uint8Array(TypedArrayEncoder.fromString(item)))

    // Fetch the verification method
    const verificationMethod = await this.getVerificationMethod({
      proof,
      document,
      documentLoader,
      expansionMap,
    })

    // Construct a key pair class from the returned verification method
    const key = verificationMethod.publicKeyJwk
      ? await this.LDKeyClass.fromJwk(verificationMethod)
      : await this.LDKeyClass.from(verificationMethod)

    // Compute the proof
    const outputProof = await blsCreateProof({
      signature: new Uint8Array(signature),
      publicKey: new Uint8Array(key.publicKeyBuffer),
      messages: allInputStatements,
      nonce: nonce,
      revealed: revealIndicies,
    })

    // Set the proof value on the derived proof
    derivedProof.proofValue = TypedArrayEncoder.toBase64(outputProof)

    // Set the relevant proof elements on the derived proof from the input proof
    derivedProof.verificationMethod = proof.verificationMethod
    derivedProof.proofPurpose = proof.proofPurpose
    derivedProof.created = proof.created

    return {
      document: { ...revealDocumentResult },
      proof: derivedProof,
    }
  }

  /**
   * @param options {object} options for verifying the proof.
   *
   * @returns {Promise<{object}>} Resolves with the verification result.
   */
  public async verifyProof(options: VerifyProofOptions): Promise<VerifyProofResult> {
    const { document, documentLoader, expansionMap, purpose } = options
    const { proof } = options

    try {
      proof.type = this.mappedDerivedProofType

      // Get the proof statements
      const proofStatements = await this.createVerifyProofData(proof, {
        documentLoader,
        expansionMap,
      })

      // Get the document statements
      const documentStatements = await this.createVerifyProofData(document, {
        documentLoader,
        expansionMap,
      })

      // Transform the blank node identifier placeholders for the document statements
      // back into actual blank node identifiers
      const transformedDocumentStatements = documentStatements.map((element) =>
        element.replace(/<urn:bnid:(_:c14n[0-9]+)>/g, '$1')
      )

      // Combine all the statements to be verified
      const statementsToVerify: Uint8Array[] = proofStatements
        .concat(transformedDocumentStatements)
        .map((item) => new Uint8Array(TypedArrayEncoder.fromString(item)))

      // Fetch the verification method
      const verificationMethod = await this.getVerificationMethod({
        proof,
        document,
        documentLoader,
        expansionMap,
      })

      // Construct a key pair class from the returned verification method
      const key = verificationMethod.publicKeyJwk
        ? await this.LDKeyClass.fromJwk(verificationMethod)
        : await this.LDKeyClass.from(verificationMethod)

      // Verify the proof
      const verified = await blsVerifyProof({
        proof: new Uint8Array(TypedArrayEncoder.fromBase64(proof.proofValue)),
        publicKey: new Uint8Array(key.publicKeyBuffer),
        messages: statementsToVerify,
        nonce: new Uint8Array(TypedArrayEncoder.fromBase64(proof.nonce as string)),
      })

      // Ensure proof was performed for a valid purpose
      const { valid, error } = await purpose.validate(proof, {
        document,
        suite: this,
        verificationMethod,
        documentLoader,
        expansionMap,
      })
      if (!valid) {
        throw error
      }

      return verified
    } catch (error) {
      return { verified: false, error }
    }
  }

  public async canonize(input: any, options: CanonizeOptions): Promise<string> {
    const { documentLoader, expansionMap, skipExpansion } = options
    return jsonld.canonize(input, {
      algorithm: 'URDNA2015',
      format: 'application/n-quads',
      documentLoader,
      expansionMap,
      skipExpansion,
      useNative: this.useNativeCanonize,
    })
  }

  public async canonizeProof(proof: any, options: CanonizeOptions): Promise<string> {
    const { documentLoader, expansionMap } = options
    proof = { ...proof }

    delete proof.nonce
    delete proof.proofValue

    return this.canonize(proof, {
      documentLoader,
      expansionMap,
      skipExpansion: false,
    })
  }

  /**
   * @param document {CreateVerifyDataOptions} options to create verify data
   *
   * @returns {Promise<{string[]>}.
   */
  public async createVerifyData(options: CreateVerifyDataOptions): Promise<string[]> {
    const { proof, document, documentLoader, expansionMap } = options

    const proofStatements = await this.createVerifyProofData(proof, {
      documentLoader,
      expansionMap,
    })
    const documentStatements = await this.createVerifyDocumentData(document, {
      documentLoader,
      expansionMap,
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
  public async createVerifyProofData(proof: any, { documentLoader, expansionMap }: any): Promise<string[]> {
    const c14nProofOptions = await this.canonizeProof(proof, {
      documentLoader,
      expansionMap,
    })

    return c14nProofOptions.split('\n').filter((_) => _.length > 0)
  }

  /**
   * @param document to canonicalize
   * @param options to create verify data
   *
   * @returns {Promise<{string[]>}.
   */
  public async createVerifyDocumentData(document: any, { documentLoader, expansionMap }: any): Promise<string[]> {
    const c14nDocument = await this.canonize(document, {
      documentLoader,
      expansionMap,
    })

    return c14nDocument.split('\n').filter((_) => _.length > 0)
  }

  /**
   * @param document {object} to be signed.
   * @param proof {object}
   * @param documentLoader {function}
   * @param expansionMap {function}
   */
  public async getVerificationMethod({ proof, documentLoader }: any): Promise<DidDocumentPublicKey> {
    let { verificationMethod } = proof

    if (typeof verificationMethod === 'object') {
      verificationMethod = verificationMethod.id
    }
    if (!verificationMethod) {
      throw new Error('No "verificationMethod" found in proof.')
    }

    // Note: `expansionMap` is intentionally not passed; we can safely drop
    // properties here and must allow for it
    const result = await jsonld.frame(
      verificationMethod,
      {
        // adding jws-2020 context to allow publicKeyJwk
        '@context': ['https://w3id.org/security/v2', 'https://w3id.org/security/suites/jws-2020/v1'],
        '@embed': '@always',
        id: verificationMethod,
      },
      {
        documentLoader,
        compactToRelative: false,
        expandContext: SECURITY_CONTEXT_URL,
      }
    )
    if (!result) {
      throw new Error(`Verification method ${verificationMethod} not found.`)
    }

    // ensure verification method has not been revoked
    if (result.revoked !== undefined) {
      throw new Error('The verification method has been revoked.')
    }

    return result
  }

  public static proofType = [
    'BbsBlsSignatureProof2020',
    'sec:BbsBlsSignatureProof2020',
    'https://w3id.org/security#BbsBlsSignatureProof2020',
  ]

  public static supportedDerivedProofType = [
    'BbsBlsSignature2020',
    'sec:BbsBlsSignature2020',
    'https://w3id.org/security#BbsBlsSignature2020',
  ]
}
