import type { DidDocument } from '../../dids'
import type { DidDoc, PublicKey } from '../models'

import { Key, KeyType } from '../../../crypto'
import { AriesFrameworkError } from '../../../error'
import { IndyAgentService, DidCommV1Service, DidDocumentBuilder } from '../../dids'
import { getEd25519VerificationMethod } from '../../dids/domain/key-type/ed25519'
import { didDocumentJsonToNumAlgo1Did } from '../../dids/methods/peer/peerDidNumAlgo1'
import { EmbeddedAuthentication } from '../models'

export function convertToNewDidDocument(didDoc: DidDoc): DidDocument {
  const didDocumentBuilder = new DidDocumentBuilder('')

  const oldIdNewIdMapping: { [key: string]: string } = {}

  didDoc.authentication.forEach((auth) => {
    const { publicKey: pk } = auth

    // did:peer did documents can only use referenced keys.
    if (pk.type === 'Ed25519VerificationKey2018' && pk.value) {
      const ed25519VerificationMethod = convertPublicKeyToVerificationMethod(pk)

      const oldKeyId = normalizeId(pk.id)
      oldIdNewIdMapping[oldKeyId] = ed25519VerificationMethod.id
      didDocumentBuilder.addAuthentication(ed25519VerificationMethod.id)

      // Only the auth is embedded, we also need to add the key to the verificationMethod
      // for referenced authentication this should already be the case
      if (auth instanceof EmbeddedAuthentication) {
        didDocumentBuilder.addVerificationMethod(ed25519VerificationMethod)
      }
    }
  })

  didDoc.publicKey.forEach((pk) => {
    if (pk.type === 'Ed25519VerificationKey2018' && pk.value) {
      const ed25519VerificationMethod = convertPublicKeyToVerificationMethod(pk)

      const oldKeyId = normalizeId(pk.id)
      oldIdNewIdMapping[oldKeyId] = ed25519VerificationMethod.id
      didDocumentBuilder.addVerificationMethod(ed25519VerificationMethod)
    }
  })

  didDoc.didCommServices.forEach((service) => {
    const serviceId = normalizeId(service.id)

    // For didcommv1, we need to replace the old id with the new ones
    if (service instanceof DidCommV1Service) {
      const recipientKeys = service.recipientKeys.map((keyId) => {
        const oldKeyId = normalizeId(keyId)
        return oldIdNewIdMapping[oldKeyId]
      })

      service = new DidCommV1Service({
        id: serviceId,
        recipientKeys,
        serviceEndpoint: service.serviceEndpoint,
        routingKeys: service.routingKeys,
        accept: service.accept,
        priority: service.priority,
      })
    } else if (service instanceof IndyAgentService) {
      service = new IndyAgentService({
        id: serviceId,
        recipientKeys: service.recipientKeys,
        serviceEndpoint: service.serviceEndpoint,
        routingKeys: service.routingKeys,
        priority: service.priority,
      })
    }

    didDocumentBuilder.addService(service)
  })

  const didDocument = didDocumentBuilder.build()

  const peerDid = didDocumentJsonToNumAlgo1Did(didDocument.toJSON())
  didDocument.id = peerDid

  return didDocument
}

function normalizeId(fullId: string): `#${string}` {
  // Some old dids use `;` as the delimiter for the id. If we can't find a `#`
  // and a `;` exists, we will parse everything after `;` as the id.
  if (!fullId.includes('#') && fullId.includes(';')) {
    const [, ...ids] = fullId.split(';')

    return `#${ids.join(';')}`
  }

  const [, ...ids] = fullId.split('#')
  return `#${ids.length ? ids.join('#') : fullId}`
}

function convertPublicKeyToVerificationMethod(publicKey: PublicKey) {
  if (!publicKey.value) {
    throw new AriesFrameworkError(`Public key ${publicKey.id} does not have value property`)
  }
  const publicKeyBase58 = publicKey.value
  const ed25519Key = Key.fromPublicKeyBase58(publicKeyBase58, KeyType.Ed25519)
  return getEd25519VerificationMethod({
    id: `#${publicKeyBase58.slice(0, 8)}`,
    key: ed25519Key,
    controller: '#id',
  })
}
