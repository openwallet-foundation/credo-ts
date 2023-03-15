import type { AgentContext } from '@aries-framework/core'

import {
  getKeyFromVerificationMethod,
  AriesFrameworkError,
  convertPublicKeyToX25519,
  DidDocumentBuilder,
  DidsApi,
  TypedArrayEncoder,
} from '@aries-framework/core'

import { DID_INDY_REGEX } from '../utils/did'

export function parseIndyDid(did: string) {
  const match = did.match(DID_INDY_REGEX)
  if (match) {
    const [, namespace, namespaceIdentifier] = match
    return { namespace, namespaceIdentifier }
  } else {
    throw new AriesFrameworkError(`${did} is not a valid did:indy did`)
  }
}

// Create a base DIDDoc template according to https://hyperledger.github.io/indy-did-method/#base-diddoc-template
export function indyDidDocumentFromDid(did: string, publicKeyBase58: string) {
  const verificationMethodId = `${did}#verkey`

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
