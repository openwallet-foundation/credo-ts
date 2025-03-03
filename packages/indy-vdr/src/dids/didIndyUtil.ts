import type { AgentContext } from '@credo-ts/core'
import type { IndyVdrPool } from '../pool'
import type { GetNymResponseData, IndyEndpointAttrib } from './didSovUtil'

import { parseIndyDid } from '@credo-ts/anoncreds'
import {
  CredoError,
  DidDocument,
  DidDocumentBuilder,
  DidsApi,
  Hasher,
  JsonTransformer,
  Key,
  KeyType,
  TypedArrayEncoder,
  convertPublicKeyToX25519,
  getKeyFromVerificationMethod,
} from '@credo-ts/core'
import { GetAttribRequest, GetNymRequest } from '@hyperledger/indy-vdr-shared'

import { IndyVdrError, IndyVdrNotFoundError } from '../error'

import { addServicesFromEndpointsAttrib, getFullVerkey } from './didSovUtil'

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

const deepMerge = (a: Record<string, unknown>, b: Record<string, unknown>) => {
  const output: Record<string, unknown> = {}

  for (const key of [...new Set([...Object.keys(a), ...Object.keys(b)])]) {
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

          for (const item of a[key] as Array<unknown>) {
            element.add(item)
          }

          for (const item of b[key] as Array<unknown>) {
            element.add(item)
          }

          output[key] = Array.from(element)
        } else {
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          const arr = a[key] as Array<any>
          output[key] = Array.from(new Set(...arr, b[key]))
        }
      } else if (Array.isArray(b[key])) {
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        const arr = b[key] as Array<any>
        output[key] = Array.from(new Set(...arr, a[key]))
        // Both elements are objects: recursive merge
      } else if (typeof a[key] === 'object' && typeof b[key] === 'object') {
        output[key] = deepMerge(a, b)
      }
    }
  }
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
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        const baseAsArray = base[key] as Array<any>
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        const extraAsArray = extra[key] as Array<any>
        for (const element of extraAsArray) {
          if (!baseAsArray.find((item) => item.id === element.id)) {
            ;(output[key] as Array<unknown>).push(element)
          }
        }
      } // They are both objects: do recursive diff
      else if (typeof extra[key] === 'object' && typeof base[key] === 'object') {
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
  const buffer = Hasher.hash(initialKey.publicKey, 'sha-256')

  const id = TypedArrayEncoder.toBase58(buffer.slice(0, 16))
  const verkey = initialKey.publicKeyBase58
  const did = `did:indy:${namespace}:${id}`

  return { did, id, verkey }
}

/**
 * Fetches the verification key for a given did:indy did and returns the key as a {@link Key} object.
 *
 * @throws {@link CredoError} if the did could not be resolved or the key could not be extracted
 */
export async function verificationKeyForIndyDid(agentContext: AgentContext, did: string) {
  // FIXME: we should store the didDocument in the DidRecord so we don't have to fetch our own did
  // from the ledger to know which key is associated with the did
  const didsApi = agentContext.dependencyManager.resolve(DidsApi)
  const didResult = await didsApi.resolve(did)

  if (!didResult.didDocument) {
    throw new CredoError(
      `Could not resolve did ${did}. ${didResult.didResolutionMetadata.error} ${didResult.didResolutionMetadata.message}`
    )
  }

  // did:indy dids MUST have a verificationMethod with #verkey
  const verificationMethod = didResult.didDocument.dereferenceKey(`${did}#verkey`)
  const key = getKeyFromVerificationMethod(verificationMethod)

  return key
}

export async function getPublicDid(pool: IndyVdrPool, unqualifiedDid: string) {
  const request = new GetNymRequest({ dest: unqualifiedDid })

  const didResponse = await pool.submitRequest(request)

  if (!didResponse.result.data) {
    throw new IndyVdrNotFoundError(`DID ${unqualifiedDid} not found in indy namespace ${pool.indyNamespace}`)
  }
  return JSON.parse(didResponse.result.data) as GetNymResponseData
}

export async function getEndpointsForDid(agentContext: AgentContext, pool: IndyVdrPool, unqualifiedDid: string) {
  try {
    agentContext.config.logger.debug(`Get endpoints for did '${unqualifiedDid}' from ledger '${pool.indyNamespace}'`)

    const request = new GetAttribRequest({ targetDid: unqualifiedDid, raw: 'endpoint' })

    agentContext.config.logger.debug(
      `Submitting get endpoint ATTRIB request for did '${unqualifiedDid}' to ledger '${pool.indyNamespace}'`
    )
    const response = await pool.submitRequest(request)

    if (!response.result.data) {
      return null
    }

    const endpoints = JSON.parse(response.result.data as string)?.endpoint as IndyEndpointAttrib
    agentContext.config.logger.debug(
      `Got endpoints '${JSON.stringify(endpoints)}' for did '${unqualifiedDid}' from ledger '${pool.indyNamespace}'`,
      {
        response,
        endpoints,
      }
    )

    return endpoints
  } catch (error) {
    agentContext.config.logger.error(
      `Error retrieving endpoints for did '${unqualifiedDid}' from ledger '${pool.indyNamespace}'`,
      {
        error,
      }
    )

    throw new IndyVdrError(error)
  }
}

export async function buildDidDocument(agentContext: AgentContext, pool: IndyVdrPool, did: string) {
  const { namespaceIdentifier } = parseIndyDid(did)

  const nym = await getPublicDid(pool, namespaceIdentifier)

  // Create base Did Document

  // For modern did:indy DIDs, we assume that GET_NYM is always a full verkey in base58.
  // For backwards compatibility, we accept a shortened verkey and convert it using previous convention
  const verkey = getFullVerkey(namespaceIdentifier, nym.verkey)

  const builder = indyDidDocumentFromDid(did, verkey)

  // If GET_NYM does not return any diddocContent, fallback to legacy GET_ATTRIB endpoint
  if (!nym.diddocContent) {
    const keyAgreementId = `${did}#key-agreement-1`
    const endpoints = await getEndpointsForDid(agentContext, pool, namespaceIdentifier)

    if (endpoints) {
      builder
        .addContext('https://w3id.org/security/suites/x25519-2019/v1')
        .addVerificationMethod({
          controller: did,
          id: keyAgreementId,
          publicKeyBase58: createKeyAgreementKey(verkey),
          type: 'X25519KeyAgreementKey2019',
        })
        .addKeyAgreement(keyAgreementId)

      // Process endpoint attrib following the same rules as for did:sov
      addServicesFromEndpointsAttrib(builder, did, endpoints, keyAgreementId)
    }
    return builder.build()
  }
  // Combine it with didDoc
  // biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
  let diddocContent
  try {
    diddocContent = JSON.parse(nym.diddocContent) as Record<string, unknown>
  } catch (error) {
    agentContext.config.logger.error(`Nym diddocContent is not a valid json string: ${diddocContent}`)
    throw new IndyVdrError(`Nym diddocContent failed to parse as JSON: ${error}`)
  }
  return combineDidDocumentWithJson(builder.build(), diddocContent)
}
