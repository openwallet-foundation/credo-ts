import type { AgentContext } from '../../../../agent'
import type { IndyEndpointAttrib } from '../../../ledger'
import type { DidResolver } from '../../domain/DidResolver'
import type { DidResolutionResult, ParsedDid } from '../../types'
import type * as Indy from 'indy-sdk'

import { isIndyError } from '../../../..//utils/indyError'
import { AgentDependencies } from '../../../../agent/AgentDependencies'
import { InjectionSymbols } from '../../../../constants'
import { IndySdkError } from '../../../../error'
import { Logger } from '../../../../logger'
import { inject, injectable } from '../../../../plugins'
import { IndyPoolService } from '../../../ledger'

import { addServicesFromEndpointsAttrib, sovDidDocumentFromDid } from './util'

@injectable()
export class IndySdkSovDidResolver implements DidResolver {
  private indy: typeof Indy
  private indyPoolService: IndyPoolService
  private logger: Logger

  public constructor(
    indyPoolService: IndyPoolService,
    @inject(InjectionSymbols.AgentDependencies) agentDependencies: AgentDependencies,
    @inject(InjectionSymbols.Logger) logger: Logger
  ) {
    this.indy = agentDependencies.indy
    this.indyPoolService = indyPoolService
    this.logger = logger
  }

  public readonly supportedMethods = ['sov']

  public async resolve(agentContext: AgentContext, did: string, parsed: ParsedDid): Promise<DidResolutionResult> {
    const didDocumentMetadata = {}

    try {
      const nym = await this.getPublicDid(agentContext, parsed.id)
      const endpoints = await this.getEndpointsForDid(agentContext, parsed.id)

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

  private async getPublicDid(agentContext: AgentContext, did: string) {
    // Getting the pool for a did also retrieves the DID. We can just use that
    const { did: didResponse } = await this.indyPoolService.getPoolForDid(agentContext, did)

    return didResponse
  }

  private async getEndpointsForDid(agentContext: AgentContext, did: string) {
    const { pool } = await this.indyPoolService.getPoolForDid(agentContext, did)

    try {
      this.logger.debug(`Get endpoints for did '${did}' from ledger '${pool.id}'`)

      const request = await this.indy.buildGetAttribRequest(null, did, 'endpoint', null, null)

      this.logger.debug(`Submitting get endpoint ATTRIB request for did '${did}' to ledger '${pool.id}'`)
      const response = await this.indyPoolService.submitReadRequest(pool, request)

      if (!response.result.data) return {}

      const endpoints = JSON.parse(response.result.data as string)?.endpoint as IndyEndpointAttrib
      this.logger.debug(`Got endpoints '${JSON.stringify(endpoints)}' for did '${did}' from ledger '${pool.id}'`, {
        response,
        endpoints,
      })

      return endpoints ?? {}
    } catch (error) {
      this.logger.error(`Error retrieving endpoints for did '${did}' from ledger '${pool.id}'`, {
        error,
      })

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }
}
