import { areCredentialPreviewAttributesEqual } from '../credentialPreviewAttributes'

describe('areCredentialPreviewAttributesEqual', () => {
  test('returns true if the attributes are equal', () => {
    const firstAttributes = [
      {
        name: 'firstName',
        value: 'firstValue',
        mimeType: 'text/grass',
      },
      {
        name: 'secondName',
        value: 'secondValue',
        mimeType: 'text/grass',
      },
    ]

    const secondAttribute = [
      {
        name: 'firstName',
        value: 'firstValue',
        mimeType: 'text/grass',
      },
      {
        name: 'secondName',
        value: 'secondValue',
        mimeType: 'text/grass',
      },
    ]

    expect(areCredentialPreviewAttributesEqual(firstAttributes, secondAttribute)).toBe(true)
  })

  test('returns false if the attribute name and value are equal but the mime type is different', () => {
    const firstAttributes = [
      {
        name: 'secondName',
        value: 'secondValue',
        mimeType: 'text/grass',
      },
    ]

    const secondAttribute = [
      {
        name: 'secondName',
        value: 'secondValue',
        mimeType: 'text/notGrass',
      },
    ]

    expect(areCredentialPreviewAttributesEqual(firstAttributes, secondAttribute)).toBe(false)
  })

  test('returns false if the attribute name and mime type are equal but the value is different', () => {
    const firstAttributes = [
      {
        name: 'secondName',
        value: 'secondValue',
        mimeType: 'text/grass',
      },
    ]

    const secondAttribute = [
      {
        name: 'secondName',
        value: 'thirdValue',
        mimeType: 'text/grass',
      },
    ]

    expect(areCredentialPreviewAttributesEqual(firstAttributes, secondAttribute)).toBe(false)
  })

  test('returns false if the value and mime type are equal but the name is different', () => {
    const firstAttributes = [
      {
        name: 'secondName',
        value: 'secondValue',
        mimeType: 'text/grass',
      },
    ]

    const secondAttribute = [
      {
        name: 'thirdName',
        value: 'secondValue',
        mimeType: 'text/grass',
      },
    ]

    expect(areCredentialPreviewAttributesEqual(firstAttributes, secondAttribute)).toBe(false)
  })

  test('returns false if the length of the attributes does not match', () => {
    const firstAttributes = [
      {
        name: 'secondName',
        value: 'secondValue',
        mimeType: 'text/grass',
      },
    ]

    const secondAttribute = [
      {
        name: 'thirdName',
        value: 'secondValue',
        mimeType: 'text/grass',
      },
      {
        name: 'fourthName',
        value: 'secondValue',
        mimeType: 'text/grass',
      },
    ]

    expect(areCredentialPreviewAttributesEqual(firstAttributes, secondAttribute)).toBe(false)
  })

  test('returns false if duplicate key names exist', () => {
    const firstAttributes = [
      {
        name: 'secondName',
        value: 'secondValue',
        mimeType: 'text/grass',
      },
      {
        name: 'secondName',
        value: 'secondValue',
        mimeType: 'text/grass',
      },
    ]

    const secondAttribute = [
      {
        name: 'secondName',
        value: 'secondValue',
        mimeType: 'text/grass',
      },
    ]

    expect(areCredentialPreviewAttributesEqual(firstAttributes, secondAttribute)).toBe(false)
  })
})
