import type { Logger } from '../../../logger'
import type { DidResolver } from '../domain/DidResolver'
import type { DIDMetadata, DidResolutionOptions, DidResolutionResult, ParsedDid } from '../types'

import { AgentConfig } from '../../../agent/AgentConfig'
import { AriesFrameworkError } from '../../../error'
import { injectable } from '../../../plugins'
import { IndyLedgerService } from '../../ledger'
import { DidType } from '../domain/Did'
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

  public constructor(agentConfig: AgentConfig, indyLedgerService: IndyLedgerService, didRepository: DidRepository) {
    this.logger = agentConfig.logger

    this.resolvers = [
      new SovDidResolver(indyLedgerService),
      new WebDidResolver(),
      new KeyDidResolver(),
      new PeerDidResolver(didRepository),
    ]
  }

  public async resolve(didUrl?: string, options: DidResolutionOptions = {}): Promise<DidResolutionResult> {
    this.logger.debug(`resolving didUrl ${didUrl}`)

    const result = {
      didResolutionMetadata: {},
      didDocument: null,
      didDocumentMetadata: {},
      didType: DidType.Unknown,
    }

    if (!didUrl) {
      return result
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

    const resolvedDid = await resolver.resolve(parsed.did, parsed, options)
    resolvedDid.didMeta = await this.resolveDidMetadata(parsed.did)
    return resolvedDid
  }

  public async resolveDidDocument(did?: string) {
    const {
      didDocument,
      didResolutionMetadata: { error, message },
    } = await this.resolve(did)

    if (!didDocument) {
      throw new AriesFrameworkError(`Unable to resolve did document for did '${did}': ${error} ${message}`)
    }
    return didDocument
  }

  private findResolver(parsed: ParsedDid): DidResolver | null {
    return this.resolvers.find((r) => r.supportedMethods.includes(parsed.method)) ?? null
  }

  private async resolveDidMetadata(did: string): Promise<DIDMetadata> {
    this.logger.debug(`resolving did metadata  ${did}`)
    return {
      label: undefined,
      logoUrl: undefined,
    }
  }
}
