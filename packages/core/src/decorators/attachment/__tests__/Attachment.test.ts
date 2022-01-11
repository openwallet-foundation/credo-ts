import { getAgentConfig } from '../../../../tests/helpers'
import { JsonEncoder } from '../../../utils/JsonEncoder'
import { JsonTransformer } from '../../../utils/JsonTransformer'
import { IndyWallet } from '../../../wallet/IndyWallet'
import { Attachment, AttachmentData } from '../Attachment'
import { AttachmentJws } from '../AttachmentJwsUtil'

import * as didJwsz6Mkf from './__fixtures__/didJwsz6Mkf'
import * as didJwsz6Mkv from './__fixtures__/didJwsz6Mkv'

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
const dataInstance = new AttachmentData(data)

describe('Decorators | Attachment', () => {
  let wallet: IndyWallet

  beforeAll(async () => {
    const config = getAgentConfig('AttachmentDecorator')
    wallet = new IndyWallet(config)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await wallet.initialize(config.walletConfig!)
  })

  afterAll(async () => {
    await wallet.delete()
  })

  it('should correctly transform Json to Attachment class', () => {
    const decorator = JsonTransformer.fromJSON(mockJson, Attachment)

    expect(decorator.id).toBe(mockJson['@id'])
    expect(decorator.description).toBe(mockJson.description)
    expect(decorator.filename).toBe(mockJson.filename)
    expect(decorator.lastmodTime).toEqual(mockJson.lastmod_time)
    expect(decorator.byteCount).toEqual(mockJson.byte_count)
    expect(decorator.data).toMatchObject(mockJson.data)
  })

  it('should correctly transform Attachment class to Json', () => {
    const decorator = new Attachment({
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
    const decorator = JsonTransformer.fromJSON(mockJson, Attachment)

    const gotData = decorator.data.getDataAsJson()
    expect(decorator.data.json).toEqual(gotData)
  })

  it('should return the data correctly if only Base64 exists', () => {
    const decorator = JsonTransformer.fromJSON(mockJsonBase64, Attachment)

    const gotData = decorator.data.getDataAsJson()
    expect(mockJson.data.json).toEqual(gotData)
  })

  describe('jwsPublicKeysBase58', () => {
    it('returns the verkeys of the keys used to signed the jws', async () => {
      const attachment = new Attachment({
        id: 'some-uuid',
        data: new AttachmentData({
          base64: JsonEncoder.toBase64(didJwsz6Mkf.DATA_JSON),
          jws: JsonTransformer.fromJSON({ signatures: [didJwsz6Mkf.JWS_JSON, didJwsz6Mkv.JWS_JSON] }, AttachmentJws),
        }),
      })

      expect(attachment.data.jwsVerkeys).toEqual([
        'kqa2HyagzfMAq42H5f9u3UMwnSBPQx2QfrSyXbUPxMn',
        'GjZWsBLgZCR18aL468JAT7w9CZRiBnpxUPPgyQxh4voa',
      ])
    })
  })

  describe('sign()', () => {
    it('creates a jws of the base64 attachment data', async () => {
      const { verkey } = await wallet.createDid({ seed: didJwsz6Mkf.SEED })

      const attachment = new Attachment({
        id: 'some-uuid',
        data: new AttachmentData({
          base64: JsonEncoder.toBase64(didJwsz6Mkf.DATA_JSON),
        }),
      })

      await attachment.data.sign(wallet, [verkey])

      expect(JsonTransformer.toJSON(attachment)).toMatchObject({
        '@id': 'some-uuid',
        data: {
          base64: JsonEncoder.toBase64(didJwsz6Mkf.DATA_JSON),
          jws: didJwsz6Mkf.JWS_JSON,
        },
      })
    })

    it('throws an error if the attachment does not have base64 data', async () => {
      const { verkey } = await wallet.createDid({ seed: didJwsz6Mkf.SEED })

      const attachment = new Attachment({
        id: 'some-uuid',
        data: new AttachmentData({
          json: didJwsz6Mkf.DATA_JSON,
        }),
      })

      expect(attachment.data.sign(wallet, [verkey])).rejects.toThrowError('Missing base64 data on attachment')
    })
  })

  describe('verify()', () => {
    it('returns true if the jws signature matches the attachment base64 data', async () => {
      const attachment = new Attachment({
        id: 'some-uuid',
        data: new AttachmentData({
          base64: JsonEncoder.toBase64(didJwsz6Mkf.DATA_JSON),
          jws: JsonTransformer.fromJSON(didJwsz6Mkf.JWS_JSON, AttachmentJws),
        }),
      })

      const isValid = await attachment.data.verify(wallet)
      expect(isValid).toBe(true)
    })

    it('returns false if the jws signature does not match the attachment base64 data', async () => {
      const attachment = new Attachment({
        id: 'some-uuid',
        data: new AttachmentData({
          base64: JsonEncoder.toBase64({ ...didJwsz6Mkf.DATA_JSON, did: 'another_did' }),
          jws: JsonTransformer.fromJSON(didJwsz6Mkf.JWS_JSON, AttachmentJws),
        }),
      })

      const isValid = await attachment.data.verify(wallet)
      expect(isValid).toBe(false)
    })

    it('throws an error if the attachment does not have base64 or jws data', async () => {
      const attachmentWithoutBase64 = new Attachment({
        id: 'some-uuid',
        data: new AttachmentData({
          jws: JsonTransformer.fromJSON(didJwsz6Mkf.JWS_JSON, AttachmentJws),
        }),
      })

      const attachmentWithoutJws = new Attachment({
        id: 'some-uuid',
        data: new AttachmentData({
          base64: JsonEncoder.toBase64(didJwsz6Mkf.DATA_JSON),
        }),
      })

      expect(attachmentWithoutBase64.data.verify(wallet)).rejects.toThrowError('Missing JWS and/or base64 parameters')
      expect(attachmentWithoutJws.data.verify(wallet)).rejects.toThrowError('Missing JWS and/or base64 parameters')
    })
  })
})
