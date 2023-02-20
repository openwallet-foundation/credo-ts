import {
  legacyIndyCredentialDefinitionIdRegex,
  legacyIndyDidRegex,
  legacyIndySchemaIdRegex,
  legacyIndySchemaVersionRegex,
} from '../legacyIndyIdentifiers'

describe('Legacy Indy Identifier Regex', () => {
  const invalidTest = 'test'

  test('test for legacyIndyCredentialDefinitionIdRegex', async () => {
    const test = 'q7ATwTYbQDgiigVijUAej:3:CL:160971:1.0.0'
    expect(test).toMatch(legacyIndyCredentialDefinitionIdRegex)
    expect(legacyIndyCredentialDefinitionIdRegex.test(invalidTest)).toBeFalsy()
  })

  test('test for legacyIndyDidRegex', async () => {
    const test = 'did:sov:q7ATwTYbQDgiigVijUAej'
    expect(test).toMatch(legacyIndyDidRegex)
    expect(legacyIndyDidRegex.test(invalidTest)).toBeFalsy
  })

  test('test for legacyIndySchemaIdRegex', async () => {
    const test = 'q7ATwTYbQDgiigVijUAej:2:test:1.0'
    expect(test).toMatch(legacyIndySchemaIdRegex)
    expect(legacyIndySchemaIdRegex.test(invalidTest)).toBeFalsy
  })

  test('test for legacyIndySchemaVersionRegex', async () => {
    const test = '1.0.0'
    expect(test).toMatch(legacyIndySchemaVersionRegex)
    expect(legacyIndySchemaVersionRegex.test(invalidTest)).toBeFalsy
  })
})
