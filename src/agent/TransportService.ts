import type { ConnectionRecord } from '../modules/connections/repository'

import { Lifecycle, scoped, inject } from 'tsyringe'

import { DID_COMM_TRANSPORT_QUEUE, InjectionSymbols } from '../constants'
import { Logger } from '../logger'
import { ConnectionRole, DidCommService } from '../modules/connections/models'

@scoped(Lifecycle.ContainerScoped)
export class TransportService {
  private transportSessionTable: TransportSessionTable = {}
  private logger: Logger

  public constructor(@inject(InjectionSymbols.Logger) logger: Logger) {
    this.logger = logger
  }

  public saveSession(connectionId: string, transport: TransportSession) {
    this.transportSessionTable[connectionId] = transport
  }

  public hasInboundEndpoint(connection: ConnectionRecord) {
    return connection.didDoc.didCommServices.find((s) => s.serviceEndpoint !== DID_COMM_TRANSPORT_QUEUE)
  }

  public findSession(connectionId: string) {
    return this.transportSessionTable[connectionId]
  }

  public findServices(connection: ConnectionRecord): DidCommService[] {
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
  [connectionRecordId: string]: TransportSession
}

export interface TransportSession {
  type: string
}
