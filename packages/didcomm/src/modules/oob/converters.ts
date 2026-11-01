import { DidCommV1Service, DidDocumentBuilder, DidKey, didDocumentToNumAlgo4Did } from '@credo-ts/core'
import { OutOfBandDidCommService } from './domain/OutOfBandDidCommService'

export function outOfBandServiceToNumAlgo4Did(service: OutOfBandDidCommService) {
  // FIXME: add the key entries for the recipientKeys to the did document.
  const didDocument = new DidDocumentBuilder('')
    .addService(
      new DidCommV1Service({
        id: service.id,
        serviceEndpoint: service.serviceEndpoint,
        accept: service.accept,
        // FIXME: this should actually be local key references, not did:key:123#456 references
        recipientKeys: service.recipientKeys.map((recipientKey) => {
          const did = DidKey.fromDid(recipientKey)
          return `${did.did}#${did.publicJwk.fingerprint}`
        }),
        // Map did:key:xxx to actual did:key:xxx#123
        routingKeys: service.routingKeys?.map((routingKey) => {
          const did = DidKey.fromDid(routingKey)
          return `${did.did}#${did.publicJwk.fingerprint}`
        }),
      })
    )
    .build()

  return didDocumentToNumAlgo4Did(didDocument)
}
