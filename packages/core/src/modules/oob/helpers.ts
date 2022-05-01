import type { OutOfBandMessageOptions } from './messages'

import { AriesFrameworkError } from '../../error'
import { ConnectionInvitationMessage, HandshakeProtocol } from '../connections'
import { DidCommService } from '../dids'
import { didKeyToVerkey, verkeyToDidKey } from '../dids/helpers'

import { OutOfBandMessage } from './messages'

export function convertToNewInvitation(oldInvitation: ConnectionInvitationMessage) {
  let service

  if (oldInvitation.did) {
    service = oldInvitation.did
  } else if (oldInvitation.serviceEndpoint && oldInvitation.recipientKeys && oldInvitation.recipientKeys.length > 0) {
    service = new DidCommService({
      id: '#inline',
      recipientKeys: oldInvitation.recipientKeys?.map(verkeyToDidKey),
      routingKeys: oldInvitation.routingKeys?.map(verkeyToDidKey),
      serviceEndpoint: oldInvitation.serviceEndpoint,
    })
  } else {
    throw new Error('Missing required serviceEndpoint, routingKeys and/or did fields in connection invitation')
  }

  const options: OutOfBandMessageOptions = {
    id: oldInvitation.id,
    label: oldInvitation.label,
    imageUrl: oldInvitation.imageUrl,
    accept: ['didcomm/aip1', 'didcomm/aip2;env=rfc19'],
    services: [service],
    handshakeProtocols: [HandshakeProtocol.Connections],
  }

  return new OutOfBandMessage(options)
}

export function convertToOldInvitation(newInvitation: OutOfBandMessage) {
  if (newInvitation.services.length > 1) {
    throw new AriesFrameworkError(
      `Attribute 'services' MUST have exactly one entry. It contains ${newInvitation.services.length} entries.`
    )
  }

  const [service] = newInvitation.services

  let options
  if (typeof service === 'string') {
    options = {
      id: newInvitation.id,
      label: newInvitation.label,
      did: service,
      imageUrl: newInvitation.imageUrl,
    }
  } else {
    options = {
      id: newInvitation.id,
      label: newInvitation.label,
      recipientKeys: service.recipientKeys.map(didKeyToVerkey),
      routingKeys: service.routingKeys?.map(didKeyToVerkey),
      serviceEndpoint: service.serviceEndpoint,
      imageUrl: newInvitation.imageUrl,
    }
  }

  const connectionInvitationMessage = new ConnectionInvitationMessage(options)
  return connectionInvitationMessage
}
