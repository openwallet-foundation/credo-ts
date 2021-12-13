import type { Logger } from '../../../logger'
import type { DidResolver } from '../resolvers/DidResolver'
import type { DidResolutionOptions, DidResolutionResult, ParsedDid } from '../types'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { IndyLedgerService } from '../../ledger'
import { parseDid } from '../parse'
import { IndyDidResolver } from '../resolvers/IndyDidResolver'
import { KeyDidResolver } from '../resolvers/KeyDidResolver'
import { WebDidResolver } from '../resolvers/WebDidResolver'

@scoped(Lifecycle.ContainerScoped)
export class DidResolverService {
  private logger: Logger
  private resolvers: DidResolver[]

  public constructor(agentConfig: AgentConfig, indyLedgerService: IndyLedgerService) {
    this.logger = agentConfig.logger

    this.resolvers = [new IndyDidResolver(indyLedgerService), new WebDidResolver(), new KeyDidResolver()]
  }

  public async resolve(didUrl: string, options: DidResolutionOptions = {}): Promise<DidResolutionResult> {
    this.logger.debug(`resolving didUrl ${didUrl}`)

    const result = {
      didResolutionMetadata: {},
      didDocument: null,
      didDocumentMetadata: {},
    }

    const parsed = parseDid(didUrl)
    if (!parsed) {
      return {
        ...result,
        didResolutionMetadata: { error: 'invalidDid' },
      }
    }

    const resolver = this.findResolver(parsed)
    if (!resolver) {
      return {
        ...result,
        didResolutionMetadata: { error: 'unsupportedDidMethod' },
      }
    }

    return resolver.resolve(parsed.did, parsed, options)
  }

  private findResolver(parsed: ParsedDid): DidResolver | null {
    return this.resolvers.find((r) => r.supportedMethods.includes(parsed.method)) ?? null
  }
}
