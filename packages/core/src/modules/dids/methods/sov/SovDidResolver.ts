import type { IndyEndpointAttrib, IndyLedgerService } from '../../../ledger'
import type { DidResolver } from '../../domain/DidResolver'
import type { ParsedDid, DidResolutionResult } from '../../types'

import { convertPublicKeyToX25519 } from '@stablelib/ed25519'

import { TypedArrayEncoder } from '../../../../utils/TypedArrayEncoder'
import { getFullVerkey } from '../../../../utils/did'
import { DidDocumentService } from '../../domain'
import { DidDocumentBuilder } from '../../domain/DidDocumentBuilder'
import { DidCommV1Service } from '../../domain/service/DidCommV1Service'
import { DidCommV2Service } from '../../domain/service/DidCommV2Service'

export class SovDidResolver implements DidResolver {
  private indyLedgerService: IndyLedgerService

  public constructor(indyLedgerService: IndyLedgerService) {
    this.indyLedgerService = indyLedgerService
  }

  public readonly supportedMethods = ['sov']

  public async resolve(did: string, parsed: ParsedDid): Promise<DidResolutionResult> {
    const didDocumentMetadata = {}

    try {
      const nym = await this.indyLedgerService.getPublicDid(parsed.id)
      const endpoints = await this.indyLedgerService.getEndpointsForDid(did)

      const verificationMethodId = `${parsed.did}#key-1`
      const keyAgreementId = `${parsed.did}#key-agreement-1`

      const publicKeyBase58 = getFullVerkey(nym.did, nym.verkey)
      const publicKeyX25519 = TypedArrayEncoder.toBase58(
        convertPublicKeyToX25519(TypedArrayEncoder.fromBase58(publicKeyBase58))
      )

      const builder = new DidDocumentBuilder(parsed.did)
        .addContext('https://w3id.org/security/suites/ed25519-2018/v1')
        .addContext('https://w3id.org/security/suites/x25519-2019/v1')
        .addVerificationMethod({
          controller: parsed.did,
          id: verificationMethodId,
          publicKeyBase58: getFullVerkey(nym.did, nym.verkey),
          type: 'Ed25519VerificationKey2018',
        })
        .addVerificationMethod({
          controller: parsed.did,
          id: keyAgreementId,
          publicKeyBase58: publicKeyX25519,
          type: 'X25519KeyAgreementKey2019',
        })
        .addAuthentication(verificationMethodId)
        .addAssertionMethod(verificationMethodId)
        .addKeyAgreement(keyAgreementId)

      this.addServices(builder, parsed, endpoints, keyAgreementId)

      return {
        didDocument: builder.build(),
        didDocumentMetadata,
        didResolutionMetadata: { contentType: 'application/did+ld+json' },
      }
    } catch (error) {
      return {
        didDocument: null,
        didDocumentMetadata,
        didResolutionMetadata: {
          error: 'notFound',
          message: `resolver_error: Unable to resolve did '${did}': ${error}`,
        },
      }
    }
  }

  // Process Indy Attrib Endpoint Types according to: https://sovrin-foundation.github.io/sovrin/spec/did-method-spec-template.html > Read (Resolve) > DID Service Endpoint
  private processEndpointTypes(types?: string[]) {
    const expectedTypes = ['endpoint', 'did-communication', 'DIDComm']
    const defaultTypes = ['endpoint', 'did-communication']

    // Return default types if types "is NOT present [or] empty"
    if (!types || types?.length <= 0) {
      return defaultTypes
    }

    // Return default types if types "contain any other values"
    for (const type of types) {
      if (!expectedTypes.includes(type)) {
        return defaultTypes
      }
    }

    // Return provided types
    return types
  }

  private addServices(
    builder: DidDocumentBuilder,
    parsed: ParsedDid,
    endpoints: IndyEndpointAttrib,
    keyAgreementId: string
  ) {
    const { endpoint, routingKeys, types, ...otherEndpoints } = endpoints

    if (endpoint) {
      const processedTypes = this.processEndpointTypes(types)

      // If 'endpoint' included in types, add id to the services array
      if (processedTypes.includes('endpoint')) {
        builder.addService(
          new DidDocumentService({
            id: `${parsed.did}#endpoint`,
            serviceEndpoint: endpoint,
            type: 'endpoint',
          })
        )
      }

      // If 'did-communication' included in types, add DIDComm v1 entry
      if (processedTypes.includes('did-communication')) {
        builder.addService(
          new DidCommV1Service({
            id: `${parsed.did}#did-communication`,
            serviceEndpoint: endpoint,
            priority: 0,
            routingKeys: routingKeys ?? [],
            recipientKeys: [keyAgreementId],
            accept: ['didcomm/aip2;env=rfc19'],
          })
        )

        // If 'DIDComm' included in types, add DIDComm v2 entry
        if (processedTypes.includes('DIDComm')) {
          builder
            .addService(
              new DidCommV2Service({
                id: `${parsed.did}#didcomm-1`,
                serviceEndpoint: endpoint,
                routingKeys: routingKeys ?? [],
                accept: ['didcomm/v2'],
              })
            )
            .addContext('https://didcomm.org/messaging/contexts/v2')
        }
      }
    }

    // Add other endpoint types
    for (const [type, endpoint] of Object.entries(otherEndpoints)) {
      builder.addService(
        new DidDocumentService({
          id: `${parsed.did}#${type}`,
          serviceEndpoint: endpoint as string,
          type,
        })
      )
    }
  }
}
