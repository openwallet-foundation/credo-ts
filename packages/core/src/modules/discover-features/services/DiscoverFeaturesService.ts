import type { QueryMessage } from '../messages'

import { Lifecycle, scoped } from 'tsyringe'

import { Dispatcher } from '../../../agent/Dispatcher'
import { DiscloseMessage, QueryMessageV2 } from '../messages'

@scoped(Lifecycle.ContainerScoped)
export class DiscoverFeaturesService {
  private dispatcher: Dispatcher

  public constructor(dispatcher: Dispatcher) {
    this.dispatcher = dispatcher
  }

  public async createQuery(did: string, options: { query: string; comment?: string }) {
    const queryMessage = new QueryMessageV2({
      from: did,
      body: options,
    })

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
}
