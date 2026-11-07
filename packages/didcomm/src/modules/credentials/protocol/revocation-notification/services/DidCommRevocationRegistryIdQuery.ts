import type { AgentContext, Query } from '@credo-ts/core'
import type { DidCommCredentialExchangeRecord } from '../../../repository'

/**
 * Builds the query for the `anonCredsRevocationRegistryId` tag of a received revocation notification. Without
 * a registered builder the id is matched exactly. The anoncreds module registers one that matches every form of
 * the id that its registries return.
 */
export type DidCommRevocationRegistryIdQueryBuilder = (
  agentContext: AgentContext,
  revocationRegistryId: string
) => Query<DidCommCredentialExchangeRecord>

export const DidCommRevocationRegistryIdQueryBuilderToken = Symbol('DidCommRevocationRegistryIdQueryBuilder')
