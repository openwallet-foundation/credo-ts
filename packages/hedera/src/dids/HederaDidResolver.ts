import {
  type AgentContext,
  DidDocument,
  type DidResolutionOptions,
  type DidResolutionResult,
  type DidResolver,
  JsonTransformer,
  type ParsedDid,
} from '@credo-ts/core'

import { HederaLedgerService } from '../ledger'

export class HederaDidResolver implements DidResolver {
  public readonly supportedMethods = ['hedera']
  public readonly allowsCaching = true
  public readonly allowsLocalDidRecord = true

  public async resolve(
    agentContext: AgentContext,
    did: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _parsed: ParsedDid,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _didResolutionOptions: DidResolutionOptions
  ): Promise<DidResolutionResult> {
    try {
      agentContext.config.logger.trace('Try to resolve a did document from ledger')
      const ledgerService = agentContext.dependencyManager.resolve(HederaLedgerService)
      const resolveDidResult = await ledgerService.resolveDid(agentContext, did)
      const didDocument = JsonTransformer.fromJSON(resolveDidResult.didDocument, DidDocument)
      return {
        didDocument,
        didDocumentMetadata: resolveDidResult.didDocumentMetadata,
        didResolutionMetadata: resolveDidResult.didResolutionMetadata,
      }
    } catch (error) {
      agentContext.config.logger.debug('Error resolving the did', {
        error,
        did,
      })
      return {
        didDocument: null,
        didDocumentMetadata: {},
        didResolutionMetadata: {
          error: 'notFound',
          message: `Unable to resolve did '${did}': ${error}`,
        },
      }
    }
  }
}
