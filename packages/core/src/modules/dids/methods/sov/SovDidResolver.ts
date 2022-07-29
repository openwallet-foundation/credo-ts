import type { AgentContext } from '../../../../agent'
import type { DidResolver } from '../../domain/DidResolver'
import type { DidResolutionResult, ParsedDid } from '../../types'

import { injectable } from '../../../../plugins'
import { IndyLedgerService } from '../../../ledger/services/indy'

import { addServicesFromEndpointsAttrib, sovDidDocumentFromDid } from './util'

@injectable()
export class SovDidResolver implements DidResolver {
  private indyLedgerService: IndyLedgerService

  public constructor(indyLedgerService: IndyLedgerService) {
    this.indyLedgerService = indyLedgerService
  }

  public readonly supportedMethods = ['sov']

  public async resolve(agentContext: AgentContext, did: string, parsed: ParsedDid): Promise<DidResolutionResult> {
    const didDocumentMetadata = {}

    try {
      const nym = await this.indyLedgerService.getPublicDid(agentContext, parsed.id)
      const endpoints = await this.indyLedgerService.getEndpointsForDid(agentContext, parsed.id)

      const keyAgreementId = `${parsed.did}#key-agreement-1`
      const builder = sovDidDocumentFromDid(parsed.did, nym.verkey)
      addServicesFromEndpointsAttrib(builder, parsed.did, endpoints, keyAgreementId)

      return {
        didDocument: builder.build(),
        didDocumentMetadata,
        didResolutionMetadata: { contentType: 'application/did+ld+json' },
      }
    } catch (error) {
      return {
        didDocument: null,
        didDocumentMetadata,
        didResolutionMetadata: {
          error: 'notFound',
          message: `resolver_error: Unable to resolve did '${did}': ${error}`,
        },
      }
    }
  }
}
