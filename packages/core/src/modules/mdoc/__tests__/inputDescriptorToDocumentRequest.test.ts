import {
  fieldMatchesToDocumentRequest,
  inputDescriptorToDocumentRequest,
} from '../utils/inputDescriptorToDocumentRequest'

describe('inputDescriptorToDocumentRequest', () => {
  test('requests the data element of each field for the doctype that is the input descriptor id', () => {
    expect(
      inputDescriptorToDocumentRequest({
        id: 'com.example.mdl',
        constraints: {
          fields: [
            { path: ["$['org.iso.18013.5.1']['family_name']"], intent_to_retain: true },
            { path: ["$['org.iso.18013.5.1']['birth_date']"] },
            { path: ["$['com.example.mdl']['membership']"], intent_to_retain: false },
          ],
        },
      })
    ).toStrictEqual({
      docType: 'com.example.mdl',
      nameSpaces: {
        'org.iso.18013.5.1': { family_name: true, birth_date: false },
        'com.example.mdl': { membership: false },
      },
    })
  })

  test('accepts every JSONPath notation of a name space and data element', () => {
    expect(
      inputDescriptorToDocumentRequest({
        id: 'org.iso.18013.5.1.mDL',
        constraints: {
          fields: [
            { path: ['$["org.iso.18013.5.1"]["family_name"]'] },
            { path: ["$['org.iso.18013.5.1'].given_name"] },
            { path: ['$.namespace.element'] },
          ],
        },
      })
    ).toStrictEqual({
      docType: 'org.iso.18013.5.1.mDL',
      nameSpaces: {
        'org.iso.18013.5.1': { family_name: false, given_name: false },
        namespace: { element: false },
      },
    })
  })

  test('uses the first path of a field that addresses a data element', () => {
    expect(
      inputDescriptorToDocumentRequest({
        id: 'org.iso.18013.5.1.mDL',
        constraints: {
          fields: [
            { path: ['$.vct', "$['org.iso.18013.5.1']['family_name']", "$['org.iso.18013.5.1']['given_name']"] },
          ],
        },
      })
    ).toStrictEqual({ docType: 'org.iso.18013.5.1.mDL', nameSpaces: { 'org.iso.18013.5.1': { family_name: false } } })
  })

  test('requests the data element holding the value of a nested path', () => {
    expect(
      inputDescriptorToDocumentRequest({
        id: 'org.iso.18013.5.1.mDL',
        constraints: {
          fields: [{ path: ["$['org.iso.18013.5.1']['driving_privileges'][0]['vehicle_category_code']"] }],
        },
      })
    ).toStrictEqual({
      docType: 'org.iso.18013.5.1.mDL',
      nameSpaces: { 'org.iso.18013.5.1': { driving_privileges: false } },
    })
  })

  test('requests nothing for a path that does not address a data element', () => {
    expect(
      inputDescriptorToDocumentRequest({
        id: 'org.iso.18013.5.1.mDL',
        constraints: {
          fields: [{ path: ['$.vct'] }, { path: ["$['org.iso.18013.5.1'][*]"] }, { path: ['$..family_name'] }],
        },
      })
    ).toBeUndefined()
  })

  test('with an mdoc, only requests an optional data element the mdoc has', () => {
    const mdoc = {
      issuerSignedNamespaces: { 'org.iso.18013.5.1': { family_name: 'Jones', portrait: 'bstr' } },
    } as never
    const inputDescriptor = {
      id: 'org.iso.18013.5.1.mDL',
      constraints: {
        fields: [
          { path: ["$['org.iso.18013.5.1']['family_name']"] },
          { path: ["$['org.iso.18013.5.1']['given_name']"] },
          { path: ["$['org.iso.18013.5.1']['portrait']"], optional: true },
          { path: ["$['org.iso.18013.5.1']['signature']"], optional: true },
        ],
      },
    }

    // A required data element the mdoc lacks is still requested, so the request can't be answered
    expect(inputDescriptorToDocumentRequest(inputDescriptor, { mdoc })?.nameSpaces).toStrictEqual({
      'org.iso.18013.5.1': { family_name: false, given_name: false, portrait: false },
    })
    expect(inputDescriptorToDocumentRequest(inputDescriptor)?.nameSpaces).toStrictEqual({
      'org.iso.18013.5.1': { family_name: false, given_name: false, portrait: false, signature: false },
    })
  })

  test('keeps a __proto__ name space or data element as an own property', () => {
    const documentRequest = inputDescriptorToDocumentRequest({
      id: 'org.iso.18013.5.1.mDL',
      constraints: { fields: [{ path: ["$['__proto__']['polluted']"] }, { path: ["$['ns']['__proto__']"] }] },
    })

    expect(Object.hasOwn(documentRequest?.nameSpaces ?? {}, '__proto__')).toBe(true)
    expect(Object.hasOwn(documentRequest?.nameSpaces.ns ?? {}, '__proto__')).toBe(true)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})

describe('fieldMatchesToDocumentRequest', () => {
  const node = (...path: Array<string | number>) => ({ path, value: 'value' })

  test('requests the data elements the matched paths resolved to, retained if any field intends to', () => {
    expect(
      fieldMatchesToDocumentRequest('org.iso.18013.5.1.mDL', [
        { nodes: [node('org.iso.18013.5.1', 'family_name')], intent_to_retain: false },
        { nodes: [node('org.iso.18013.5.1', 'family_name')], intent_to_retain: true },
        {
          nodes: [
            node('org.iso.18013.5.1', 'driving_privileges', 0, 'code'),
            node('org.iso.18013.5.1', 'driving_privileges', 1, 'code'),
          ],
        },
        // An optional field that matched nothing
        { nodes: [] },
      ])
    ).toStrictEqual({
      docType: 'org.iso.18013.5.1.mDL',
      nameSpaces: { 'org.iso.18013.5.1': { family_name: true, driving_privileges: false } },
    })
  })

  test('requests nothing for nodes that do not address a data element', () => {
    expect(
      fieldMatchesToDocumentRequest('org.iso.18013.5.1.mDL', [{ nodes: [node('org.iso.18013.5.1')] }])
    ).toBeUndefined()
    expect(fieldMatchesToDocumentRequest('org.iso.18013.5.1.mDL', [{ nodes: [node(0, 'a')] }])).toBeUndefined()
  })

  test('keeps a __proto__ name space or data element as an own property', () => {
    const documentRequest = fieldMatchesToDocumentRequest('org.iso.18013.5.1.mDL', [
      { nodes: [node('__proto__', 'polluted'), node('ns', '__proto__')] },
    ])

    expect(Object.hasOwn(documentRequest?.nameSpaces ?? {}, '__proto__')).toBe(true)
    expect(Object.hasOwn(documentRequest?.nameSpaces.ns ?? {}, '__proto__')).toBe(true)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})
