import { serializeRequestForSignature } from '../serializeRequestForSignature'

describe('serializeRequestForSignature', () => {
  it('Should correctly serialize the json for signature input', () => {
    const request = {
      name: 'John Doe',
      age: 43,
      operation: {
        dest: 54,
      },
      phones: ['1234567', '2345678', { rust: 5, age: 1 }, 3],
    }

    const expectedResult = 'age:43|name:John Doe|operation:dest:54|phones:1234567,2345678,age:1|rust:5,3'

    expect(serializeRequestForSignature(request)).toEqual(expectedResult)
  })

  it('Should correctly serialize the json for signature with skipped fields', () => {
    const request = {
      name: 'John Doe',
      age: 43,
      operation: {
        type: '100',
        hash: 'cool hash',
        dest: 54,
      },
      fees: 'fees1',
      signature: 'sign1',
      signatures: 'sign-m',
      phones: ['1234567', '2345678', { rust: 5, age: 1 }, 3],
    }

    const expectedResult =
      'age:43|name:John Doe|operation:dest:54|hash:46aa0c92129b33ee72ee1478d2ae62fa6e756869dedc6c858af3214a6fcf1904|type:100|phones:1234567,2345678,age:1|rust:5,3'

    expect(serializeRequestForSignature(request)).toEqual(expectedResult)
  })

  it('Should correctly serialize the json for signature with raw hash for attrib related types', () => {
    const request = {
      name: 'John Doe',
      age: 43,
      operation: {
        type: '100',
        hash: 'cool hash',
        dest: 54,
        raw: 'string for hash',
      },
      phones: ['1234567', '2345678', { rust: 5, age: 1 }, 3],
    }

    const expectedResult =
      'age:43|name:John Doe|operation:dest:54|hash:46aa0c92129b33ee72ee1478d2ae62fa6e756869dedc6c858af3214a6fcf1904|raw:1dcd0759ce38f57049344a6b3c5fc18144fca1724713090c2ceeffa788c02711|type:100|phones:1234567,2345678,age:1|rust:5,3'

    expect(serializeRequestForSignature(request)).toEqual(expectedResult)
  })

  it('Should correctly serialize the json for signature with raw hash for non-attrib related types', () => {
    const request = {
      name: 'John Doe',
      age: 43,
      operation: {
        type: '101',
        hash: 'cool hash',
        dest: 54,
        raw: 'string for hash',
      },
      phones: ['1234567', '2345678', { rust: 5, age: 1 }, 3],
    }

    const expectedResult =
      'age:43|name:John Doe|operation:dest:54|hash:cool hash|raw:string for hash|type:101|phones:1234567,2345678,age:1|rust:5,3'

    expect(serializeRequestForSignature(request)).toEqual(expectedResult)
  })

  it('Should correctly serialize the json for signature with null signature', () => {
    const request = {
      signature: null,
    }

    const expectedResult = ''

    expect(serializeRequestForSignature(request)).toEqual(expectedResult)
  })
})
