export class TransportService {
  private transportTable: TransportTable = {}

  public saveTransport(connectionId: string, transport: Transport) {
    this.transportTable[connectionId] = transport
  }

  public getTransport(connectionId: string) {
    return this.transportTable[connectionId]
  }
}

interface TransportTable {
  [connectionRecordId: string]: Transport
}

type TransportType = 'ws' | 'http'

export interface Transport {
  type: TransportType
}

export class WebSocketTransport implements Transport {
  public type: TransportType = 'ws'
  public endpoint?: string
  public socket?: WebSocket

  public constructor(endpoint: string, socket?: WebSocket) {
    this.endpoint = endpoint
    this.socket = socket
  }
}

export class HttpTransport {
  public type: TransportType = 'http'
  public endpoint?: string

  public constructor(endpoint?: string) {
    this.endpoint = endpoint
  }
}
