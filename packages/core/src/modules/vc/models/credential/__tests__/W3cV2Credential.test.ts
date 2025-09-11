import { JsonTransformer } from '../../../../../utils'
import { W3cV2Credential } from '../W3cV2Credential'

const validCredential = {
  '@context': ['https://www.w3.org/ns/credentials/v2', 'https://www.w3.org/ns/credentials/examples/v2'],
  id: 'http://university.example/credentials/3732',
  type: ['VerifiableCredential', 'ExampleDegreeCredential'],
  issuer: 'https://university.example/issuers/565049',
  validFrom: '2010-01-01T00:00:00Z',
  credentialSubject: {
    id: 'did:example:ebfeb1f712ebc6f1c276e12ec21',
    degree: {
      type: 'ExampleBachelorDegree',
      name: 'Bachelor of Science and Arts',
    },
  },
  credentialSchema: {
    id: 'https://example.org/examples/degree.json',
    type: 'JsonSchema',
  },
}

describe('W3cV2Credential', () => {
  test('preserves unknown properties via constructor', () => {
    const { '@context': context, ...properties } = validCredential
    const credential = new W3cV2Credential({ ...properties, context, someProperty: 'someValue' })

    expect(credential.context).toEqual(validCredential['@context'])
    expect(credential.someProperty).toBe('someValue')
  })

  test('preserves unknown properties via JSONTransformer', () => {
    const credential = JsonTransformer.fromJSON(
      {
        ...validCredential,
        someProperty: 'someValue',
      },
      W3cV2Credential
    )

    expect(credential.context).toEqual(validCredential['@context'])
    expect(credential.someProperty).toBe('someValue')
  })

  test('throws an error when verifiable credential context is missing or not the first entry', () => {
    expect(() => JsonTransformer.fromJSON({ ...validCredential, '@context': [] }, W3cV2Credential)).toThrow(
      /context must be an array of strings or objects, where the first item is the verifiable credential context URL./
    )

    expect(() =>
      JsonTransformer.fromJSON(
        {
          ...validCredential,
          '@context': ['https://www.w3.org/2018/credentials/examples/v1', 'https://www.w3.org/2018/credentials/v1'],
        },
        W3cV2Credential
      )
    ).toThrow(
      /context must be an array of strings or objects, where the first item is the verifiable credential context URL./
    )

    expect(() =>
      JsonTransformer.fromJSON({ ...validCredential, '@context': { some: 'property' } }, W3cV2Credential)
    ).toThrow(
      /context must be an array of strings or objects, where the first item is the verifiable credential context URL./
    )
  })

  test('throws an error when id is present and it is not an uri', () => {
    expect(() =>
      JsonTransformer.fromJSON({ ...validCredential, id: 'f8c7d9c9-3f9f-4d1d-9c0d-5b3b5d7b8f5c' }, W3cV2Credential)
    ).toThrow(/id must be an URI/)

    expect(() => JsonTransformer.fromJSON({ ...validCredential, id: 10 }, W3cV2Credential)).toThrow(/id must be an URI/)
  })

  test('throws an error when type is not an array of string or does not include VerifiableCredential', () => {
    expect(() => JsonTransformer.fromJSON({ ...validCredential, type: [] }, W3cV2Credential)).toThrow(
      /type must be "VerifiableCredential" or an array of strings which includes "VerifiableCredential"/
    )

    expect(() => JsonTransformer.fromJSON({ ...validCredential, type: ['AnotherType'] }, W3cV2Credential)).toThrow(
      /type must be "VerifiableCredential" or an array of strings which includes "VerifiableCredential"/
    )

    expect(() => JsonTransformer.fromJSON({ ...validCredential, type: { some: 'prop' } }, W3cV2Credential)).toThrow(
      /type must be "VerifiableCredential" or an array of strings which includes "VerifiableCredential"/
    )
  })

  test('throws an error when issuer is not a valid uri or object with id', () => {
    expect(() =>
      JsonTransformer.fromJSON({ ...validCredential, issuer: 'f8c7d9c9-3f9f-4d1d-9c0d-5b3b5d7b8f5c' }, W3cV2Credential)
    ).toThrow(/issuer must be an URL or a valid W3cV2Issuer instance/)

    expect(() =>
      JsonTransformer.fromJSON(
        { ...validCredential, issuer: { id: 'f8c7d9c9-3f9f-4d1d-9c0d-5b3b5d7b8f5c' } },
        W3cV2Credential
      )
    ).toThrow(/issuer must be an URL or a valid W3cV2Issuer instance/)

    expect(() => JsonTransformer.fromJSON({ ...validCredential, issuer: 10 }, W3cV2Credential)).toThrow(
      /issuer must be an URL or a valid W3cV2Issuer instance/
    )

    // Valid cases
    expect(() =>
      JsonTransformer.fromJSON({ ...validCredential, issuer: { id: 'urn:uri' } }, W3cV2Credential)
    ).not.toThrow()
    expect(() => JsonTransformer.fromJSON({ ...validCredential, issuer: 'uri:uri' }, W3cV2Credential)).not.toThrow()
  })

  test('throws an error when validFrom is not a valid date', () => {
    expect(() => JsonTransformer.fromJSON({ ...validCredential, validFrom: '2020' }, W3cV2Credential)).toThrow(
      /property validFrom has failed the following constraints: validFrom must be RFC 3339 date/
    )
  })

  test('throws an error when validUntil is present and it is not a valid date', () => {
    expect(() => JsonTransformer.fromJSON({ ...validCredential, validUntil: '2020' }, W3cV2Credential)).toThrow(
      /property validUntil has failed the following constraints: validUntil must be RFC 3339 date/
    )
  })

  test('throws an error when credentialSchema is present and it is not a valid credentialSchema object/array', () => {
    expect(() => JsonTransformer.fromJSON({ ...validCredential, credentialSchema: {} }, W3cV2Credential)).toThrow(
      /property credentialSchema\./
    )

    expect(() => JsonTransformer.fromJSON({ ...validCredential, credentialSchema: [{}] }, W3cV2Credential)).toThrow(
      /property credentialSchema\[0\]\./
    )

    expect(() =>
      JsonTransformer.fromJSON(
        { ...validCredential, credentialSchema: [{ id: 'some-random-value', type: 'valid' }] },
        W3cV2Credential
      )
    ).toThrow(/property credentialSchema\[0\]\.id has failed the following constraints/)

    expect(() =>
      JsonTransformer.fromJSON(
        { ...validCredential, credentialSchema: [validCredential.credentialSchema, validCredential.credentialSchema] },
        W3cV2Credential
      )
    ).not.toThrow()

    expect(() => JsonTransformer.fromJSON({ ...validCredential, credentialSchema: [] }, W3cV2Credential)).not.toThrow()
  })

  test('throws an error when credentialSubject is present and it is not a valid credentialSubject object/array', () => {
    expect(() => JsonTransformer.fromJSON({ ...validCredential, credentialSubject: [] }, W3cV2Credential)).toThrow()

    expect(() =>
      JsonTransformer.fromJSON(
        {
          ...validCredential,
          credentialSubject: [
            {
              id: 'some-random-value',
            },
          ],
        },
        W3cV2Credential
      )
    ).toThrow(/property credentialSubject\[0\].id has failed the following constraints/)

    expect(() =>
      JsonTransformer.fromJSON(
        {
          ...validCredential,
          credentialSubject: { id: 'urn:uri' },
        },
        W3cV2Credential
      )
    ).not.toThrow()

    expect(() =>
      JsonTransformer.fromJSON(
        {
          ...validCredential,
          credentialSubject: { id: 'urn:uri', some: 'value', someOther: { nested: 'value' } },
        },
        W3cV2Credential
      )
    ).not.toThrow()

    expect(() =>
      JsonTransformer.fromJSON(
        [
          {
            ...validCredential,
            credentialSubject: { id: 'urn:uri', some: 'value1', someOther: { nested: 'value1' } },
          },
        ],
        W3cV2Credential
      )
    ).not.toThrow()

    expect(() =>
      JsonTransformer.fromJSON(
        [
          {
            ...validCredential,
            credentialSubject: { id: 'urn:uri', some: 'value2', someOther: { nested: 'value2' } },
          },
        ],
        W3cV2Credential
      )
    ).not.toThrow()

    expect(() =>
      JsonTransformer.fromJSON(
        {
          ...validCredential,
          credentialSubject: [
            {
              id: 'urn:uri',
            },
          ],
        },
        W3cV2Credential
      )
    ).not.toThrow()
  })

  it('should transform from JSON to a class instance and back', () => {
    const credential = JsonTransformer.fromJSON(validCredential, W3cV2Credential)
    expect(credential).toBeInstanceOf(W3cV2Credential)

    const transformedJson = JsonTransformer.toJSON(credential)
    expect(transformedJson).toEqual(validCredential)
  })
})
