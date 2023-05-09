import {
  TypedArrayEncoder,
  DidDocumentService,
  DidDocumentBuilder,
  DidCommV1Service,
  DidCommV2Service,
  convertPublicKeyToX25519,
  AriesFrameworkError,
} from '@aries-framework/core'

export type CommEndpointType = 'endpoint' | 'did-communication' | 'DIDComm'

export interface IndyEndpointAttrib {
  endpoint?: string
  types?: Array<CommEndpointType>
  routingKeys?: string[]
  [key: string]: unknown
}

export interface GetNymResponseData {
  did: string
  verkey: string
  role: string
  alias?: string
  diddocContent?: Record<string, unknown>
}

export const FULL_VERKEY_REGEX = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/

/**
 * Check a base58 encoded string against a regex expression to determine if it is a full valid verkey
 * @param verkey Base58 encoded string representation of a verkey
 * @return Boolean indicating if the string is a valid verkey
 */
export function isFullVerkey(verkey: string): boolean {
  return FULL_VERKEY_REGEX.test(verkey)
}

export function getFullVerkey(did: string, verkey: string) {
  if (isFullVerkey(verkey)) return verkey

  // Did could have did:xxx prefix, only take the last item after :
  const id = did.split(':').pop() ?? did
  // Verkey is prefixed with ~ if abbreviated
  const verkeyWithoutTilde = verkey.slice(1)

  // Create base58 encoded public key (32 bytes)
  return TypedArrayEncoder.toBase58(
    Buffer.concat([
      // Take did identifier (16 bytes)
      TypedArrayEncoder.fromBase58(id),
      // Concat the abbreviated verkey (16 bytes)
      TypedArrayEncoder.fromBase58(verkeyWithoutTilde),
    ])
  )
}

export function sovDidDocumentFromDid(fullDid: string, verkey: string) {
  const verificationMethodId = `${fullDid}#key-1`
  const keyAgreementId = `${fullDid}#key-agreement-1`

  const publicKeyBase58 = getFullVerkey(fullDid, verkey)
  const publicKeyX25519 = TypedArrayEncoder.toBase58(
    convertPublicKeyToX25519(TypedArrayEncoder.fromBase58(publicKeyBase58))
  )

  const builder = new DidDocumentBuilder(fullDid)
    .addContext('https://w3id.org/security/suites/ed25519-2018/v1')
    .addContext('https://w3id.org/security/suites/x25519-2019/v1')
    .addVerificationMethod({
      controller: fullDid,
      id: verificationMethodId,
      publicKeyBase58: publicKeyBase58,
      type: 'Ed25519VerificationKey2018',
    })
    .addVerificationMethod({
      controller: fullDid,
      id: keyAgreementId,
      publicKeyBase58: publicKeyX25519,
      type: 'X25519KeyAgreementKey2019',
    })
    .addAuthentication(verificationMethodId)
    .addAssertionMethod(verificationMethodId)
    .addKeyAgreement(keyAgreementId)

  return builder
}

// Process Indy Attrib Endpoint Types according to: https://sovrin-foundation.github.io/sovrin/spec/did-method-spec-template.html > Read (Resolve) > DID Service Endpoint
function processEndpointTypes(types?: string[]) {
  const expectedTypes = ['endpoint', 'did-communication', 'DIDComm']
  const defaultTypes = ['endpoint', 'did-communication']

  // Return default types if types "is NOT present [or] empty"
  if (!types || types.length <= 0) {
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

export function endpointsAttribFromServices(services: DidDocumentService[]): IndyEndpointAttrib {
  const commTypes: CommEndpointType[] = ['endpoint', 'did-communication', 'DIDComm']
  const commServices = services.filter((item) => commTypes.includes(item.type as CommEndpointType))

  // Check that all services use the same endpoint, as only one is accepted
  if (!commServices.every((item) => item.serviceEndpoint === services[0].serviceEndpoint)) {
    throw new AriesFrameworkError('serviceEndpoint for all services must match')
  }

  const types: CommEndpointType[] = []
  const routingKeys = new Set<string>()

  for (const commService of commServices) {
    const commServiceType = commService.type as CommEndpointType
    if (types.includes(commServiceType)) {
      throw new AriesFrameworkError('Only a single communication service per type is supported')
    }

    types.push(commServiceType)

    if (
      (commService instanceof DidCommV1Service || commService instanceof DidCommV2Service) &&
      commService.routingKeys
    ) {
      commService.routingKeys.forEach((item) => routingKeys.add(item))
    }
  }

  return { endpoint: services[0].serviceEndpoint, types, routingKeys: Array.from(routingKeys) }
}

export function addServicesFromEndpointsAttrib(
  builder: DidDocumentBuilder,
  did: string,
  endpoints: IndyEndpointAttrib,
  keyAgreementId: string
) {
  const { endpoint, routingKeys, types, ...otherEndpoints } = endpoints

  if (endpoint) {
    const processedTypes = processEndpointTypes(types)

    // If 'endpoint' included in types, add id to the services array
    if (processedTypes.includes('endpoint')) {
      builder.addService(
        new DidDocumentService({
          id: `${did}#endpoint`,
          serviceEndpoint: endpoint,
          type: 'endpoint',
        })
      )
    }

    // If 'did-communication' included in types, add DIDComm v1 entry
    if (processedTypes.includes('did-communication')) {
      builder.addService(
        new DidCommV1Service({
          id: `${did}#did-communication`,
          serviceEndpoint: endpoint,
          priority: 0,
          routingKeys: routingKeys ?? [],
          recipientKeys: [keyAgreementId],
          accept: ['didcomm/aip2;env=rfc19'],
        })
      )

      // If 'DIDComm' included in types, add DIDComm v2 entry
      // TODO: should it be DIDComm or DIDCommMessaging? (see https://github.com/sovrin-foundation/sovrin/issues/343)
      if (processedTypes.includes('DIDComm')) {
        builder
          .addService(
            new DidCommV2Service({
              id: `${did}#didcomm-1`,
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
        id: `${did}#${type}`,
        serviceEndpoint: endpoint as string,
        type,
      })
    )
  }
}
