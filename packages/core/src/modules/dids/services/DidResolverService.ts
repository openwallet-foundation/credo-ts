import type { AgentContext } from '../../../agent'
import type { DidResolver } from '../domain/DidResolver'
import type { DidResolutionOptions, DidResolutionResult, ParsedDid } from '../types'

import { InjectionSymbols } from '../../../constants'
import { AriesFrameworkError } from '../../../error'
import { Logger } from '../../../logger'
import { injectable, inject } from '../../../plugins'
import { IndyLedgerService } from '../../ledger'
import { parseDid } from '../domain/parse'
import { KeyDidResolver } from '../methods/key/KeyDidResolver'
import { PeerDidResolver } from '../methods/peer/PeerDidResolver'
import { SovDidResolver } from '../methods/sov/SovDidResolver'
import { WebDidResolver } from '../methods/web/WebDidResolver'
import { DidRepository } from '../repository'

@injectable()
export class DidResolverService {
  private logger: Logger
  private resolvers: DidResolver[]

  public constructor(
    indyLedgerService: IndyLedgerService,
    didRepository: DidRepository,
    @inject(InjectionSymbols.Logger) logger: Logger
  ) {
    this.logger = logger

    this.resolvers = [
      new SovDidResolver(indyLedgerService),
      new WebDidResolver(),
      new KeyDidResolver(),
      new PeerDidResolver(didRepository),
    ]
  }

  public async resolve(
    agentContext: AgentContext,
    didUrl: string,
    options: DidResolutionOptions = {}
  ): Promise<DidResolutionResult> {
    this.logger.debug(`resolving didUrl ${didUrl}`)

    const result = {
      didResolutionMetadata: {},
      didDocument: null,
      didDocumentMetadata: {},
    }

    let parsed: ParsedDid
    try {
      parsed = parseDid(didUrl)
    } catch (error) {
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

    return resolver.resolve(agentContext, parsed.did, parsed, options)
  }

  public async resolveDidDocument(agentContext: AgentContext, did: string) {
    const {
      didDocument,
      didResolutionMetadata: { error, message },
    } = await this.resolve(agentContext, did)

    if (!didDocument) {
      throw new AriesFrameworkError(`Unable to resolve did document for did '${did}': ${error} ${message}`)
    }
    return didDocument
  }

  private findResolver(parsed: ParsedDid): DidResolver | null {
    return this.resolvers.find((r) => r.supportedMethods.includes(parsed.method)) ?? null
  }
}
