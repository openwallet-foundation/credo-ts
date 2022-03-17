import { AriesFrameworkError } from '../../error'
import { ConnectionInvitationMessage, HandshakeProtocol } from '../connections'
import { DidCommService } from '../dids'

import { OutOfBandMessage } from './messages'

export function convertToNewInvitation(oldInvitation: ConnectionInvitationMessage) {
  const options = {
    id: oldInvitation.id,
    label: oldInvitation.label,
    accept: ['didcomm/aip1', 'didcomm/aip2;env=rfc19'],
    services: [
      new DidCommService({
        id: '#inline',
        recipientKeys: oldInvitation.recipientKeys || [],
        routingKeys: oldInvitation.routingKeys || [],
        serviceEndpoint: oldInvitation.serviceEndpoint || '',
      }),
    ],
    handshakeProtocols: [HandshakeProtocol.Connections],
  }
  return new OutOfBandMessage(options)
}

export function convertToOldInvitation(newInvitation: OutOfBandMessage) {
  if (newInvitation.services.length > 1) {
    throw new AriesFrameworkError(
      `Attribute 'services' MUST have exactly one entry. It contains ${newInvitation.services.length}.`
    )
  }

  const [service] = newInvitation.services

  let options
  if (typeof service === 'string') {
    options = {
      id: newInvitation.id,
      label: newInvitation.label,
      did: service,
    }
  } else {
    options = {
      id: newInvitation.id,
      label: newInvitation.label,
      recipientKeys: service.recipientKeys || [],
      routingKeys: service.routingKeys || [],
      serviceEndpoint: service.serviceEndpoint || '',
    }
  }

  const connectionInvitationMessage = new ConnectionInvitationMessage(options)
  return connectionInvitationMessage
}
