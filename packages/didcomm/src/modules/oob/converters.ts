import type { DidCommOutOfBandInvitationOptions } from './messages'

import {
  DidCommV1Service,
  DidDocumentBuilder,
  DidKey,
  didDocumentToNumAlgo4Did,
  didKeyToVerkey,
  verkeyToDidKey,
} from '@credo-ts/core'

import {
  DidCommConnectionInvitationMessage,
  DidCommConnectionInvitationMessageOptions,
} from '../connections/messages/DidCommConnectionInvitationMessage'

import { OutOfBandDidCommService } from './domain/OutOfBandDidCommService'
import { InvitationType, DidCommOutOfBandInvitation } from './messages/DidCommOutOfBandInvitation'

export function convertToNewInvitation(oldInvitation: DidCommConnectionInvitationMessage) {
  let service: string | OutOfBandDidCommService

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

  const options: DidCommOutOfBandInvitationOptions = {
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

  const outOfBandInvitation = new DidCommOutOfBandInvitation(options)
  outOfBandInvitation.invitationType = InvitationType.Connection
  return outOfBandInvitation
}

export function convertToOldInvitation(newInvitation: DidCommOutOfBandInvitation) {
  // Taking first service, as we can only include one service in a legacy invitation.
  const [service] = newInvitation.getServices()

  let options: DidCommConnectionInvitationMessageOptions
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

  const connectionInvitationMessage = new DidCommConnectionInvitationMessage(options)
  return connectionInvitationMessage
}

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
