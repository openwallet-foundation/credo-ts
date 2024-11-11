import type { OutOfBandInvitationOptions } from './messages'

import {
  DidCommV1Service,
  DidDocumentBuilder,
  DidKey,
  didKeyToVerkey,
  verkeyToDidKey,
  didDocumentToNumAlgo2Did,
  createPeerDidDocumentFromServices,
  didKeyToInstanceOfKey,
} from '@credo-ts/core'
import { ConnectionInvitationMessage } from '../connections'

import { OutOfBandDidCommService } from './domain/OutOfBandDidCommService'
import { InvitationType, OutOfBandInvitation } from './messages'

export function convertToNewInvitation(oldInvitation: ConnectionInvitationMessage) {
  let service

  if (oldInvitation.did) {
    service = oldInvitation.did
  } else if (oldInvitation.serviceEndpoint && oldInvitation.recipientKeys && oldInvitation.recipientKeys.length > 0) {
    service = new OutOfBandDidCommService({
      id: '#inline',
      recipientKeys: oldInvitation.recipientKeys?.map(verkeyToDidKey),
      routingKeys: oldInvitation.routingKeys?.map(verkeyToDidKey),
      serviceEndpoint: oldInvitation.serviceEndpoint,
    })
  } else {
    throw new Error('Missing required serviceEndpoint, routingKeys and/or did fields in connection invitation')
  }

  const options: OutOfBandInvitationOptions = {
    id: oldInvitation.id,
    label: oldInvitation.label,
    imageUrl: oldInvitation.imageUrl,
    appendedAttachments: oldInvitation.appendedAttachments,
    accept: ['didcomm/aip1', 'didcomm/aip2;env=rfc19'],
    services: [service],
    // NOTE: we hardcode it to 1.0, we won't see support for newer versions of the protocol
    // and we also can process 1.0 if we support newer versions
    handshakeProtocols: ['https://didcomm.org/connections/1.0'],
  }

  const outOfBandInvitation = new OutOfBandInvitation(options)
  outOfBandInvitation.invitationType = InvitationType.Connection
  return outOfBandInvitation
}

export function convertToOldInvitation(newInvitation: OutOfBandInvitation) {
  // Taking first service, as we can only include one service in a legacy invitation.
  const [service] = newInvitation.getServices()

  let options
  if (typeof service === 'string') {
    options = {
      id: newInvitation.id,
      // label is optional
      label: newInvitation.label ?? '',
      did: service,
      imageUrl: newInvitation.imageUrl,
      appendedAttachments: newInvitation.appendedAttachments,
    }
  } else {
    options = {
      id: newInvitation.id,
      // label is optional
      label: newInvitation.label ?? '',
      recipientKeys: service.recipientKeys.map(didKeyToVerkey),
      routingKeys: service.routingKeys?.map(didKeyToVerkey),
      serviceEndpoint: service.serviceEndpoint,
      imageUrl: newInvitation.imageUrl,
      appendedAttachments: newInvitation.appendedAttachments,
    }
  }

  const connectionInvitationMessage = new ConnectionInvitationMessage(options)
  return connectionInvitationMessage
}

// This method is kept to support searching for existing connections created by
// credo-ts <= 0.5.1
// TODO: Remove in 0.6.0 (when ConnectionRecord.invitationDid will be migrated)
export function outOfBandServiceToInlineKeysNumAlgo2Did(service: OutOfBandDidCommService) {
  const didDocument = new DidDocumentBuilder('')
    .addService(
      new DidCommV1Service({
        id: service.id,
        serviceEndpoint: service.serviceEndpoint,
        accept: service.accept,
        recipientKeys: service.recipientKeys.map((recipientKey) => {
          const did = DidKey.fromDid(recipientKey)
          return `${did.did}#${did.key.fingerprint}`
        }),
        // Map did:key:xxx to actual did:key:xxx#123
        routingKeys: service.routingKeys?.map((routingKey) => {
          const did = DidKey.fromDid(routingKey)
          return `${did.did}#${did.key.fingerprint}`
        }),
      })
    )
    .build()

  const did = didDocumentToNumAlgo2Did(didDocument)

  return did
}

export function outOfBandServiceToNumAlgo2Did(service: OutOfBandDidCommService) {
  const didDocument = createPeerDidDocumentFromServices([
    {
      id: service.id,
      recipientKeys: service.recipientKeys.map(didKeyToInstanceOfKey),
      serviceEndpoint: service.serviceEndpoint,
      routingKeys: service.routingKeys?.map(didKeyToInstanceOfKey) ?? [],
    },
  ])

  const did = didDocumentToNumAlgo2Did(didDocument)

  return did
}
