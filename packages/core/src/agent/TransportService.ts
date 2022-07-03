import type { ConnectionRecord } from '../modules/connections/repository'
import type { DidDocument } from '../modules/dids'
import type { EncryptedMessage } from '../types'
import type { AgentMessage } from './AgentMessage'
import type { EnvelopeKeys } from './EnvelopeService'

import { DID_COMM_TRANSPORT_QUEUE } from '../constants'
import { injectable } from '../plugins'

@injectable()
export class TransportService {
  public transportSessionTable: TransportSessionTable = {}

  public saveSession(session: TransportSession) {
    this.transportSessionTable[session.id] = session
  }

  public findSessionByConnectionId(connectionId: string) {
    return Object.values(this.transportSessionTable).find((session) => session?.connection?.id === connectionId)
  }

  public hasInboundEndpoint(didDocument: DidDocument): boolean {
    return Boolean(didDocument.service?.find((s) => s.serviceEndpoint !== DID_COMM_TRANSPORT_QUEUE))
  }

  public findSessionById(sessionId: string) {
    return this.transportSessionTable[sessionId]
  }

  public removeSession(session: TransportSession) {
    delete this.transportSessionTable[session.id]
  }
}

interface TransportSessionTable {
  [sessionId: string]: TransportSession | undefined
}

export interface TransportSession {
  id: string
  type: string
  keys?: EnvelopeKeys
  inboundMessage?: AgentMessage
  connection?: ConnectionRecord
  send(encryptedMessage: EncryptedMessage): Promise<void>
  close(): Promise<void>
}
