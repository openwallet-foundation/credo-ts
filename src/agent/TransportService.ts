import type { ConnectionRecord } from '../modules/connections/repository'

import { Lifecycle, scoped, inject } from 'tsyringe'

import { DID_COMM_TRANSPORT_QUEUE, InjectionSymbols } from '../constants'
import { AriesFrameworkError } from '../error'
import { Logger } from '../logger'
import { ConnectionRole } from '../modules/connections/models'

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

  public findEndpoint(connection: ConnectionRecord) {
    if (connection.theirDidDoc) {
      const endpoint = connection.theirDidDoc.didCommServices[0].serviceEndpoint
      if (endpoint) {
        this.logger.debug(`Taking service endpoint ${endpoint} from their DidDoc`)
        return endpoint
      }
    }

    if (connection.role === ConnectionRole.Invitee && connection.invitation) {
      const endpoint = connection.invitation.serviceEndpoint
      if (endpoint) {
        this.logger.debug(`Taking service endpoint ${endpoint} from invitation`)
        return endpoint
      }
    }
    throw new AriesFrameworkError(`No endpoint found for connection with id ${connection.id}`)
  }
}

interface TransportSessionTable {
  [connectionRecordId: string]: TransportSession
}

export interface TransportSession {
  type: string
}
