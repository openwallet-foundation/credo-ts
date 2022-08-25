import type { FeatureQueryOptions } from '../../models'

import { Dispatcher } from '../../../../agent/Dispatcher'
import { injectable } from '../../../../plugins'
import { FeatureRegistry } from '../../FeatureRegistry'

import { V2DisclosuresMessageHandler, V2QueriesMessageHandler } from './handlers'
import { V2QueriesMessage, V2DisclosuresMessage } from './messages'

export interface CreateDisclosuresOptions {
  queries: FeatureQueryOptions[]
  threadId?: string
}

@injectable()
export class V2DiscoverFeaturesService {
  private featureRegistry: FeatureRegistry

  public constructor(dispatcher: Dispatcher, featureRegistry: FeatureRegistry) {
    this.featureRegistry = featureRegistry

    this.registerHandlers(dispatcher)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new V2DisclosuresMessageHandler())
    dispatcher.registerHandler(new V2QueriesMessageHandler(this))
  }

  public async createQueries(options: { queries: FeatureQueryOptions[] }) {
    const queryMessage = new V2QueriesMessage({ queries: options.queries })

    return queryMessage
  }

  public async processQueries(queryMessage: V2QueriesMessage) {
    const { queries } = queryMessage

    return await this.createDisclosures({
      threadId: queryMessage.threadId,
      queries,
    })
  }

  public async createDisclosures(options: CreateDisclosuresOptions) {
    const matches = this.featureRegistry.query(...options.queries)

    const discloseMessage = new V2DisclosuresMessage({
      threadId: options.threadId,
      features: matches,
    })

    return discloseMessage
  }
}
