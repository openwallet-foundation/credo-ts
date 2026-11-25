import { getAgentContext } from '../../../../core/tests'
import { AnonCredsModuleConfig } from '../../AnonCredsModuleConfig'
import type { AnonCredsRegistry } from '../../services'
import {
  areIdentifiersEqual,
  getIdentifierVariants,
  identifierQuery,
  withCanonicalRestrictionIdentifiers,
  withIdentifierQueryVariants,
  withIdentifierVariantKeys,
  withProofRequestRestrictionVariants,
  withRestrictionVariants,
} from '../identifierVariants'

// Ids of the `test:` registry are case-insensitive, with the upper case form as canonical form
const registries = [
  {
    supportedIdentifier: /^test:/,
    getIdentifierVariants: (identifier: string) => [
      ...new Set([identifier.toUpperCase(), identifier, identifier.toLowerCase()]),
    ],
  },
  { supportedIdentifier: /^dropsinput:/, getIdentifierVariants: (identifier: string) => [identifier.toUpperCase()] },
  { supportedIdentifier: /^plain:/ },
] as unknown as AnonCredsRegistry[]

const agentContext = getAgentContext({
  registerInstances: [[AnonCredsModuleConfig, { registries } as unknown as AnonCredsModuleConfig]],
})

describe('identifierVariants', () => {
  test('getIdentifierVariants returns the forms from the registry for the identifier', () => {
    expect(getIdentifierVariants(agentContext, 'test:Ab')).toEqual(['TEST:AB', 'test:Ab', 'test:ab'])
    expect(getIdentifierVariants(agentContext, 'plain:Ab')).toEqual(['plain:Ab'])
    expect(getIdentifierVariants(agentContext, 'unknown:Ab')).toEqual(['unknown:Ab'])
    expect(getIdentifierVariants(getAgentContext(), 'test:Ab')).toEqual(['test:Ab'])
  })

  test('getIdentifierVariants always includes the identifier itself', () => {
    expect(getIdentifierVariants(agentContext, 'dropsinput:a')).toEqual(['DROPSINPUT:A', 'dropsinput:a'])
  })

  test('areIdentifiersEqual compares the canonical forms', () => {
    expect(areIdentifiersEqual(agentContext, 'test:Ab', 'test:aB')).toBe(true)
    expect(areIdentifiersEqual(agentContext, 'test:aB', 'test:Ab')).toBe(true)
    expect(areIdentifiersEqual(agentContext, 'test:a', 'test:b')).toBe(false)
    expect(areIdentifiersEqual(agentContext, 'plain:a', 'plain:A')).toBe(false)
    expect(areIdentifiersEqual(agentContext, 'plain:a', undefined)).toBe(false)
    expect(areIdentifiersEqual(agentContext, undefined, undefined)).toBe(true)
  })

  test('identifierQuery matches every form of the identifier', () => {
    expect(identifierQuery(agentContext, 'schemaId', 'test:Ab')).toEqual({
      $or: [{ schemaId: 'TEST:AB' }, { schemaId: 'test:Ab' }, { schemaId: 'test:ab' }],
    })
    expect(identifierQuery(agentContext, 'schemaId', 'plain:Ab')).toEqual({ schemaId: 'plain:Ab' })
  })

  test('withIdentifierQueryVariants replaces only the tags with an identifier in more than one form', () => {
    expect(
      withIdentifierQueryVariants(
        agentContext,
        { schemaId: 'test:a', credentialDefinitionId: 'plain:b', issuerId: 'x' },
        ['schemaId', 'credentialDefinitionId']
      )
    ).toEqual({
      $and: [
        { credentialDefinitionId: 'plain:b', issuerId: 'x' },
        { $or: [{ schemaId: 'TEST:A' }, { schemaId: 'test:a' }] },
      ],
    })

    const query = { schemaId: 'plain:a', credentialDefinitionId: undefined }
    expect(withIdentifierQueryVariants(agentContext, query, ['schemaId', 'credentialDefinitionId'])).toBe(query)
  })

  test('withIdentifierVariantKeys adds every form of the keys without overwriting keys passed in', () => {
    expect(withIdentifierVariantKeys(agentContext, { 'test:a': 1, 'plain:b': 2 })).toEqual({
      'TEST:A': 1,
      'test:a': 1,
      'plain:b': 2,
    })
    expect(withIdentifierVariantKeys(agentContext, { 'test:a': 1, 'TEST:A': 2 })).toEqual({
      'test:a': 1,
      'TEST:A': 2,
    })
  })

  test('withRestrictionVariants expands every combination of identifier forms', () => {
    expect(
      withRestrictionVariants(agentContext, [{ schema_id: 'test:a', cred_def_id: 'test:b', schema_name: 'name' }])
    ).toEqual([
      { schema_id: 'TEST:A', cred_def_id: 'TEST:B', schema_name: 'name' },
      { schema_id: 'TEST:A', cred_def_id: 'test:b', schema_name: 'name' },
      { schema_id: 'test:a', cred_def_id: 'TEST:B', schema_name: 'name' },
      { schema_id: 'test:a', cred_def_id: 'test:b', schema_name: 'name' },
    ])
  })

  test('withRestrictionVariants keeps a restriction without identifiers in more than one form as is', () => {
    const restriction = { schema_id: 'plain:a', cred_def_id: 'TEST:B' }
    const expanded = withRestrictionVariants(agentContext, [restriction])

    expect(expanded).toHaveLength(1)
    expect(expanded[0]).toBe(restriction)
  })

  const proofRequest = {
    name: 'proof',
    version: '1.0',
    nonce: '1',
    requested_attributes: {
      a: { name: 'name', restrictions: [{ cred_def_id: 'test:a' }] },
      b: { name: 'other' },
    },
    requested_predicates: {
      p: { name: 'age', p_type: '>=' as const, p_value: 18, restrictions: [{ schema_id: 'test:b', issuer_id: 'x' }] },
    },
  }

  test('withProofRequestRestrictionVariants expands attribute and predicate restrictions', () => {
    const withVariants = withProofRequestRestrictionVariants(agentContext, proofRequest)

    expect(withVariants.requested_attributes.a.restrictions).toEqual([
      { cred_def_id: 'TEST:A' },
      { cred_def_id: 'test:a' },
    ])
    expect(withVariants.requested_attributes.b).toEqual({ name: 'other' })
    expect(withVariants.requested_predicates.p.restrictions).toEqual([
      { schema_id: 'TEST:B', issuer_id: 'x' },
      { schema_id: 'test:b', issuer_id: 'x' },
    ])
  })

  test('withCanonicalRestrictionIdentifiers puts the restriction identifiers in canonical form', () => {
    const canonical = withCanonicalRestrictionIdentifiers(agentContext, proofRequest)

    expect(canonical.requested_attributes.a.restrictions).toEqual([{ cred_def_id: 'TEST:A' }])
    expect(canonical.requested_predicates.p.restrictions).toEqual([{ schema_id: 'TEST:B', issuer_id: 'x' }])
  })
})
