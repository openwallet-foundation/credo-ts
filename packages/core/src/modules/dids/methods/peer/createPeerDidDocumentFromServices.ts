import type { ResolvedDidCommService } from '../../../../types'

import { convertPublicKeyToX25519 } from '@stablelib/ed25519'

import { PublicJwk } from '../../../kms'
import type { DidDocumentKey } from '../../DidsApiOptions'
import { DidDocument, getEd25519VerificationKey2018, getX25519KeyAgreementKey2019 } from '../../domain'
import { DidDocumentBuilder } from '../../domain/DidDocumentBuilder'
import { DidCommV1Service } from '../../domain/service/DidCommV1Service'
import { DidKey } from '../key'

export function createPeerDidDocumentFromServices<WithKeys extends boolean>(
  services: ResolvedDidCommService[],
  withKeys: WithKeys
): { didDocument: DidDocument; keys: WithKeys extends true ? DidDocumentKey[] : undefined } {
  const didDocumentBuilder = new DidDocumentBuilder('')

  // Keep track of all added key id based on the fingerprint so we can add them to the recipientKeys as references
  const recipientKeyIdMapping: { [fingerprint: string]: string } = {}

  const keys: DidDocumentKey[] = []

  let keyIndex = 1
  services.forEach((service, index) => {
    // Get the local key reference for each of the recipient keys
    const recipientKeys = service.recipientKeys.map((recipientKey) => {
      // Key already added to the did document
      if (recipientKeyIdMapping[recipientKey.fingerprint]) return recipientKeyIdMapping[recipientKey.fingerprint]

      const x25519Key = PublicJwk.fromPublicKey({
        crv: 'X25519',
        kty: 'OKP',
        publicKey: convertPublicKeyToX25519(recipientKey.publicKey.publicKey),
      })

      // key ids follow the #key-N pattern to comply with did:peer:2 spec
      const ed25519RelativeVerificationMethodId = `#key-${keyIndex++}`
      const ed25519VerificationMethod = getEd25519VerificationKey2018({
        id: ed25519RelativeVerificationMethodId,
        publicJwk: recipientKey,
        controller: '#id',
      })
      const x25519RelativeVerificationMethodId = `#key-${keyIndex++}`
      const x25519VerificationMethod = getX25519KeyAgreementKey2019({
        id: x25519RelativeVerificationMethodId,
        publicJwk: x25519Key,
        controller: '#id',
      })

      recipientKeyIdMapping[recipientKey.fingerprint] = ed25519VerificationMethod.id

      // NOTE: both use the same key id as the x25519 key is derived from the ed25519 key
      // This is special for DIDComm v1 and any kms that wants to support DIDComm v1 will have
      // to support both Ed25519 and X25519 operations on a Ed25519 key
      if (withKeys) {
        keys.push({
          didDocumentRelativeKeyId: ed25519RelativeVerificationMethodId,
          kmsKeyId: recipientKey.keyId,
        })
        keys.push({
          didDocumentRelativeKeyId: x25519RelativeVerificationMethodId,
          kmsKeyId: recipientKey.keyId,
        })
      }

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

  return {
    didDocument: didDocumentBuilder.build(),
    keys: (withKeys ? keys : undefined) as WithKeys extends true ? DidDocumentKey[] : undefined,
  }
}
