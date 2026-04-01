import { CredoError } from '../../../../error'
import {
  JsonEncoder,
  JsonTransformer,
  MultiBaseEncoder,
  MultiHashEncoder,
  TypedArrayEncoder,
  VarintEncoder,
} from '../../../../utils'
import { Buffer } from '../../../../utils/buffer'
import { Ed25519PublicJwk } from '../../../kms'
import { DidDocument } from '../../domain'
import { getPublicJwkFromVerificationMethod } from '../../domain/key-type'
import { parseDid } from '../../domain/parse'
import type { VerificationMethod } from '../../domain/verificationMethod'
import { DidKey } from '../key/DidKey'

const LONG_RE = /^did:peer:4(z[1-9a-km-zA-HJ-NP-Z]{46}):(z[1-9a-km-zA-HJ-NP-Z]{6,})$/
const SHORT_RE = /^did:peer:4(z[1-9a-km-zA-HJ-NP-Z]{46})$/
const JSON_MULTICODEC_VARINT = 0x0200

export const isShortFormDidPeer4 = (did: string) => SHORT_RE.test(did)
export const isLongFormDidPeer4 = (did: string) => LONG_RE.test(did)

const hashEncodedDocument = (encodedDocument: string) =>
  MultiBaseEncoder.encode(
    MultiHashEncoder.encode(TypedArrayEncoder.fromString(encodedDocument), 'sha-256'),
    'base58btc'
  )

export function getAlternativeDidsForNumAlgo4Did(did: string) {
  const match = did.match(LONG_RE)
  if (!match) return
  const [, hash] = match
  return [`did:peer:4${hash}`]
}

/** Short form for a did:peer:4 DID (long or short), or undefined if not num-algo 4. */
export function getDidPeer4ShortFormForEquivalence(did: string): string | undefined {
  if (isShortFormDidPeer4(did)) return did
  if (isLongFormDidPeer4(did)) return getAlternativeDidsForNumAlgo4Did(did)?.[0]
  return undefined
}

/** True when both strings are the same did:peer:4 identity (short vs long encodings). */
export function areEquivalentDidPeer4Forms(a: string, b: string): boolean {
  if (a === b) return true
  const shortA = getDidPeer4ShortFormForEquivalence(a)
  const shortB = getDidPeer4ShortFormForEquivalence(b)
  return Boolean(shortA && shortB && shortA === shortB)
}

function collectVerificationMethodsFromPurpose(
  doc: DidDocument,
  refs: Array<string | VerificationMethod> | undefined
): VerificationMethod[] {
  const methods: VerificationMethod[] = []
  for (const ref of refs ?? []) {
    try {
      methods.push(typeof ref === 'string' ? doc.dereferenceVerificationMethod(ref) : ref)
    } catch {
      // ignore broken refs
    }
  }
  return methods
}

/**
 * Ed25519 `did:key` values derived from a long-form `did:peer:4` document (authentication + assertion).
 * Lets a mediator match forward `next` (often did:peer:4) to CM2 keylist entries registered as did:key.
 */
export function getEd25519DidKeysFromLongFormDidPeer4(did: string): string[] {
  if (!isLongFormDidPeer4(did)) {
    return []
  }
  try {
    const doc = didToNumAlgo4DidDocument(did)
    const vms = [
      ...collectVerificationMethodsFromPurpose(doc, doc.authentication),
      ...collectVerificationMethodsFromPurpose(doc, doc.assertionMethod),
    ]
    const didKeys = new Set<string>()
    for (const vm of vms) {
      try {
        const jwk = getPublicJwkFromVerificationMethod(vm)
        if (jwk.is(Ed25519PublicJwk)) {
          didKeys.add(new DidKey(jwk).did)
        }
      } catch {}
    }
    return [...didKeys]
  } catch {
    return []
  }
}

export function didToNumAlgo4DidDocument(did: string) {
  const parsed = parseDid(did)

  const match = parsed.did.match(LONG_RE)
  if (!match) {
    throw new CredoError(`Invalid long form algo 4 did:peer: ${parsed.did}`)
  }
  const [, hash, encodedDocument] = match
  if (hash !== hashEncodedDocument(encodedDocument)) {
    throw new CredoError(`Hash is invalid for did: ${did}`)
  }

  const { data } = MultiBaseEncoder.decode(encodedDocument)
  const [multiCodecValue] = VarintEncoder.decode(data.subarray(0, 2))
  if (multiCodecValue !== JSON_MULTICODEC_VARINT) {
    throw new CredoError('Not a JSON multicodec data')
  }
  const didDocumentJson = JsonEncoder.fromBuffer(data.subarray(2))

  didDocumentJson.id = parsed.did
  didDocumentJson.alsoKnownAs = [parsed.did.slice(0, did.lastIndexOf(':'))]

  // Populate all verification methods without controller
  const addControllerIfNotPresent = (item: unknown) => {
    if (Array.isArray(item)) item.forEach(addControllerIfNotPresent)

    if (item && typeof item === 'object' && (item as Record<string, unknown>).controller === undefined) {
      ;(item as Record<string, unknown>).controller = parsed.did
    }
  }

  addControllerIfNotPresent(didDocumentJson.verificationMethod)
  addControllerIfNotPresent(didDocumentJson.authentication)
  addControllerIfNotPresent(didDocumentJson.assertionMethod)
  addControllerIfNotPresent(didDocumentJson.keyAgreement)
  addControllerIfNotPresent(didDocumentJson.capabilityDelegation)
  addControllerIfNotPresent(didDocumentJson.capabilityInvocation)

  const didDocument = JsonTransformer.fromJSON(didDocumentJson, DidDocument)
  return didDocument
}

export function didDocumentToNumAlgo4Did(didDocument: DidDocument) {
  const didDocumentJson = didDocument.toJSON()

  // Build input document based on did document, without any
  // reference to controller
  const deleteControllerIfPresent = (item: unknown) => {
    if (Array.isArray(item)) {
      for (const method of item) {
        if (method.controller === '#id' || method.controller === didDocument.id) method.controller = undefined
      }
    }
  }
  didDocumentJson.id = undefined
  didDocumentJson.alsoKnownAs = undefined
  deleteControllerIfPresent(didDocumentJson.verificationMethod)
  deleteControllerIfPresent(didDocumentJson.authentication)
  deleteControllerIfPresent(didDocumentJson.assertionMethod)
  deleteControllerIfPresent(didDocumentJson.keyAgreement)
  deleteControllerIfPresent(didDocumentJson.capabilityDelegation)
  deleteControllerIfPresent(didDocumentJson.capabilityInvocation)

  // Construct encoded document by prefixing did document with multicodec prefix for JSON
  const buffer = Buffer.concat([
    VarintEncoder.encode(JSON_MULTICODEC_VARINT),
    TypedArrayEncoder.fromString(JSON.stringify(didDocumentJson)),
  ])

  const encodedDocument = MultiBaseEncoder.encode(buffer, 'base58btc')

  const shortFormDid = `did:peer:4${hashEncodedDocument(encodedDocument)}`
  const longFormDid = `${shortFormDid}:${encodedDocument}`

  return { shortFormDid, longFormDid }
}
