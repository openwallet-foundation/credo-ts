import type { ConnectionInvitationMessage } from '../connections'

import { HandshakeProtocol } from '../connections'
import { DidCommService } from '../dids'

import { OutOfBandMessage } from './messages'

export function convertOldInvitation(oldInvitation: ConnectionInvitationMessage) {
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
  const outOfBandMessage = new OutOfBandMessage(options)
  return outOfBandMessage
}
