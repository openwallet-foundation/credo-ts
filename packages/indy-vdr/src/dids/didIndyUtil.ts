import type { AgentContext } from '@aries-framework/core'

import {
  getKeyFromVerificationMethod,
  AriesFrameworkError,
  convertPublicKeyToX25519,
  DidDocument,
  DidDocumentBuilder,
  DidsApi,
  Hasher,
  JsonTransformer,
  Key,
  KeyType,
  TypedArrayEncoder,
} from '@aries-framework/core'

import { DID_INDY_REGEX } from '../utils/did'

// Create a base DIDDoc template according to https://hyperledger.github.io/indy-did-method/#base-diddoc-template
export function indyDidDocumentFromDid(did: string, verKeyBase58: string) {
  const verificationMethodId = `${did}#verkey`

  const publicKeyBase58 = verKeyBase58

  const builder = new DidDocumentBuilder(did)
    .addContext('https://w3id.org/security/suites/ed25519-2018/v1')
    .addVerificationMethod({
      controller: did,
      id: verificationMethodId,
      publicKeyBase58,
      type: 'Ed25519VerificationKey2018',
    })
    .addAuthentication(verificationMethodId)

  return builder
}

export function createKeyAgreementKey(verkey: string) {
  return TypedArrayEncoder.toBase58(convertPublicKeyToX25519(TypedArrayEncoder.fromBase58(verkey)))
}

export function parseIndyDid(did: string) {
  const match = did.match(DID_INDY_REGEX)
  if (match) {
    const [, namespace, namespaceIdentifier] = match
    return { namespace, namespaceIdentifier }
  } else {
    throw new AriesFrameworkError(`${did} is not a valid did:indy did`)
  }
}

const deepMerge = (a: Record<string, unknown>, b: Record<string, unknown>) => {
  const output: Record<string, unknown> = {}

  ;[...new Set([...Object.keys(a), ...Object.keys(b)])].forEach((key) => {
    // Only an object includes a given key: just output it
    if (a[key] && !b[key]) {
      output[key] = a[key]
    } else if (!a[key] && b[key]) {
      output[key] = b[key]
    } else {
      // Both objects do include the key
      // Some or both are arrays
      if (Array.isArray(a[key])) {
        if (Array.isArray(b[key])) {
          const element = new Set()
          ;(a[key] as Array<unknown>).forEach((item: unknown) => element.add(item))
          ;(b[key] as Array<unknown>).forEach((item: unknown) => element.add(item))
          output[key] = Array.from(element)
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const arr = a[key] as Array<any>
          output[key] = Array.from(new Set(...arr, b[key]))
        }
      } else if (Array.isArray(b[key])) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const arr = b[key] as Array<any>
        output[key] = Array.from(new Set(...arr, a[key]))
        // Both elements are objects: recursive merge
      } else if (typeof a[key] == 'object' && typeof b[key] == 'object') {
        output[key] = deepMerge(a, b)
      }
    }
  })
  return output
}

/**
 * Combine a JSON content with the contents of a DidDocument
 * @param didDoc object containing original DIDDocument
 * @param json object containing extra DIDDoc contents
 *
 * @returns a DidDocument object resulting from the combination of both
 */
export function combineDidDocumentWithJson(didDoc: DidDocument, json: Record<string, unknown>) {
  const didDocJson = didDoc.toJSON()
  const combinedJson = deepMerge(didDocJson, json)
  return JsonTransformer.fromJSON(combinedJson, DidDocument)
}

/**
 * Processes the difference between a base DidDocument and a complete DidDocument
 *
 * Note: it does deep comparison based only on "id" field to determine whether is
 * the same object or is a different one
 *
 * @param extra complete DidDocument
 * @param base base DidDocument
 * @returns diff object
 */
export function didDocDiff(extra: Record<string, unknown>, base: Record<string, unknown>) {
  const output: Record<string, unknown> = {}
  for (const key in extra) {
    if (!(key in base)) {
      output[key] = extra[key]
    } else {
      // They are arrays: compare elements
      if (Array.isArray(extra[key]) && Array.isArray(base[key])) {
        // Different types: return the extra
        output[key] = []
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const baseAsArray = base[key] as Array<any>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const extraAsArray = extra[key] as Array<any>
        for (const element of extraAsArray) {
          if (!baseAsArray.find((item) => item.id === element.id)) {
            ;(output[key] as Array<unknown>).push(element)
          }
        }
      } // They are both objects: do recursive diff
      else if (typeof extra[key] == 'object' && typeof base[key] == 'object') {
        output[key] = didDocDiff(extra[key] as Record<string, unknown>, base[key] as Record<string, unknown>)
      } else {
        output[key] = extra[key]
      }
    }
  }
  return output
}

/**
 * Check whether the did is a self certifying did. If the verkey is abbreviated this method
 * will always return true. Make sure that the verkey you pass in this method belongs to the
 * did passed in
 *
 * @return Boolean indicating whether the did is self certifying
 */
export function isSelfCertifiedIndyDid(did: string, verkey: string): boolean {
  const { namespace } = parseIndyDid(did)
  const { did: didFromVerkey } = indyDidFromNamespaceAndInitialKey(
    namespace,
    Key.fromPublicKeyBase58(verkey, KeyType.Ed25519)
  )

  if (didFromVerkey === did) {
    return true
  }

  return false
}

export function indyDidFromNamespaceAndInitialKey(namespace: string, initialKey: Key) {
  const buffer = Hasher.hash(initialKey.publicKey, 'sha2-256')

  const id = TypedArrayEncoder.toBase58(buffer.slice(0, 16))
  const verkey = initialKey.publicKeyBase58
  const did = `did:indy:${namespace}:${id}`

  return { did, id, verkey }
}

/**
 * Fetches the verification key for a given did:indy did and returns the key as a {@link Key} object.
 *
 * @throws {@link AriesFrameworkError} if the did could not be resolved or the key could not be extracted
 */
export async function verificationKeyForIndyDid(agentContext: AgentContext, did: string) {
  // FIXME: we should store the didDocument in the DidRecord so we don't have to fetch our own did
  // from the ledger to know which key is associated with the did
  const didsApi = agentContext.dependencyManager.resolve(DidsApi)
  const didResult = await didsApi.resolve(did)

  if (!didResult.didDocument) {
    throw new AriesFrameworkError(
      `Could not resolve did ${did}. ${didResult.didResolutionMetadata.error} ${didResult.didResolutionMetadata.message}`
    )
  }

  // did:indy dids MUST have a verificationMethod with #verkey
  const verificationMethod = didResult.didDocument.dereferenceKey(`${did}#verkey`)
  const key = getKeyFromVerificationMethod(verificationMethod)

  return key
}
