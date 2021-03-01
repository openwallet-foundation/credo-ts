import { Socket } from 'socket.io';

export class TransportService {
  private transportTable: TransportTable = {};

  public saveTransport(connectionId: string, transport: Transport) {
    this.transportTable[connectionId] = transport;
  }

  public getTransport(connectionId: string) {
    return this.transportTable[connectionId];
  }
}

interface TransportTable {
  [connectionRecordId: string]: Transport;
}

export interface Transport {
  type: 'ws' | 'http';
  socket?: Socket;
}
