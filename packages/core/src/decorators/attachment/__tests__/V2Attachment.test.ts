import { JsonEncoder } from '../../../utils/JsonEncoder'
import { JsonTransformer } from '../../../utils/JsonTransformer'
import { V2Attachment, V2AttachmentData } from '../V2Attachment'

const mockJson = {
  id: 'ceffce22-6471-43e4-8945-b604091981c9',
  description: 'A small picture of a cat',
  filename: 'cat.png',
  mediaType: 'text/plain',
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
  mediaType: 'text/plain',
  data: {
    base64: JsonEncoder.toBase64(mockJson.data.json),
  },
}

const id = 'ceffce22-6471-43e4-8945-b604091981c9'
const description = 'A small picture of a cat'
const filename = 'cat.png'
const mimeType = 'text/plain'
const data = {
  json: {
    hello: 'world!',
  },
  sha256: '00d7b2068a0b237f14a7979bbfc01ad62f60792e459467bfc4a7d3b9a6dbbe3e',
}
const dataInstance = new V2AttachmentData(data)

describe('Decorators | V2Attachment', () => {
  it('should correctly transform Json to V2Attachment class', () => {
    const decorator = JsonTransformer.fromJSON(mockJson, V2Attachment)
    expect(decorator.id).toBe(mockJson.id)
    expect(decorator.description).toBe(mockJson.description)
    expect(decorator.filename).toBe(mockJson.filename)
    expect(decorator.mediaType).toEqual(mockJson.mediaType)
    expect(decorator.data).toMatchObject(mockJson.data)
  })

  it('should correctly transform V2Attachment class to Json', () => {
    const decorator = new V2Attachment({
      id,
      description,
      filename,
      mediaType: mimeType,
      data: dataInstance,
    })

    const json = JsonTransformer.toJSON(decorator)
    const transformed = {
      id,
      description,
      filename,
      media_type: mimeType,
      data: dataInstance,
    }

    expect(json).toMatchObject(transformed)
  })

  it('should return the data correctly if only JSON exists', () => {
    const decorator = JsonTransformer.fromJSON(mockJson, V2Attachment)

    const gotData = decorator.getDataAsJson()
    expect(decorator.data.json).toEqual(gotData)
  })

  it('should return the data correctly if only Base64 exists', () => {
    const decorator = JsonTransformer.fromJSON(mockJsonBase64, V2Attachment)

    const gotData = decorator.getDataAsJson()
    expect(mockJson.data.json).toEqual(gotData)
  })
})
