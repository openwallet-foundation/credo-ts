import { Buffer } from 'buffer'
import { Hashlink } from '../hashlink'

const validData = {
  data: Buffer.from('Hello World!'),
  metaData: {
    urls: ['https://example.org/hw.txt'],
    contentType: 'text/plain',
  },
}

const invalidData = {
  data: Buffer.from('Hello World!'),
  metaData: {
    unknownKey: 'unkownValue',
    contentType: 'image/png',
  },
}

const validHashlink =
  'hl:zQmWvQxTqbG2Z9HPJgG57jjwR154cKhbtJenbyYTWkjgF3e:zCwQVpeF6FPqFyc4pvisK5cpW4kc358NTX6ZbhqfawZTBmXm372zoAj5oLSh'

const invalidHashlink =
  'hl:zQmWvQxTqbqwlkhhhhh9w8e7rJenbyYTWkjgF3e:z51a94WAQfNv1KEcPeoV3V2isZFPFqSzE9ghNFQ8DuQu4hTHtFRug8SDgug14Ff'

const invalidMetadata =
  'hl:zQmWvQxTqbG2Z9HPJgG57jjwR154cKhbtJenbyYTWkjgF3e:zHCwSqQisPgCc2sMSNmHWyQtCKu4kgQVD6Q1Nhxff7uNRqN6r'

describe('Hashlink', () => {
  it('Encodes string to hashlink', () => {
    const hashlink = Hashlink.encode(validData.data, 'sha2-256')
    expect(hashlink).toEqual('hl:zQmWvQxTqbG2Z9HPJgG57jjwR154cKhbtJenbyYTWkjgF3e')
  })

  it('Encodes string and metadata to hashlink', () => {
    const hashlink = Hashlink.encode(validData.data, 'sha2-256', 'base58btc', validData.metaData)
    expect(hashlink).toEqual(validHashlink)
  })

  it('Decodes hashlink', () => {
    const decodedHashlink = Hashlink.decode(validHashlink)
    expect(decodedHashlink).toEqual({
      checksum: 'zQmWvQxTqbG2Z9HPJgG57jjwR154cKhbtJenbyYTWkjgF3e',
      metadata: { contentType: 'text/plain', urls: ['https://example.org/hw.txt'] },
    })
  })

  it('Decodes invalid hashlink', () => {
    expect(() => {
      Hashlink.decode(invalidHashlink)
    }).toThrow(/^invalid character 'l' in /)
  })

  it('Encodes invalid metadata in hashlink', () => {
    expect(() => {
      Hashlink.encode(validData.data, 'sha2-256', 'base58btc', invalidData.metaData)
    }).toThrow(/^Metadata, /)
  })

  it('Decodes invalid metadata in hashlink', () => {
    expect(() => {
      Hashlink.decode(invalidMetadata)
    }).toThrow(/^Metadata, /)
  })
})
