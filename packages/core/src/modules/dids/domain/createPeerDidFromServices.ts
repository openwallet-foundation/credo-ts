import type { DidCommService } from '.'

import { convertPublicKeyToX25519 } from '@stablelib/ed25519'

import { KeyType } from '../../../crypto'
import { uuid } from '../../../utils/uuid'

import { getEd25519VerificationMethod } from './key-type/ed25519'
import { getX25519VerificationMethod } from './key-type/x25519'

import { DidDocumentBuilder, Key } from '.'

export function createDidDocumentFromServices(services: DidCommService[]) {
  const didDocumentBuilder = new DidDocumentBuilder('')

  // We need to all reciepient and routing keys from all services but we don't want to duplicated items
  const recipientKeys = new Set(services.map((s) => s.recipientKeys).reduce((acc, curr) => acc.concat(curr), []))
  const routingKeys = new Set(
    services
      .map((s) => s.routingKeys)
      .filter((r): r is string[] => r !== undefined)
      .reduce((acc, curr) => acc.concat(curr), [])
  )

  for (const recipientKey of recipientKeys) {
    const publicKeyBase58 = recipientKey
    const ed25519Key = Key.fromPublicKeyBase58(publicKeyBase58, KeyType.Ed25519)
    const x25519Key = Key.fromPublicKey(convertPublicKeyToX25519(ed25519Key.publicKey), KeyType.X25519)

    const ed25519VerificationMethod = getEd25519VerificationMethod({
      id: uuid(),
      key: ed25519Key,
      controller: '#id',
    })
    const x25519VerificationMethod = getX25519VerificationMethod({
      id: uuid(),
      key: x25519Key,
      controller: '#id',
    })

    // We should not add duplicated keys for services
    didDocumentBuilder.addAuthentication(ed25519VerificationMethod).addKeyAgreement(x25519VerificationMethod)
  }

  for (const routingKey of routingKeys) {
    const publicKeyBase58 = routingKey
    const ed25519Key = Key.fromPublicKeyBase58(publicKeyBase58, KeyType.Ed25519)
    const verificationMethod = getEd25519VerificationMethod({
      id: uuid(),
      key: ed25519Key,
      controller: '#id',
    })
    didDocumentBuilder.addVerificationMethod(verificationMethod)
  }

  services.forEach((service) => {
    didDocumentBuilder.addService(service)
  })

  return didDocumentBuilder.build()
}
