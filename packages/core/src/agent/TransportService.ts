import type { DidDoc } from '../modules/connections/models'
import type { ConnectionRecord } from '../modules/connections/repository'
import type { IndyAgentService } from '../modules/dids/domain/service'
import type { DIDCommMessage, EncryptedMessage } from './didcomm'
import type { PackMessageParams } from './didcomm/EnvelopeService'

import { Lifecycle, scoped } from 'tsyringe'

import { DID_COMM_TRANSPORT_QUEUE } from '../constants'
import { ConnectionRole } from '../modules/connections/models'
import { DidCommService } from '../modules/dids/domain/service'

@scoped(Lifecycle.ContainerScoped)
export class TransportService {
  private transportSessionTable: TransportSessionTable = {}

  public saveSession(session: TransportSession) {
    this.transportSessionTable[session.id] = session
  }

  public findSessionByConnectionId(connectionId: string) {
    return Object.values(this.transportSessionTable).find((session) => session.connection?.id === connectionId)
  }

  public hasInboundEndpoint(didDoc: DidDoc): boolean {
    return Boolean(didDoc.didCommServices.find((s) => s.serviceEndpoint !== DID_COMM_TRANSPORT_QUEUE))
  }

  public findSessionById(sessionId: string) {
    return this.transportSessionTable[sessionId]
  }

  public removeSession(session: TransportSession) {
    delete this.transportSessionTable[session.id]
  }

  public findDidCommServices(connection: ConnectionRecord): Array<DidCommService | IndyAgentService> {
    if (connection.theirDidDoc) {
      return connection.theirDidDoc.didCommServices
    }

    if (connection.role === ConnectionRole.Invitee && connection.invitation) {
      const { invitation } = connection
      if (invitation.serviceEndpoint) {
        const service = new DidCommService({
          id: `${connection.id}-invitation`,
          serviceEndpoint: invitation.serviceEndpoint,
          recipientKeys: invitation.recipientKeys || [],
          routingKeys: invitation.routingKeys || [],
        })
        return [service]
      }
    }
    return []
  }
}

interface TransportSessionTable {
  [sessionId: string]: TransportSession
}

export interface TransportSession {
  id: string
  type: string
  keys?: PackMessageParams
  inboundMessage?: DIDCommMessage
  connection?: ConnectionRecord
  send(encryptedMessage: EncryptedMessage): Promise<void>
}
