import { credDefIdRegex, indyDidRegex, schemaIdRegex, schemaVersionRegex } from '../regex'

describe('Valid Regular Expression', () => {
  const invalidTest = 'test'

  test('test for credDefIdRegex', async () => {
    const test = 'q7ATwTYbQDgiigVijUAej:3:CL:160971:1.0.0'
    expect(test).toMatch(credDefIdRegex)
    expect(credDefIdRegex.test(invalidTest)).toBeFalsy()
  })

  test('test for indyDidRegex', async () => {
    const test = 'did:sov:q7ATwTYbQDgiigVijUAej'
    expect(test).toMatch(indyDidRegex)
    expect(indyDidRegex.test(invalidTest)).toBeFalsy
  })

  test('test for schemaIdRegex', async () => {
    const test = 'q7ATwTYbQDgiigVijUAej:2:test:1.0'
    expect(test).toMatch(schemaIdRegex)
    expect(schemaIdRegex.test(invalidTest)).toBeFalsy
  })

  test('test for schemaVersionRegex', async () => {
    const test = '1.0.0'
    expect(test).toMatch(schemaVersionRegex)
    expect(schemaVersionRegex.test(invalidTest)).toBeFalsy
  })
})
