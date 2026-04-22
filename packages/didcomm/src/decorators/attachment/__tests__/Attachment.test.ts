import * as didJwsz6Mkf from '../../../../../core/src/crypto/__tests__/__fixtures__/didJwsz6Mkf'
import * as didJwsz6Mkv from '../../../../../core/src/crypto/__tests__/__fixtures__/didJwsz6Mkv'
import { JsonEncoder } from '../../../../../core/src/utils/JsonEncoder'
import { JsonTransformer } from '../../../../../core/src/utils/JsonTransformer'
import { TypedArrayEncoder } from '../../../../../core/src/utils/TypedArrayEncoder'
import { DidCommAttachment, DidCommAttachmentData } from '../DidCommAttachment'

const mockJson = {
  '@id': 'ceffce22-6471-43e4-8945-b604091981c9',
  description: 'A small picture of a cat',
  filename: 'cat.png',
  'mime-type': 'text/plain',
  lastmod_time: new Date(),
  byte_count: 9200,
  data: {
    json: {
      hello: 'world!',
    },
    sha256: '00d7b2068a0b237f14a7979bbfc01ad62f60792e459467bfc4a7d3b9a6dbbe3e',
  },
}

const mockJsonBase64 = {
  '@id': 'ceffce22-6471-43e4-8945-b604091981c9',
  description: 'A small picture of a cat',
  filename: 'cat.png',
  'mime-type': 'text/plain',
  lastmod_time: new Date(),
  byte_count: 9200,
  data: {
    base64: JsonEncoder.toBase64(mockJson.data.json),
  },
}

const id = 'ceffce22-6471-43e4-8945-b604091981c9'
const description = 'A small picture of a cat'
const filename = 'cat.png'
const mimeType = 'text/plain'
const lastmodTime = new Date()
const byteCount = 9200
const data = {
  json: {
    hello: 'world!',
  },
  sha256: '00d7b2068a0b237f14a7979bbfc01ad62f60792e459467bfc4a7d3b9a6dbbe3e',
}
const dataInstance = new DidCommAttachmentData(data)

describe('Decorators | DidCommAttachment', () => {
  it('should correctly transform Json to DidCommAttachment class', () => {
    const decorator = JsonTransformer.fromJSON(mockJson, DidCommAttachment)

    expect(decorator.id).toBe(mockJson['@id'])
    expect(decorator.description).toBe(mockJson.description)
    expect(decorator.filename).toBe(mockJson.filename)
    expect(decorator.lastmodTime).toEqual(mockJson.lastmod_time)
    expect(decorator.byteCount).toEqual(mockJson.byte_count)
    expect(decorator.data).toMatchObject(mockJson.data)
  })

  it('should correctly transform DidCommAttachment class to Json', () => {
    const decorator = new DidCommAttachment({
      id,
      description,
      filename,
      mimeType,
      lastmodTime,
      byteCount,
      data: dataInstance,
    })

    const json = JsonTransformer.toJSON(decorator)
    const transformed = {
      '@id': id,
      description,
      filename,
      'mime-type': mimeType,
      lastmod_time: lastmodTime,
      byte_count: byteCount,
      data,
    }

    expect(json).toMatchObject(transformed)
  })

  it('should return the data correctly if only JSON exists', () => {
    const decorator = JsonTransformer.fromJSON(mockJson, DidCommAttachment)

    const gotData = decorator.getDataAsJson()
    expect(decorator.data.json).toEqual(gotData)
  })

  it('should return the data correctly if only Base64 exists', () => {
    const decorator = JsonTransformer.fromJSON(mockJsonBase64, DidCommAttachment)

    const gotData = decorator.getDataAsJson()
    expect(mockJson.data.json).toEqual(gotData)
  })

  describe('getDataAsUint8Array', () => {
    // Bytes chosen so their base64 encoding exercises both `+` and `/` characters
    // (the ones that differ between the standard and url-safe alphabets) *and*
    // requires `=` padding. This way the url-alphabet / no-padding variants
    // below are genuinely different strings from the canonical base64, not
    // no-ops.
    const payload = new Uint8Array([0xff, 0xe0, 0x3f, 0xff, 0xfe])
    const padded = TypedArrayEncoder.toBase64(payload) // has '+', '/', and '=' padding
    const unpadded = padded.replace(/=+$/, '')
    const urlPadded = padded.replace(/\+/g, '-').replace(/\//g, '_')
    const urlUnpadded = unpadded.replace(/\+/g, '-').replace(/\//g, '_')

    test.each([
      ['standard base64 with padding', padded],
      ['base64url with padding', urlPadded],
      ['base64url without padding', urlUnpadded],
    ])('decodes %s', (_label, encoded) => {
      const attachment = new DidCommAttachment({
        id: 'some-uuid',
        data: new DidCommAttachmentData({ base64: encoded }),
      })
      expect(attachment.getDataAsUint8Array()).toEqual(payload)
    })

    it('throws when no base64 payload is present', () => {
      const attachment = new DidCommAttachment({
        id: 'some-uuid',
        data: new DidCommAttachmentData({ json: { hello: 'world' } }),
      })
      expect(() => attachment.getDataAsUint8Array()).toThrow(/No base64 attachment data found/)
    })

    it('throws a clear error for genuinely invalid input, preserving the strict base64 error as cause', () => {
      const attachment = new DidCommAttachment({
        id: 'some-uuid',
        data: new DidCommAttachmentData({ base64: 'this is definitely not base64 $$$' }),
      })
      expect(() => attachment.getDataAsUint8Array()).toThrow(
        /Could not decode attachment data as base64 or base64url string/
      )
    })

    it('getDataAsJson delegates to getDataAsUint8Array, accepting base64url-without-padding too', () => {
      const json = { hello: 'world' }
      const standardPadded = JsonEncoder.toBase64(json)
      const urlNoPad = standardPadded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      const attachment = new DidCommAttachment({
        id: 'some-uuid',
        data: new DidCommAttachmentData({ base64: urlNoPad }),
      })
      expect(attachment.getDataAsJson()).toEqual(json)
    })
  })

  describe('addJws', () => {
    it('correctly adds the jws to the data', async () => {
      const base64 = JsonEncoder.toBase64(didJwsz6Mkf.DATA_JSON)
      const attachment = new DidCommAttachment({
        id: 'some-uuid',
        data: new DidCommAttachmentData({
          base64,
        }),
      })

      expect(attachment.data.jws).toBeUndefined()

      const { payload, ...detachedJws } = didJwsz6Mkf.JWS_JSON
      attachment.addJws(didJwsz6Mkf.JWS_JSON)
      expect(attachment.data.jws).toEqual(detachedJws)

      attachment.addJws(didJwsz6Mkv.JWS_JSON)
      const { payload: payload2, ...detachedJws2 } = didJwsz6Mkv.JWS_JSON
      expect(attachment.data.jws).toEqual({ signatures: [detachedJws, detachedJws2] })

      expect(JsonTransformer.toJSON(attachment)).toMatchObject({
        '@id': 'some-uuid',
        data: {
          base64: JsonEncoder.toBase64(didJwsz6Mkf.DATA_JSON),
          jws: { signatures: [detachedJws, detachedJws2] },
        },
      })
    })
  })
})
