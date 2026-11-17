import type { AgentContext } from '@credo-ts/core'
import type { DidCommCredentialExchangeRecord } from '../../repository'

export interface DidCommRevocationNotificationFormatService {
  readonly supportedRevocationFormats: readonly string[]

  findCredentialExchangeRecord(
    agentContext: AgentContext,
    credentialId: string,
    revocationFormat: string,
    connectionId?: string
  ): Promise<DidCommCredentialExchangeRecord>

  getCredentialId(
    agentContext: AgentContext,
    credentialExchangeRecord: DidCommCredentialExchangeRecord,
    revocationFormat: string
  ): Promise<string>
}
