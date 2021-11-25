import type { IndyLedgerService } from '../../ledger'
import type { DIDDocument, DIDResolutionResult, DIDResolver, ParsedDID } from 'did-resolver'

import { getFullVerkey } from '../../../utils/did'

/**
 * @see https://github.com/decentralized-identity/uni-resolver-driver-did-sov/blob/24bb07502f5667064436f8a7a623903b20fa5e2f/src/main/java/uniresolver/driver/did/sov/DidSovDriver.java
 * @see https://github.com/hyperledger/aries-cloudagent-python/blob/2960c51d175103e35be2865108e495ad7fb41265/aries_cloudagent/resolver/default/indy.py
 */
export function getResolver(indyLedgerService: IndyLedgerService): Record<string, DIDResolver> {
  async function resolve(did: string, parsed: ParsedDID): Promise<DIDResolutionResult> {
    let err = null

    const id = parsed.id

    const didDocumentMetadata = {}
    let didDocument: DIDDocument | null = null

    try {
      const nym = await indyLedgerService.getPublicDid(id)
      const endpoints = await indyLedgerService.getEndpointsForDid(did)

      const verificationMethodId = `${parsed.did}#key-1`

      didDocument = {
        '@context': 'https://www.w3.org/ns/did/v1',
        id: parsed.did,
        verificationMethod: [
          {
            controller: parsed.did,
            id: verificationMethodId,
            publicKeyBase58: getFullVerkey(nym.did, nym.verkey),
            type: 'Ed25519VerificationKey2018',
          },
        ],
        authentication: [verificationMethodId],
        assertionMethod: [verificationMethodId],
      }

      const services = []

      for (const [type, endpoint] of Object.entries(endpoints)) {
        services.push({
          id: `${parsed.did}#service-${type}`,
          serviceEndpoint: endpoint as string,
          type,
        })

        // 'endpoint' type is for didcomm
        if (type === 'endpoint') {
          services.push({
            type: 'did-communication',
            id: `${parsed.did}#did-communication`,
            serviceEndpoint: endpoint as string,
            priority: 0,
            routingKeys: [],
            recipientKeys: [verificationMethodId],
            // FIXME: it is not possible to determine this locally, but is what is used in the uniresolver
            accept: ['didcomm/aip2;env=rfc19'],
          })

          services.push({
            type: 'DIDComm',
            id: `${parsed.did}#did-communication`,
            serviceEndpoint: endpoint as string,
            routingKeys: [],
            // FIXME: it is not possible to determine this locally, but is what is used in the uniresolver
            accept: ['didcomm/v2', 'didcomm/aip2;env=rfc19'],
          })
        }
      }

      didDocument.service = services
    } catch (error) {
      err = `resolver_error: Unable to resolve did '${did}': ${error}`
    }

    const contentType =
      typeof didDocument?.['@context'] !== 'undefined' ? 'application/did+ld+json' : 'application/did+json'

    if (err) {
      return {
        didDocument,
        didDocumentMetadata,
        didResolutionMetadata: {
          error: 'notFound',
          message: err,
        },
      }
    }

    return {
      didDocument,
      didDocumentMetadata,
      didResolutionMetadata: { contentType },
    }
  }

  return { sov: resolve }
}
