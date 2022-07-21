import type { Key } from '../../crypto'
import type { DidResolutionOptions } from './types'

import { AgentContext } from '../../agent'
import { injectable } from '../../plugins'

import { DidRepository } from './repository'
import { DidResolverService } from './services/DidResolverService'

@injectable()
export class DidsApi {
  private resolverService: DidResolverService
  private didRepository: DidRepository
  private agentContext: AgentContext

  public constructor(resolverService: DidResolverService, didRepository: DidRepository, agentContext: AgentContext) {
    this.resolverService = resolverService
    this.didRepository = didRepository
    this.agentContext = agentContext
  }

  public resolve(didUrl: string, options?: DidResolutionOptions) {
    return this.resolverService.resolve(this.agentContext, didUrl, options)
  }

  public resolveDidDocument(didUrl: string) {
    return this.resolverService.resolveDidDocument(this.agentContext, didUrl)
  }

  public findByRecipientKey(recipientKey: Key) {
    return this.didRepository.findByRecipientKey(this.agentContext, recipientKey)
  }

  public findAllByRecipientKey(recipientKey: Key) {
    return this.didRepository.findAllByRecipientKey(this.agentContext, recipientKey)
  }
}
