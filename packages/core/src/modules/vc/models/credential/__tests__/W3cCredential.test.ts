import { JsonTransformer } from '../../../../../utils'
import { W3cCredential } from '../W3cCredential'

const validCredential = {
  '@context': ['https://www.w3.org/2018/credentials/v1', 'https://www.w3.org/2018/credentials/examples/v1'],
  id: 'http://example.edu/credentials/1872',
  type: ['VerifiableCredential', 'AlumniCredential'],
  issuer: 'https://example.edu/issuers/14',
  issuanceDate: '2010-01-01T19:23:24Z',
  credentialSubject: {
    id: 'did:example:ebfeb1f712ebc6f1c276e12ec21',
    alumniOf: {
      id: 'did:example:c276e12ec21ebfeb1f712ebc6f1',
      name: [
        {
          value: 'Example University',
          lang: 'en',
        },
      ],
    },
  },
  credentialSchema: {
    id: 'https://example.org/examples/degree.json',
    type: 'JsonSchemaValidator2018',
  },
}

describe('W3cCredential', () => {
  test('throws an error when verifiable credential context is missing or not the first entry', () => {
    expect(() => JsonTransformer.fromJSON({ ...validCredential, '@context': [] }, W3cCredential)).toThrow(
      /context must be an array of strings or objects, where the first item is the verifiable credential context URL./
    )

    expect(() =>
      JsonTransformer.fromJSON(
        {
          ...validCredential,
          '@context': ['https://www.w3.org/2018/credentials/examples/v1', 'https://www.w3.org/2018/credentials/v1'],
        },
        W3cCredential
      )
    ).toThrow(
      /context must be an array of strings or objects, where the first item is the verifiable credential context URL./
    )

    expect(() =>
      JsonTransformer.fromJSON({ ...validCredential, '@context': { some: 'property' } }, W3cCredential)
    ).toThrow(
      /context must be an array of strings or objects, where the first item is the verifiable credential context URL./
    )
  })

  test('throws an error when id is present and it is not an uri', () => {
    expect(() =>
      JsonTransformer.fromJSON({ ...validCredential, id: 'f8c7d9c9-3f9f-4d1d-9c0d-5b3b5d7b8f5c' }, W3cCredential)
    ).toThrow(/id must be an URI/)

    expect(() => JsonTransformer.fromJSON({ ...validCredential, id: 10 }, W3cCredential)).toThrow(/id must be an URI/)
  })

  test('throws an error when type is not an array of string or does not include VerifiableCredential', () => {
    expect(() => JsonTransformer.fromJSON({ ...validCredential, type: [] }, W3cCredential)).toThrow(
      /type must be "VerifiableCredential" or an array of strings which includes "VerifiableCredential"/
    )

    expect(() => JsonTransformer.fromJSON({ ...validCredential, type: ['AnotherType'] }, W3cCredential)).toThrow(
      /type must be "VerifiableCredential" or an array of strings which includes "VerifiableCredential"/
    )

    expect(() => JsonTransformer.fromJSON({ ...validCredential, type: { some: 'prop' } }, W3cCredential)).toThrow(
      /type must be "VerifiableCredential" or an array of strings which includes "VerifiableCredential"/
    )
  })

  test('throws an error when issuer is not a valid uri or object with id', () => {
    expect(() =>
      JsonTransformer.fromJSON({ ...validCredential, issuer: 'f8c7d9c9-3f9f-4d1d-9c0d-5b3b5d7b8f5c' }, W3cCredential)
    ).toThrow(/issuer must be an URI or an object with an id property which is an URI/)

    expect(() =>
      JsonTransformer.fromJSON(
        { ...validCredential, issuer: { id: 'f8c7d9c9-3f9f-4d1d-9c0d-5b3b5d7b8f5c' } },
        W3cCredential
      )
    ).toThrow(/issuer must be an URI or an object with an id property which is an URI/)

    expect(() => JsonTransformer.fromJSON({ ...validCredential, issuer: 10 }, W3cCredential)).toThrow(
      /issuer must be an URI or an object with an id property which is an URI/
    )

    // Valid cases
    expect(() =>
      JsonTransformer.fromJSON({ ...validCredential, issuer: { id: 'urn:uri' } }, W3cCredential)
    ).not.toThrow()
    expect(() => JsonTransformer.fromJSON({ ...validCredential, issuer: 'uri:uri' }, W3cCredential)).not.toThrow()
  })

  test('throws an error when issuanceDate is not a valid date', () => {
    expect(() => JsonTransformer.fromJSON({ ...validCredential, issuanceDate: '2020' }, W3cCredential)).toThrow(
      /property issuanceDate has failed the following constraints: issuanceDate is only defined by the Verifiable Credentials Data Model 1\.1 context/
    )
  })

  test('throws an error when issuanceDate is missing', () => {
    const { issuanceDate, ...withoutIssuanceDate } = validCredential
    expect(() => JsonTransformer.fromJSON(withoutIssuanceDate, W3cCredential)).toThrow(
      /property issuanceDate has failed the following constraints: issuanceDate is only defined by the Verifiable Credentials Data Model 1\.1 context/
    )
  })

  test('throws an error when expirationDate is present and it is not a valid date', () => {
    expect(() => JsonTransformer.fromJSON({ ...validCredential, expirationDate: '2020' }, W3cCredential)).toThrow(
      /property expirationDate has failed the following constraints: expirationDate is only defined by the Verifiable Credentials Data Model 1\.1 context/
    )
  })

  test('throws an error when data model 2.0 dates are used with the data model 1.1 context', () => {
    expect(() =>
      JsonTransformer.fromJSON({ ...validCredential, validFrom: '2010-01-01T19:23:24Z' }, W3cCredential)
    ).toThrow(
      /property validFrom has failed the following constraints: validFrom is only defined by the Verifiable Credentials Data Model 2\.0 context/
    )

    expect(() =>
      JsonTransformer.fromJSON({ ...validCredential, validUntil: '2030-01-01T19:23:24Z' }, W3cCredential)
    ).toThrow(
      /property validUntil has failed the following constraints: validUntil is only defined by the Verifiable Credentials Data Model 2\.0 context/
    )
  })

  test('exposes the data model version and version-agnostic validity dates', () => {
    const credential = JsonTransformer.fromJSON(
      { ...validCredential, expirationDate: '2030-01-01T19:23:24Z' },
      W3cCredential
    )

    expect(credential.dataModelVersion).toBe('1.1')
    expect(credential.validFromDate).toBe('2010-01-01T19:23:24Z')
    expect(credential.validUntilDate).toBe('2030-01-01T19:23:24Z')
  })

  test('throws an error when credentialSchema is present and it is not a valid credentialSchema object/array', () => {
    expect(() => JsonTransformer.fromJSON({ ...validCredential, credentialSchema: {} }, W3cCredential)).toThrow(
      /property credentialSchema\./
    )

    expect(() => JsonTransformer.fromJSON({ ...validCredential, credentialSchema: [{}] }, W3cCredential)).toThrow(
      /property credentialSchema\[0\]\./
    )

    expect(() =>
      JsonTransformer.fromJSON(
        { ...validCredential, credentialSchema: [{ id: 'some-random-value', type: 'valid' }] },
        W3cCredential
      )
    ).toThrow(/property credentialSchema\[0\]\.id has failed the following constraints/)

    expect(() =>
      JsonTransformer.fromJSON(
        { ...validCredential, credentialSchema: [validCredential.credentialSchema, validCredential.credentialSchema] },
        W3cCredential
      )
    ).not.toThrow()

    expect(() => JsonTransformer.fromJSON({ ...validCredential, credentialSchema: [] }, W3cCredential)).not.toThrow()
  })

  test('throws an error when credentialSubject is present and it is not a valid credentialSubject object/array', () => {
    expect(() => JsonTransformer.fromJSON({ ...validCredential, credentialSubject: [] }, W3cCredential)).toThrow()

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
        W3cCredential
      )
    ).not.toThrow()

    expect(() =>
      JsonTransformer.fromJSON(
        {
          ...validCredential,
          credentialSubject: { id: 'urn:uri' },
        },
        W3cCredential
      )
    ).not.toThrow()

    expect(() =>
      JsonTransformer.fromJSON(
        {
          ...validCredential,
          credentialSubject: { id: 'urn:uri', claims: { some: 'value', someOther: { nested: 'value' } } },
        },
        W3cCredential
      )
    ).not.toThrow()

    expect(() =>
      JsonTransformer.fromJSON(
        [
          {
            ...validCredential,
            credentialSubject: { id: 'urn:uri', claims: { some: 'value1', someOther: { nested: 'value1' } } },
          },
        ],
        W3cCredential
      )
    ).not.toThrow()

    expect(() =>
      JsonTransformer.fromJSON(
        [
          {
            ...validCredential,
            credentialSubject: { id: 'urn:uri', claims: { some: 'value2', someOther: { nested: 'value2' } } },
          },
        ],
        W3cCredential
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
        W3cCredential
      )
    ).not.toThrow()
  })

  it('should transform from JSON to a class instance and back', () => {
    const credential = JsonTransformer.fromJSON(validCredential, W3cCredential)
    expect(credential).toBeInstanceOf(W3cCredential)

    const transformedJson = JsonTransformer.toJSON(credential)
    expect(transformedJson).toEqual(validCredential)
  })

  describe('data model 2.0', () => {
    const validV2Credential = {
      '@context': ['https://www.w3.org/ns/credentials/v2', 'https://www.w3.org/ns/credentials/examples/v2'],
      id: 'http://example.edu/credentials/1872',
      type: ['VerifiableCredential', 'AlumniCredential'],
      issuer: 'https://example.edu/issuers/14',
      validFrom: '2010-01-01T19:23:24Z',
      validUntil: '2030-01-01T19:23:24Z',
      credentialSubject: {
        id: 'did:example:ebfeb1f712ebc6f1c276e12ec21',
      },
    }

    test('accepts a credential using the data model 2.0 context without issuanceDate', () => {
      expect(() => JsonTransformer.fromJSON(validV2Credential, W3cCredential)).not.toThrow()
    })

    test('accepts a credential using the data model 2.0 context without any validity dates', () => {
      const { validFrom, validUntil, ...withoutDates } = validV2Credential
      expect(() => JsonTransformer.fromJSON(withoutDates, W3cCredential)).not.toThrow()
    })

    test('throws an error when validFrom or validUntil is not a valid date', () => {
      expect(() => JsonTransformer.fromJSON({ ...validV2Credential, validFrom: '2020' }, W3cCredential)).toThrow(
        /property validFrom has failed the following constraints: validFrom is only defined by the Verifiable Credentials Data Model 2\.0 context/
      )

      expect(() => JsonTransformer.fromJSON({ ...validV2Credential, validUntil: '2020' }, W3cCredential)).toThrow(
        /property validUntil has failed the following constraints: validUntil is only defined by the Verifiable Credentials Data Model 2\.0 context/
      )
    })

    test('throws an error when data model 1.1 dates are used with the data model 2.0 context', () => {
      expect(() =>
        JsonTransformer.fromJSON({ ...validV2Credential, issuanceDate: '2010-01-01T19:23:24Z' }, W3cCredential)
      ).toThrow(
        /property issuanceDate has failed the following constraints: issuanceDate is only defined by the Verifiable Credentials Data Model 1\.1 context/
      )

      expect(() =>
        JsonTransformer.fromJSON({ ...validV2Credential, expirationDate: '2030-01-01T19:23:24Z' }, W3cCredential)
      ).toThrow(
        /property expirationDate has failed the following constraints: expirationDate is only defined by the Verifiable Credentials Data Model 1\.1 context/
      )
    })

    test('exposes the data model version and version-agnostic validity dates', () => {
      const credential = JsonTransformer.fromJSON(validV2Credential, W3cCredential)

      expect(credential.dataModelVersion).toBe('2.0')
      expect(credential.validFromDate).toBe('2010-01-01T19:23:24Z')
      expect(credential.validUntilDate).toBe('2030-01-01T19:23:24Z')
    })

    test('should transform from JSON to a class instance and back', () => {
      const credential = JsonTransformer.fromJSON(validV2Credential, W3cCredential)
      expect(credential).toBeInstanceOf(W3cCredential)

      expect(JsonTransformer.toJSON(credential)).toEqual(validV2Credential)
    })

    test('does not serialize dates that were not provided', () => {
      const credential = new W3cCredential({
        context: ['https://www.w3.org/ns/credentials/v2'],
        type: ['VerifiableCredential'],
        issuer: 'did:example:issuer',
        validFrom: '2010-01-01T19:23:24Z',
        credentialSubject: { id: 'did:example:subject' },
      })

      expect(JsonTransformer.toJSON(credential)).toEqual({
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        type: ['VerifiableCredential'],
        issuer: 'did:example:issuer',
        validFrom: '2010-01-01T19:23:24Z',
        credentialSubject: { id: 'did:example:subject' },
      })
    })
  })
})
