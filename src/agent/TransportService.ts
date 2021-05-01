import { Logger } from '../logger'
import { ConnectionRecord, ConnectionRole } from '../modules/connections'

const DID_COMM_TRANSPORT_QUEUE = 'didcomm:transport/queue'

export class TransportService {
  private transportTable: TransportTable = {}
  private logger: Logger

  public constructor(logger: Logger) {
    this.logger = logger
  }

  public saveTransport(connectionId: string, transport: Transport) {
    this.transportTable[connectionId] = transport
  }

  public resolveTransport(connection: ConnectionRecord): Transport {
    const transport = this.getTransport(connection.id)
    if (transport) {
      return transport
    }

    const endpoint = this.findEndpoint(connection)
    if (endpoint) {
      if (endpoint?.startsWith('ws')) {
        return new WebSocketTransport(endpoint)
      } else if (endpoint === DID_COMM_TRANSPORT_QUEUE) {
        return new DidCommQueueTransport()
      }
      return new HttpTransport(endpoint)
    }

    throw new Error(`No transport found for connection with id ${connection.id}`)
  }

  public getTransport(connectionId: string) {
    return this.transportTable[connectionId]
  }

  private findEndpoint(connection: ConnectionRecord) {
    if (connection.theirDidDoc) {
      const endpoint = connection.theirDidDoc.service[0].serviceEndpoint
      if (endpoint) {
        this.logger.debug('Taking service endpoint from their DidDoc')
        return endpoint
      }
    }

    if (connection.role === ConnectionRole.Invitee && connection.invitation) {
      const endpoint = connection.invitation.serviceEndpoint
      if (endpoint) {
        this.logger.debug('Taking service endpoint from invitation')
        return endpoint
      }
    }
  }
}

interface TransportTable {
  [connectionRecordId: string]: Transport
}

type TransportType = 'ws' | 'http' | 'queue'

export interface Transport {
  type: TransportType
  endpoint: string
}

export class WebSocketTransport implements Transport {
  public type: TransportType = 'ws'
  public endpoint: string
  public socket?: WebSocket

  public constructor(endpoint: string, socket?: WebSocket) {
    this.endpoint = endpoint
    this.socket = socket
  }
}

export class HttpTransport implements Transport {
  public type: TransportType = 'http'
  public endpoint: string

  public constructor(endpoint: string) {
    this.endpoint = endpoint
  }
}

export class DidCommQueueTransport implements Transport {
  public type: TransportType = 'queue'
  public endpoint = DID_COMM_TRANSPORT_QUEUE
}
