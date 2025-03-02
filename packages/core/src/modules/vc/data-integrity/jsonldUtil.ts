import type { JsonObject, JsonValue } from '../../../types'
import type { GetProofsOptions } from './models/GetProofsOptions'
import type { GetProofsResult } from './models/GetProofsResult'
import type { GetTypeOptions } from './models/GetTypeOptions'

import { CredoError } from '../../../error'
import { SECURITY_CONTEXT_URL } from '../constants'

import jsonld from './libraries/jsonld'
import { W3cJsonLdVerifiableCredential } from './models/W3cJsonLdVerifiableCredential'

export type JsonLdDoc = Record<string, unknown>
export interface VerificationMethod extends JsonObject {
  id: string
  [key: string]: JsonValue
}

export interface Proof extends JsonObject {
  verificationMethod: string | VerificationMethod
  [key: string]: JsonValue
}

export interface DocumentLoaderResult {
  contextUrl?: string | null
  documentUrl: string
  document: Record<string, unknown>
}

export type DocumentLoader = (url: string) => Promise<DocumentLoaderResult>

export const _includesContext = (options: { document: JsonLdDoc; contextUrl: string }) => {
  const context = options.document['@context']

  return context === options.contextUrl || (Array.isArray(context) && context.includes(options.contextUrl))
}

export function assertOnlyW3cJsonLdVerifiableCredentials(
  credentials: unknown[]
): asserts credentials is W3cJsonLdVerifiableCredential[] {
  if (credentials.some((c) => !(c instanceof W3cJsonLdVerifiableCredential))) {
    throw new CredoError('JSON-LD VPs can only contain JSON-LD VCs')
  }
}

/*
 * The code in this file originated from
 * @see https://github.com/digitalbazaar/jsonld-signatures
 * Hence the following copyright notice applies
 *
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */

/**
 * The property identifying the linked data proof
 * Note - this will not work for legacy systems that
 * relying on `signature`
 */
const PROOF_PROPERTY = 'proof'

/**
 * Gets a supported linked data proof from a JSON-LD Document
 * Note - unless instructed not to the document will be compacted
 * against the security v2 context @see https://w3id.org/security/v2
 *
 * @param options Options for extracting the proof from the document
 *
 * @returns {GetProofsResult} An object containing the matched proofs and the JSON-LD document
 */
export const getProofs = async (options: GetProofsOptions): Promise<GetProofsResult> => {
  const { proofType, skipProofCompaction, documentLoader } = options
  let { document } = options

  // biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
  let proofs
  if (!skipProofCompaction) {
    // If we must compact the proof then we must first compact the input
    // document to find the proof
    document = await jsonld.compact(document, SECURITY_CONTEXT_URL, {
      documentLoader,
      compactToRelative: false,
    })
  }

  // @ts-ignore - needed because getValues is not part of the public API.
  proofs = jsonld.getValues(document, PROOF_PROPERTY)
  delete document[PROOF_PROPERTY]

  if (typeof proofType === 'string') {
    proofs = proofs.filter((_: Record<string, unknown>) => _.type === proofType)
  }
  if (Array.isArray(proofType)) {
    proofs = proofs.filter((_: Record<string, unknown>) => proofType.includes(_.type))
  }

  proofs = proofs.map((matchedProof: Record<string, unknown>) => ({
    '@context': SECURITY_CONTEXT_URL,
    ...matchedProof,
  }))

  return {
    proofs,
    document,
  }
}

/**
 * Gets the JSON-LD type information for a document
 * @param document {any} JSON-LD document to extract the type information from
 * @param options {GetTypeInfoOptions} Options for extracting the JSON-LD document
 *
 * @returns {object} Type info for the JSON-LD document
 */
export const getTypeInfo = async (
  document: JsonObject,
  options: GetTypeOptions
): Promise<{ types: string[]; alias: string }> => {
  const { documentLoader } = options

  // determine `@type` alias, if any
  // @ts-ignore - needed because getValues is not part of the public API.
  const context = jsonld.getValues(document, '@context')

  const compacted = await jsonld.compact({ '@type': '_:b0' }, context, {
    documentLoader,
  })

  delete compacted['@context']

  const alias = Object.keys(compacted)[0]

  // optimize: expand only `@type` and `type` values
  const toExpand: Record<string, unknown> = { '@context': context }

  // @ts-ignore - needed because getValues is not part of the public API.
  toExpand['@type'] = jsonld.getValues(document, '@type').concat(jsonld.getValues(document, alias))

  const expanded = (await jsonld.expand(toExpand, { documentLoader }))[0] || {}

  // @ts-ignore - needed because getValues is not part of the public API.
  return { types: jsonld.getValues(expanded, '@type'), alias }
}
