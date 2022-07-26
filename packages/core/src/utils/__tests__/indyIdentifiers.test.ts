import {
  createQualifiedIdentifier,
  createUnqualifiedIdentifier,
  getDidFromSchemaOrCredentialDefinitionId,
} from '../indyIdentifiers'

describe('Mangle indy identifiers', () => {
  const indyNamespace = 'some:staging'
  const unqualifiedIdentifier = 'q7ATwTYbQDgiigVijUAej'
  const qualifiedIdentifier = `did:indy:${indyNamespace}:${unqualifiedIdentifier}`
  const schemaId = `${unqualifiedIdentifier}:2:SomeName:4.2.0`
  const credentialDefId = `${unqualifiedIdentifier}:3:CL:1236945:awesomeTag`

  test('create a qualified identifier from an unqualified identifier', async () => {
    expect(createQualifiedIdentifier(indyNamespace, unqualifiedIdentifier)).toMatch(qualifiedIdentifier)
  })

  test('create an unqualified identifier from a qualified identifier', async () => {
    expect(createUnqualifiedIdentifier(unqualifiedIdentifier)).toMatch(unqualifiedIdentifier)
  })

  test('get the Did from SchemaId', () => {
    expect(getDidFromSchemaOrCredentialDefinitionId(schemaId)).toBe(unqualifiedIdentifier)
  })

  test('get the Did from CredentialDefinitionId', () => {
    expect(getDidFromSchemaOrCredentialDefinitionId(credentialDefId)).toBe(unqualifiedIdentifier)
  })
})
