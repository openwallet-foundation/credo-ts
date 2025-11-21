import { injectable } from '@credo-ts/core'
import type { DidCommTransportSession, DidCommTransportSessionRepository, DidCommTransportSessionTable } from './DidCommTransportSessionRepository'

@injectable()
export class InMemoryDidCommTransportSessionRepository implements DidCommTransportSessionRepository {
  private transportSessionTable: DidCommTransportSessionTable

  public constructor() {
    this.transportSessionTable = {}
  }

  public addTransportSessionToSessionTable(session: DidCommTransportSession) {
    this.transportSessionTable[session.id] = session
  }

  public findTransportSessionById(sessionId: string) {
    return this.transportSessionTable[sessionId]
  }

  public findTransportSessionByConnectionId(connectionId: string) {
    return Object.values(this.transportSessionTable).find((session) => session?.connectionId === connectionId)
  }

  public findExistingSessionsForConnectionIdAndType(connectionId: string, type: string) {
    return Object.values(this.transportSessionTable).filter(
      (session) => session?.connectionId === connectionId && session.type === type
    )
  }

  public removeTransportSessionById(sessionId: string) {
    this.transportSessionTable = Object.fromEntries(
      Object.entries(this.transportSessionTable).filter(([key]) => key !== sessionId)
    )
  }
}
