import type { Routing } from './ConnectionService'
import type { AgentContext } from '../../../agent'
import type { ResolvedDidCommService } from '../../didcomm'
import type { DidDocument, PeerDidNumAlgo } from '../../dids'
import type { DidDoc, PublicKey } from '../models'

import { Key, KeyType } from '../../../crypto'
import { AriesFrameworkError } from '../../../error'
import {
  IndyAgentService,
  DidCommV1Service,
  DidDocumentBuilder,
  getEd25519VerificationKey2018,
  DidRepository,
  DidsApi,
  createPeerDidDocumentFromServices,
} from '../../dids'
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

  // FIXME: we reverse the didCommServices here, as the previous implementation was wrong
  // and we need to keep the same order to not break the did creation process.
  // When we implement the migration to did:peer:2 and did:peer:3 according to the
  // RFCs we can change it.
  didDoc.didCommServices.reverse().forEach((service) => {
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
  return getEd25519VerificationKey2018({
    id: `#${publicKeyBase58.slice(0, 8)}`,
    key: ed25519Key,
    controller: '#id',
  })
}

export function routingToServices(routing: Routing): ResolvedDidCommService[] {
  return routing.endpoints.map((endpoint, index) => ({
    id: `#inline-${index}`,
    serviceEndpoint: endpoint,
    recipientKeys: [routing.recipientKey],
    routingKeys: routing.routingKeys,
  }))
}

export async function getDidDocumentForCreatedDid(agentContext: AgentContext, did: string) {
  const didRecord = await agentContext.dependencyManager.resolve(DidRepository).findCreatedDid(agentContext, did)

  if (!didRecord?.didDocument) {
    throw new AriesFrameworkError(`Could not get DidDocument for created did ${did}`)
  }
  return didRecord.didDocument
}

export async function createPeerDidFromServices(
  agentContext: AgentContext,
  services: ResolvedDidCommService[],
  numAlgo: PeerDidNumAlgo
) {
  const didsApi = agentContext.dependencyManager.resolve(DidsApi)

  // Create did document without the id property
  const didDocument = createPeerDidDocumentFromServices(services)
  // Register did:peer document. This will generate the id property and save it to a did record

  const result = await didsApi.create({
    method: 'peer',
    didDocument,
    options: {
      numAlgo,
    },
  })

  if (result.didState?.state !== 'finished') {
    throw new AriesFrameworkError(`Did document creation failed: ${JSON.stringify(result.didState)}`)
  }

  return result.didState.didDocument
}
