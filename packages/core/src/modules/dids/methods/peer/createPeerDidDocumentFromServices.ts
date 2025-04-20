import type { ResolvedDidCommService } from '../../../../types'

import { convertPublicKeyToX25519 } from '@stablelib/ed25519'

import { PublicJwk, X25519PublicJwk } from '../../../kms'
import { getEd25519VerificationKey2018, getX25519KeyAgreementKey2019 } from '../../domain'
import { DidDocumentBuilder } from '../../domain/DidDocumentBuilder'
import { DidCommV1Service } from '../../domain/service/DidCommV1Service'
import { DidKey } from '../key'

export function createPeerDidDocumentFromServices(services: ResolvedDidCommService[]) {
  const didDocumentBuilder = new DidDocumentBuilder('')

  // Keep track of all added key id based on the fingerprint so we can add them to the recipientKeys as references
  const recipientKeyIdMapping: { [fingerprint: string]: string } = {}

  let keyIndex = 1
  services.forEach((service, index) => {
    // Get the local key reference for each of the recipient keys
    const recipientKeys = service.recipientKeys.map((recipientKey) => {
      // Key already added to the did document
      if (recipientKeyIdMapping[recipientKey.fingerprint]) return recipientKeyIdMapping[recipientKey.fingerprint]

      const x25519Key = PublicJwk.fromPublicKey<X25519PublicJwk>({
        crv: 'X25519',
        kty: 'OKP',
        publicKey: convertPublicKeyToX25519(recipientKey.publicKey.publicKey),
      })

      // key ids follow the #key-N pattern to comply with did:peer:2 spec
      const ed25519VerificationMethod = getEd25519VerificationKey2018({
        id: `#key-${keyIndex++}`,
        publicJwk: recipientKey,
        controller: '#id',
      })
      const x25519VerificationMethod = getX25519KeyAgreementKey2019({
        id: `#key-${keyIndex++}`,
        publicJwk: x25519Key,
        controller: '#id',
      })

      recipientKeyIdMapping[recipientKey.fingerprint] = ed25519VerificationMethod.id

      // We should not add duplicated keys for services
      didDocumentBuilder.addAuthentication(ed25519VerificationMethod).addKeyAgreement(x25519VerificationMethod)

      return recipientKeyIdMapping[recipientKey.fingerprint]
    })

    // Transform all routing keys into did:key:xxx#key-id references. This will probably change for didcomm v2
    const routingKeys = service.routingKeys?.map((key) => {
      const didKey = new DidKey(key)

      return `${didKey.did}#${key.fingerprint}`
    })

    didDocumentBuilder.addService(
      new DidCommV1Service({
        id: service.id,
        priority: index,
        serviceEndpoint: service.serviceEndpoint,
        recipientKeys,
        routingKeys,
      })
    )
  })

  return didDocumentBuilder.build()
}
