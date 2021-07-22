import type { DidDoc } from '../modules/connections/models'
import type { ConnectionRecord } from '../modules/connections/repository'
import type { OutboundPackage } from '../types'
import type { AgentMessage } from './AgentMessage'
import type { EnvelopeKeys } from './EnvelopeService'

import { Lifecycle, scoped } from 'tsyringe'

import { DID_COMM_TRANSPORT_QUEUE } from '../constants'
import { ConnectionRole, DidCommService } from '../modules/connections/models'

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

  public findDidCommServices(connection: ConnectionRecord): DidCommService[] {
    if (connection.theirDidDoc) {
      // supplied list of supported protocols in preferred order
      const supportedProtocols = ['wss', 'ws', 'https', 'http', 'didcomm'] // TODO: move to config
      // map for efficient lookup of sortIndex
      const supportedProtocolsIndexTable = new Map(supportedProtocols.map((v, i) => [v, i]))
      const services = connection.theirDidDoc.didCommServices
      // filter out any un-supported
      const filteredServices = services.filter((service) =>
        supportedProtocols.includes(service.serviceEndpoint.split(':')[0])
      )
      // sort by protocol, if same protocol, sort by priority
      filteredServices.sort(function (
        serviceA: { serviceEndpoint: string; priority: number },
        serviceB: { serviceEndpoint: string; priority: number }
      ) {
        const protocolA = serviceA.serviceEndpoint.split(':')[0] || ''
        const protocolB = serviceB.serviceEndpoint.split(':')[0] || ''
        const preferred =
          (supportedProtocolsIndexTable.get(protocolA) || 0) - (supportedProtocolsIndexTable.get(protocolB) || 0)
        const priority = serviceA.priority - serviceB.priority
        return preferred || priority
      })
      return filteredServices
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
  keys?: EnvelopeKeys
  inboundMessage?: AgentMessage
  connection?: ConnectionRecord
  send(outboundMessage: OutboundPackage): Promise<void>
}
