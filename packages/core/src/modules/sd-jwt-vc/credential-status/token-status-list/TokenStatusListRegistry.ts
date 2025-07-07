import { BitsPerStatus } from '@sd-jwt/jwt-status-list'
import type { AgentContext } from '../../../../agent'
import { SdJwtVcIssuer } from '../../SdJwtVcOptions'

export interface PublishTokenStatusListOptions {
  name: string
  version?: string

  [x: string]: string | boolean | object | number | undefined
}

export interface TokenStatusListResponse {
  jwt: string
  name: string
  version: string
}

export interface TokenStatusListJwtPayload {
  iss: string
  iat: number
  additionalClaims: {
    status_list: {
      bits: BitsPerStatus
      lst: string
    }
  }
}

export interface TokenStatusListRegistry {
  readonly supportedMethods: string[]
  readonly allowsCaching: boolean
  /**
   * Publish a verified token status list JWT to the registry
   */
  publish(
    agentContext: AgentContext,
    issuer: SdJwtVcIssuer,
    jwt: string,
    options?: PublishTokenStatusListOptions
  ): Promise<string>

  /**
   * Retrieve a token status list JWT from the registry
   */
  retrieve(agentContext: AgentContext, statusListUri: SdJwtVcIssuer): Promise<TokenStatusListResponse>
}
