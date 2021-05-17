import { Lifecycle, scoped, inject } from 'tsyringe'

import { Logger } from '../logger'
import { ConnectionRecord } from '../modules/connections/repository'
import { ConnectionRole } from '../modules/connections/models'
import { Symbols } from '../symbols'
import { AriesFrameworkError } from '../error'

export const DID_COMM_TRANSPORT_QUEUE = 'didcomm:transport/queue'

@scoped(Lifecycle.ContainerScoped)
export class TransportService {
  private transportTable: TransportTable = {}
  private logger: Logger

  public constructor(@inject(Symbols.Logger) logger: Logger) {
    this.logger = logger
  }

  public saveTransport(connectionId: string, transport: Transport) {
    this.transportTable[connectionId] = transport
  }

  public hasInboundEndpoint(connection: ConnectionRecord) {
    return connection.didDoc.didCommServices.find((s) => s.serviceEndpoint !== DID_COMM_TRANSPORT_QUEUE)
  }

  public findTransport(connectionId: string) {
    return this.transportTable[connectionId]
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

interface TransportTable {
  [connectionRecordId: string]: Transport
}

type TransportType = 'websocket' | 'http' | 'queue'

export interface Transport {
  type: TransportType
  endpoint: string
}

export class WebSocketTransport implements Transport {
  public readonly type = 'websocket'
  public endpoint: string
  public socket?: WebSocket

  public constructor(endpoint: string, socket?: WebSocket) {
    this.endpoint = endpoint
    this.socket = socket
  }
}
