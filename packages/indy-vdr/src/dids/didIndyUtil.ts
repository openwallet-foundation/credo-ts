import {
  AriesFrameworkError,
  convertPublicKeyToX25519,
  DidDocument,
  DidDocumentBuilder,
  Hasher,
  JsonTransformer,
  Key,
  KeyType,
  TypedArrayEncoder,
} from '@aries-framework/core'
import { mergeWith, compact, transform, isUndefined, isEqual, isObject, isArray } from 'lodash'

import { DID_INDY_REGEX } from '../utils/did'

// Create a base DIDDoc template according to https://hyperledger.github.io/indy-did-method/#base-diddoc-template
export function indyDidDocumentFromDid(did: string, verKeyBase58: string) {
  const verificationMethodId = `${did}#verkey`

  const publicKeyBase58 = verKeyBase58

  const builder = new DidDocumentBuilder(did)
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
    const [, namespace, id] = match
    return { namespace, id }
  } else {
    throw new AriesFrameworkError(`${did} is not a valid did:indy did`)
  }
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
  const combinedJson = mergeWith(didDocJson, json, (objValue: unknown, srcValue: unknown) => {
    if (Array.isArray(objValue) && Array.isArray(srcValue)) {
      return [...new Set([...objValue, ...srcValue])]
    }
  })

  return JsonTransformer.fromJSON(combinedJson, DidDocument)
}

export function deepObjectDiff(object: any, base: any) {
  function changes(object: any, base: any) {
    return transform(object, function (result: any, value: any, key: any) {
      if (isUndefined(base[key])) {
        result[key] = value
      } else {
        if (!isEqual(value, base[key])) {
          result[key] = isObject(value) || isArray(value) ? compact(changes(value, base[key])) : value
        }
      }
    })
  }
  return changes(object, base)
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
