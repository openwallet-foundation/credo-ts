import { JsonTransformer } from '../..'

import { Attachment } from './Attachment'

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

describe('Decorators | Attachment', () => {
  it('should correctly transform Json to Attachment class', () => {
    const decorator = JsonTransformer.fromJSON(mockJson, Attachment)

    expect(decorator.id).toBe(mockJson['@id'])
    expect(decorator.description).toBe(mockJson.description)
    expect(decorator.filename).toBe(mockJson.filename)
    expect(decorator.lastmodTime).toEqual(mockJson.lastmod_time)
    expect(decorator.byteCount).toEqual(mockJson.byte_count)
    expect(decorator.data).toEqual(mockJson.data)
  })

  it('should correctly transform Attachment class to Json', () => {
    const decorator = new Attachment({
      id,
      description,
      filename,
      mimeType,
      lastmodTime,
      byteCount,
      data,
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

    expect(json).toEqual(transformed)
  })
})
