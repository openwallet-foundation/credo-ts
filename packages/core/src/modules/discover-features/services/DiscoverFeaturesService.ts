import { Lifecycle, scoped } from 'tsyringe'

import { Dispatcher } from '../../../agent/Dispatcher'
import { QueryMessage, DiscloseMessage } from '../messages'

@scoped(Lifecycle.ContainerScoped)
export class DiscoverFeaturesService {
  private dispatcher: Dispatcher

  public constructor(dispatcher: Dispatcher) {
    this.dispatcher = dispatcher
  }

  public async createQuery(options: { query: string; comment?: string }) {
    const queryMessage = new QueryMessage(options)

    return queryMessage
  }

  public async createDisclose(queryMessage: QueryMessage) {
    const { query } = queryMessage

    const messageFamilies = this.dispatcher.supportedProtocols

    let protocols: string[] = []

    if (query === '*') {
      protocols = messageFamilies
    } else if (query.endsWith('*')) {
      const match = query.slice(0, -1)
      protocols = messageFamilies.filter((m) => m.startsWith(match))
    } else if (messageFamilies.includes(query)) {
      protocols = [query]
    }

    const discloseMessage = new DiscloseMessage({
      threadId: queryMessage.threadId,
      protocols: protocols.map((protocolId) => ({ protocolId })),
    })

    return discloseMessage
  }

  public getSupportedProtocols(protocolIds: string[]) {
    const messageFamilies = this.getMessageFamilies()
    return messageFamilies
      .map((family) => family.slice(0, -1))
      .filter((protocolId) => protocolIds.find((protocols) => protocolId.startsWith(protocols)))
  }

  private getMessageFamilies() {
    const messageTypes = this.dispatcher.supportedMessageTypes
    return Array.from(new Set(messageTypes.map((m) => m.substring(0, m.lastIndexOf('/') + 1))))
  }
}
