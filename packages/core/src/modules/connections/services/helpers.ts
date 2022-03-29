import type { DidDocument } from '../../dids'
import type { DidDoc, PublicKey } from '../models'

import { KeyType } from '../../../crypto'
import { AriesFrameworkError } from '../../../error'
import { DidPeer, Key, DidDocumentBuilder } from '../../dids'
import { getEd25519VerificationMethod } from '../../dids/domain/key-type/ed25519'
import { PeerDidNumAlgo } from '../../dids/methods/peer/DidPeer'

export function convertToNewDidDocument(didDoc: DidDoc): DidDocument {
  const didDocumentBuilder = new DidDocumentBuilder('')

  didDoc.authentication.forEach((auth) => {
    const { publicKey: pk } = auth
    if (pk.type === 'Ed25519VerificationKey2018' && pk.value) {
      const ed25519VerificationMethod = convertPublicKeyToVerificationMethod(pk)
      didDocumentBuilder.addAuthentication(ed25519VerificationMethod)
    }
  })

  didDoc.publicKey.forEach((pk) => {
    if (pk.type === 'Ed25519VerificationKey2018' && pk.value) {
      const ed25519VerificationMethod = convertPublicKeyToVerificationMethod(pk)
      didDocumentBuilder.addVerificationMethod(ed25519VerificationMethod)
    }
  })

  didDoc.didCommServices.forEach((service) => {
    didDocumentBuilder.addService(service)
  })

  const didDocument = didDocumentBuilder.build()

  const peerDid = DidPeer.fromDidDocument(didDocument, PeerDidNumAlgo.GenesisDoc)
  return peerDid.didDocument
}

function convertPublicKeyToVerificationMethod(publicKey: PublicKey) {
  if (!publicKey.value) {
    throw new AriesFrameworkError(`Public key ${publicKey.id} does not have value property`)
  }
  const publicKeyBase58 = publicKey.value
  const ed25519Key = Key.fromPublicKeyBase58(publicKeyBase58, KeyType.Ed25519)
  return getEd25519VerificationMethod({
    id: publicKey.id,
    key: ed25519Key,
    controller: publicKey.controller,
  })
}
