import type { AgentContext, BaseRecord, Query, SimpleQuery } from '@credo-ts/core'
import { AnonCredsModuleConfig } from '../AnonCredsModuleConfig'
import type { AnonCredsProofRequest, AnonCredsProofRequestRestriction } from '../models'

/**
 * Helpers that treat the forms of an identifier that the registry for it returns from
 * `getIdentifierVariants` (e.g. did:indy ids with and without percent-encoding) as the same id.
 */

const restrictionIdentifierKeys = ['schema_id', 'cred_def_id', 'rev_reg_id'] as const

/**
 * Returns every form of an identifier, with the canonical form first.
 */
export function getIdentifierVariants(agentContext: AgentContext, identifier: string): string[] {
  if (!agentContext.dependencyManager.isRegistered(AnonCredsModuleConfig, true)) return [identifier]

  const registry = agentContext.dependencyManager
    .resolve(AnonCredsModuleConfig)
    .registries.find((registry) => registry.supportedIdentifier.test(identifier))
  const variants = registry?.getIdentifierVariants?.(identifier) ?? [identifier]

  return variants.includes(identifier) ? variants : [...variants, identifier]
}

export function areIdentifiersEqual(
  agentContext: AgentContext,
  identifierA: string | undefined,
  identifierB: string | undefined
) {
  if (identifierA === identifierB) return true
  if (identifierA === undefined || identifierB === undefined) return false

  return getIdentifierVariants(agentContext, identifierA)[0] === getIdentifierVariants(agentContext, identifierB)[0]
}

// biome-ignore lint/suspicious/noExplicitAny: matches the Query type of core
function variantsQuery<T extends BaseRecord<any, any, any>>(tagName: string, variants: string[]): Query<T> {
  if (variants.length === 1) return { [tagName]: variants[0] } as Query<T>

  return { $or: variants.map((variant) => ({ [tagName]: variant }) as Query<T>) }
}

/**
 * Query that matches `tagName` against every form of an identifier.
 */
// biome-ignore lint/suspicious/noExplicitAny: matches the Query type of core
export function identifierQuery<T extends BaseRecord<any, any, any>>(
  agentContext: AgentContext,
  tagName: string,
  identifier: string
): Query<T> {
  return variantsQuery<T>(tagName, getIdentifierVariants(agentContext, identifier))
}

/**
 * Query for `query` where each of the `tagNames` matches every form of its identifier.
 */
// biome-ignore lint/suspicious/noExplicitAny: matches the Query type of core
export function withIdentifierQueryVariants<T extends BaseRecord<any, any, any>>(
  agentContext: AgentContext,
  query: SimpleQuery<T>,
  tagNames: string[]
): Query<T> {
  const simpleQuery: Record<string, unknown> = { ...query }
  const identifierQueries: Query<T>[] = []

  for (const tagName of tagNames) {
    const identifier = simpleQuery[tagName]
    if (typeof identifier !== 'string') continue

    const variants = getIdentifierVariants(agentContext, identifier)
    if (variants.length === 1) continue

    delete simpleQuery[tagName]
    identifierQueries.push(variantsQuery<T>(tagName, variants))
  }

  if (identifierQueries.length === 0) return query
  return { $and: [simpleQuery as SimpleQuery<T>, ...identifierQueries] }
}

/**
 * Adds an entry under every form of each identifier key, as anoncreds-rs looks objects up by the exact id in the
 * credential or presentation.
 */
export function withIdentifierVariantKeys<T>(agentContext: AgentContext, objects: Record<string, T>) {
  const withVariants: Record<string, T> = {}
  for (const [identifier, object] of Object.entries(objects)) {
    for (const variant of getIdentifierVariants(agentContext, identifier)) {
      withVariants[variant] ??= object
    }
  }

  // Keys passed in always win over a variant of another key
  return { ...withVariants, ...objects }
}

/**
 * Adds a restriction for each form of the identifiers in the restrictions, so they match credentials with the id in
 * any form.
 */
export function withRestrictionVariants(
  agentContext: AgentContext,
  restrictions: AnonCredsProofRequestRestriction[]
): AnonCredsProofRequestRestriction[] {
  return restrictions.flatMap((restriction) => {
    const identifierVariants = restrictionIdentifierKeys.flatMap((key) => {
      const identifier = restriction[key]
      if (!identifier) return []

      const variants = getIdentifierVariants(agentContext, identifier)
      return variants.length > 1 ? [{ key, variants }] : []
    })

    return identifierVariants.reduce(
      (expanded, { key, variants }) => expanded.flatMap((r) => variants.map((variant) => ({ ...r, [key]: variant }))),
      [restriction]
    )
  })
}

function mapProofRequestRestrictions(
  proofRequest: AnonCredsProofRequest,
  map: (restrictions: AnonCredsProofRequestRestriction[]) => AnonCredsProofRequestRestriction[]
): AnonCredsProofRequest {
  const mapItems = <T extends { restrictions?: AnonCredsProofRequestRestriction[] }>(items: Record<string, T>) =>
    Object.fromEntries(
      Object.entries(items).map(([referent, item]) => [
        referent,
        item.restrictions ? { ...item, restrictions: map(item.restrictions) } : item,
      ])
    )

  return {
    ...proofRequest,
    requested_attributes: mapItems(proofRequest.requested_attributes),
    requested_predicates: mapItems(proofRequest.requested_predicates),
  }
}

export function withProofRequestRestrictionVariants(agentContext: AgentContext, proofRequest: AnonCredsProofRequest) {
  return mapProofRequestRestrictions(proofRequest, (restrictions) =>
    withRestrictionVariants(agentContext, restrictions)
  )
}

/**
 * Returns the proof request with the identifiers in its restrictions in canonical form, so requests can be compared.
 */
export function withCanonicalRestrictionIdentifiers(agentContext: AgentContext, proofRequest: AnonCredsProofRequest) {
  return mapProofRequestRestrictions(proofRequest, (restrictions) =>
    restrictions.map((restriction) => {
      const canonical = { ...restriction }
      for (const key of restrictionIdentifierKeys) {
        const identifier = canonical[key]
        if (identifier) canonical[key] = getIdentifierVariants(agentContext, identifier)[0]
      }
      return canonical
    })
  )
}
