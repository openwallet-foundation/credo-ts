import { AgentContext } from '../../../../../agent'
import { CredoError } from '../../../../../error'
import { fetchWithTimeout } from '../../../../../utils/fetch'
import { SdJwtVcIssuerX5c } from '../../../SdJwtVcOptions'
import { PublishTokenStatusListOptions, TokenStatusListRegistry } from '../TokenStatusListRegistry'

export class HttpTokenStatusListRegistry implements TokenStatusListRegistry {
  public readonly supportedMethods = ['http']
  public readonly allowsCaching = true

  /**
   * Publish a verified token status list JWT to the registry
   */
  async publish(
    _agentContext: AgentContext,
    _issuer: SdJwtVcIssuerX5c,
    _jwt: string,
    _options: PublishTokenStatusListOptions
  ): Promise<string> {
    throw new Error('To be Implemented')
  }

  /**
   * Retrieve a token status list JWT from the registry
   */
  async retrieve(agentContext: AgentContext, statusListUri: SdJwtVcIssuerX5c): Promise<string> {
    const response = await fetchWithTimeout(agentContext.config.agentDependencies.fetch, statusListUri.issuer, {
      headers: {
        Accept: 'application/statuslist+jwt',
      },
    })

    if (!response.ok) {
      throw new CredoError(
        `Received invalid response with status ${
          response.status
        } when fetching status list from ${statusListUri.issuer}. ${await response.text()}`
      )
    }

    return await response.text()
  }
}
