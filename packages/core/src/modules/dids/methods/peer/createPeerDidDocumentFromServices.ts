import type { ResolvedDidCommService } from '../../../didcomm'

import { convertPublicKeyToX25519 } from '@stablelib/ed25519'

import { Key } from '../../../../crypto/Key'
import { KeyType } from '../../../../crypto/KeyType'
import { AriesFrameworkError } from '../../../../error'
import { getEd25519VerificationKey2018, getX25519KeyAgreementKey2019 } from '../../domain'
import { DidDocumentBuilder } from '../../domain/DidDocumentBuilder'
import { DidCommV1Service } from '../../domain/service/DidCommV1Service'
import { DidKey } from '../key'

export function createPeerDidDocumentFromServices(services: ResolvedDidCommService[]) {
  const didDocumentBuilder = new DidDocumentBuilder('')

  // Keep track off all added key id based on the fingerprint so we can add them to the recipientKeys as references
  const recipientKeyIdMapping: { [fingerprint: string]: string } = {}

  services.forEach((service, index) => {
    // Get the local key reference for each of the recipient keys
    const recipientKeys = service.recipientKeys.map((recipientKey) => {
      // Key already added to the did document
      if (recipientKeyIdMapping[recipientKey.fingerprint]) return recipientKeyIdMapping[recipientKey.fingerprint]

      if (recipientKey.keyType !== KeyType.Ed25519) {
        throw new AriesFrameworkError(
          `Unable to create did document from services. recipient key type ${recipientKey.keyType} is not supported. Supported key types are ${KeyType.Ed25519}`
        )
      }
      const x25519Key = Key.fromPublicKey(convertPublicKeyToX25519(recipientKey.publicKey), KeyType.X25519)

      // Remove prefix from id as it is not included in did peer identifiers
      const ed25519VerificationMethod = getEd25519VerificationKey2018({
        id: `#${recipientKey.fingerprint.substring(1)}`,
        key: recipientKey,
        controller: '#id',
      })
      const x25519VerificationMethod = getX25519KeyAgreementKey2019({
        id: `#${x25519Key.fingerprint.substring(1)}`,
        key: x25519Key,
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
