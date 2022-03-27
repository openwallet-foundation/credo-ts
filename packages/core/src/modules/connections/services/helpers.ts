import type { DidDocument } from '../../dids'
import type { DidDoc } from '../models'

import { KeyType } from '../../../crypto'
import { DidPeer, Key, DidDocumentBuilder } from '../../dids'
import { getEd25519VerificationMethod } from '../../dids/domain/key-type/ed25519'
import { PeerDidNumAlgo } from '../../dids/methods/peer/DidPeer'

export function convertToNewDidDocument(didDoc: DidDoc): DidDocument {
  const didDocumentBuilder = new DidDocumentBuilder('')

  didDoc.authentication.forEach((a) => {
    if (a.publicKey.value) {
      const publicKeyBase58 = a.publicKey.value
      const ed25519Key = Key.fromPublicKeyBase58(publicKeyBase58, KeyType.Ed25519)
      const ed25519VerificationMethod = getEd25519VerificationMethod({
        id: a.publicKey.id,
        key: ed25519Key,
        controller: a.publicKey.controller,
      })
      didDocumentBuilder.addAuthentication(ed25519VerificationMethod)
    }
  })

  didDoc.publicKey.forEach((pk) => {
    if (pk.value) {
      const publicKeyBase58 = pk.value
      const ed25519Key = Key.fromPublicKeyBase58(publicKeyBase58, KeyType.Ed25519)
      const ed25519VerificationMethod = getEd25519VerificationMethod({
        id: pk.id,
        key: ed25519Key,
        controller: pk.controller,
      })
      didDocumentBuilder.addVerificationMethod(ed25519VerificationMethod)
    }
  })

  const services = didDoc.didCommServices
  // We need to all reciepient and routing keys from all services but we don't want to duplicated items
  const recipientKeys = new Set(services.map((s) => s.recipientKeys).reduce((acc, curr) => acc.concat(curr), []))
  const routingKeys = new Set(
    services
      .map((s) => s.routingKeys)
      .filter((r): r is string[] => r !== undefined)
      .reduce((acc, curr) => acc.concat(curr), [])
  )

  // for (const recipientKey of recipientKeys) {
  //   const publicKeyBase58 = recipientKey
  //   const ed25519Key = Key.fromPublicKeyBase58(publicKeyBase58, KeyType.Ed25519)
  //   const x25519Key = Key.fromPublicKey(convertPublicKeyToX25519(ed25519Key.publicKey), KeyType.X25519)

  //   const ed25519VerificationMethod = getEd25519VerificationMethod({
  //     id: uuid(),
  //     key: ed25519Key,
  //     controller: '#id',
  //   })
  //   const x25519VerificationMethod = getX25519VerificationMethod({
  //     id: uuid(),
  //     key: x25519Key,
  //     controller: '#id',
  //   })

  //   // We should not add duplicated keys for services
  //   didDocumentBuilder.addKeyAgreement(x25519VerificationMethod)
  // }

  // for (const routingKey of routingKeys) {
  //   const publicKeyBase58 = routingKey
  //   const ed25519Key = Key.fromPublicKeyBase58(publicKeyBase58, KeyType.Ed25519)
  //   const verificationMethod = getEd25519VerificationMethod({
  //     id: uuid(),
  //     key: ed25519Key,
  //     controller: '#id',
  //   })
  //   didDocumentBuilder.addVerificationMethod(verificationMethod)
  // }

  services.forEach((service) => {
    didDocumentBuilder.addService(service)
  })

  const didDocument = didDocumentBuilder.build()

  const peerDid = DidPeer.fromDidDocument(didDocument, PeerDidNumAlgo.GenesisDoc)
  return peerDid.didDocument
}
