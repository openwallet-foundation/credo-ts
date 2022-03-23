import type { DidDoc } from '../modules/connections/models'
import type { ConnectionRecord } from '../modules/connections/repository'
import type { OutOfBandRecord } from '../modules/oob/repository'
import type { EncryptedMessage } from '../types'
import type { AgentMessage } from './AgentMessage'
import type { EnvelopeKeys } from './EnvelopeService'

import { Lifecycle, scoped } from 'tsyringe'

import { DID_COMM_TRANSPORT_QUEUE } from '../constants'

@scoped(Lifecycle.ContainerScoped)
export class TransportService {
  public transportSessionTable: TransportSessionTable = {}

  public saveSession(session: TransportSession) {
    this.transportSessionTable[session.id] = session
  }

  public findSessionByConnectionId(connectionId: string) {
    return Object.values(this.transportSessionTable).find((session) => session?.connection?.id === connectionId)
  }

  public findSessionByOutOfBandId(outOfBandId: string) {
    return Object.values(this.transportSessionTable).find((session) => session.outOfBand?.id === outOfBandId)
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
  outOfBand?: OutOfBandRecord
  send(encryptedMessage: EncryptedMessage): Promise<void>
  close(): Promise<void>
}
