import { DidCommCredentialPreviewAttribute } from '../../models'
import { arePreviewAttributesEqual } from '../previewAttributes'

describe('previewAttributes', () => {
  describe('arePreviewAttributesEqual', () => {
    test('returns true if the attributes are equal', () => {
      const firstAttributes = [
        new DidCommCredentialPreviewAttribute({
          name: 'firstName',
          value: 'firstValue',
          mimeType: 'text/grass',
        }),
        new DidCommCredentialPreviewAttribute({
          name: 'secondName',
          value: 'secondValue',
          mimeType: 'text/grass',
        }),
      ]

      const secondAttribute = [
        new DidCommCredentialPreviewAttribute({
          name: 'firstName',
          value: 'firstValue',
          mimeType: 'text/grass',
        }),
        new DidCommCredentialPreviewAttribute({
          name: 'secondName',
          value: 'secondValue',
          mimeType: 'text/grass',
        }),
      ]

      expect(arePreviewAttributesEqual(firstAttributes, secondAttribute)).toBe(true)
    })

    test('returns false if the attribute name and value are equal but the mime type is different', () => {
      const firstAttributes = [
        new DidCommCredentialPreviewAttribute({
          name: 'secondName',
          value: 'secondValue',
          mimeType: 'text/grass',
        }),
      ]

      const secondAttribute = [
        new DidCommCredentialPreviewAttribute({
          name: 'secondName',
          value: 'secondValue',
          mimeType: 'text/notGrass',
        }),
      ]

      expect(arePreviewAttributesEqual(firstAttributes, secondAttribute)).toBe(false)
    })

    test('returns false if the attribute name and mime type are equal but the value is different', () => {
      const firstAttributes = [
        new DidCommCredentialPreviewAttribute({
          name: 'secondName',
          value: 'secondValue',
          mimeType: 'text/grass',
        }),
      ]

      const secondAttribute = [
        new DidCommCredentialPreviewAttribute({
          name: 'secondName',
          value: 'thirdValue',
          mimeType: 'text/grass',
        }),
      ]

      expect(arePreviewAttributesEqual(firstAttributes, secondAttribute)).toBe(false)
    })

    test('returns false if the value and mime type are equal but the name is different', () => {
      const firstAttributes = [
        new DidCommCredentialPreviewAttribute({
          name: 'secondName',
          value: 'secondValue',
          mimeType: 'text/grass',
        }),
      ]

      const secondAttribute = [
        new DidCommCredentialPreviewAttribute({
          name: 'thirdName',
          value: 'secondValue',
          mimeType: 'text/grass',
        }),
      ]

      expect(arePreviewAttributesEqual(firstAttributes, secondAttribute)).toBe(false)
    })

    test('returns false if the length of the attributes does not match', () => {
      const firstAttributes = [
        new DidCommCredentialPreviewAttribute({
          name: 'secondName',
          value: 'secondValue',
          mimeType: 'text/grass',
        }),
      ]

      const secondAttribute = [
        new DidCommCredentialPreviewAttribute({
          name: 'thirdName',
          value: 'secondValue',
          mimeType: 'text/grass',
        }),
        new DidCommCredentialPreviewAttribute({
          name: 'fourthName',
          value: 'secondValue',
          mimeType: 'text/grass',
        }),
      ]

      expect(arePreviewAttributesEqual(firstAttributes, secondAttribute)).toBe(false)
    })

    test('returns false if duplicate key names exist', () => {
      const firstAttributes = [
        new DidCommCredentialPreviewAttribute({
          name: 'secondName',
          value: 'secondValue',
          mimeType: 'text/grass',
        }),
        new DidCommCredentialPreviewAttribute({
          name: 'secondName',
          value: 'secondValue',
          mimeType: 'text/grass',
        }),
      ]

      const secondAttribute = [
        new DidCommCredentialPreviewAttribute({
          name: 'secondName',
          value: 'secondValue',
          mimeType: 'text/grass',
        }),
      ]

      expect(arePreviewAttributesEqual(firstAttributes, secondAttribute)).toBe(false)
    })
  })
})
