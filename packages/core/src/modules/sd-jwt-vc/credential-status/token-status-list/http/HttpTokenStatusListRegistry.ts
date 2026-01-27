import { AgentContext } from '../../../../../agent'
import { CredoError } from '../../../../../error'
import { fetchWithTimeout } from '../../../../../utils/fetch'
import type { SdJwtVcIssuerX5c } from '../../../SdJwtVcOptions'
import type { PublishTokenStatusListOptions, TokenStatusListRegistry } from '../TokenStatusListRegistry'

export class HttpTokenStatusListRegistry implements TokenStatusListRegistry {
  public readonly methodName = 'http'
  supportedIdentifier: RegExp =
    /^https?:\/\/(?: www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_,+.~#?&/=]*)$/

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
  async resolve(agentContext: AgentContext, uri: string): Promise<string> {
    const response = await fetchWithTimeout(agentContext.config.agentDependencies.fetch, uri, {
      headers: {
        Accept: 'application/statuslist+jwt',
      },
    })

    if (!response.ok) {
      throw new CredoError(
        `Received invalid response with status ${
          response.status
        } when fetching status list from ${uri}. ${await response.text()}`
      )
    }

    return await response.text()
  }
}
