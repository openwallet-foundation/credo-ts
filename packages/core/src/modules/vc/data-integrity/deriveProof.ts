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

import type { JsonObject } from '../../../types'

import { JsonTransformer } from '../../../utils'
import { SECURITY_PROOF_URL } from '../constants'

import { getProofs, getTypeInfo } from './jsonldUtil'
import jsonld from './libraries/jsonld'
import { W3cJsonLdVerifiableCredential } from './models/W3cJsonLdVerifiableCredential'

export interface W3cJsonLdDeriveProofOptions {
  credential: W3cJsonLdVerifiableCredential
  revealDocument: JsonObject
  verificationMethod: string
}

/**
 * Derives a proof from a document featuring a supported linked data proof
 *
 * NOTE - This is a temporary API extending JSON-LD signatures
 *
 * @param proofDocument A document featuring a linked data proof capable of proof derivation
 * @param revealDocument A document of the form of a JSON-LD frame describing the terms to selectively derive from the proof document
 * @param options Options for proof derivation
 */
export const deriveProof = async (
  proofDocument: JsonObject,
  revealDocument: JsonObject,
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  { suite, skipProofCompaction, documentLoader, nonce }: any
): Promise<W3cJsonLdVerifiableCredential> => {
  if (!suite) {
    throw new TypeError('"options.suite" is required.')
  }

  if (Array.isArray(proofDocument)) {
    throw new TypeError('proofDocument should be an object not an array.')
  }

  const { proofs, document } = await getProofs({
    document: proofDocument,
    proofType: suite.supportedDeriveProofType,
    documentLoader,
  })

  if (proofs.length === 0) {
    throw new Error('There were not any proofs provided that can be used to derive a proof with this suite.')
  }

  let derivedProof = await suite.deriveProof({
    document,
    proof: proofs[0],
    revealDocument,
    documentLoader,

    nonce,
  })

  if (proofs.length > 1) {
    // convert the proof property value from object ot array of objects
    derivedProof = { ...derivedProof, proof: [derivedProof.proof] }

    // drop the first proof because it's already been processed
    proofs.splice(0, 1)

    // add all the additional proofs to the derivedProof document
    for (const proof of proofs) {
      const additionalDerivedProofValue = await suite.deriveProof({
        document,
        proof,
        revealDocument,
        documentLoader,
      })
      derivedProof.proof.push(additionalDerivedProofValue.proof)
    }
  }

  if (!skipProofCompaction) {
    const expandedProof: Record<string, unknown> = {
      [SECURITY_PROOF_URL]: {
        '@graph': derivedProof.proof,
      },
    }

    // account for type-scoped `proof` definition by getting document types
    const { types, alias } = await getTypeInfo(derivedProof.document, {
      documentLoader,
    })

    expandedProof['@type'] = types

    const ctx = jsonld.getValues(derivedProof.document, '@context')

    const compactProof = await jsonld.compact(expandedProof, ctx, {
      documentLoader,
      compactToRelative: false,
    })

    delete compactProof[alias]
    // biome-ignore lint/performance/noDelete: <explanation>
    delete compactProof['@context']

    /**
     * removes the @included tag when multiple proofs exist because the
     * @included tag messes up the canonicalized bytes leading to a bad
     * signature that won't verify.
     **/
    if (compactProof.proof?.['@included']) {
      compactProof.proof = compactProof.proof['@included']
    }

    // add proof to document
    const key = Object.keys(compactProof)[0]
    jsonld.addValue(derivedProof.document, key, compactProof[key])
  } else {
    // biome-ignore lint/performance/noDelete: <explanation>
    delete derivedProof.proof['@context']
    jsonld.addValue(derivedProof.document, 'proof', derivedProof.proof)
  }

  return JsonTransformer.fromJSON(derivedProof.document, W3cJsonLdVerifiableCredential)
}
