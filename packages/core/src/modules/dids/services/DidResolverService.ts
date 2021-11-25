import type { Logger } from '../../../logger'
import type { DIDResolutionOptions } from 'did-resolver'

import { Resolver } from 'did-resolver'
import { Lifecycle, scoped } from 'tsyringe'
import * as didWeb from 'web-did-resolver'

import { AgentConfig } from '../../../agent/AgentConfig'
import { IndyLedgerService } from '../../ledger'
import * as didSov from '../resolvers/IndyDidResolver'

@scoped(Lifecycle.ContainerScoped)
export class DidResolverService {
  private logger: Logger
  private resolver: Resolver

  public constructor(agentConfig: AgentConfig, indyLedgerService: IndyLedgerService) {
    this.logger = agentConfig.logger

    this.resolver = new Resolver(
      {
        ...didWeb.getResolver(),
        ...didSov.getResolver(indyLedgerService),
      },
      { cache: true }
    )
  }

  public resolve(didUrl: string, options?: DIDResolutionOptions) {
    this.logger.debug(`resolving didUrl ${didUrl}`)
    return this.resolver.resolve(didUrl, options)
  }
}
