import { JsonTransformer } from '../../../../../utils'
import { W3cV2Presentation } from '../W3cV2Presentation'

const validPresentation = {
  '@context': ['https://www.w3.org/ns/credentials/v2', 'https://www.w3.org/ns/credentials/examples/v2'],
  type: 'VerifiablePresentation',
  verifiableCredential: [
    {
      '@context': 'https://www.w3.org/ns/credentials/v2',
      id: 'data:application/vc+sd-jwt,eyJhbGciOiJFUzM4NCIsImtpZCI6IlNJM1JITm91aDhvODFOT09OUFFVQUw3RWdaLWtJNl94ajlvUkV2WDF4T3ciLCJ0eXAiOiJ2YytsZCtqc29uK3NkLWp3dCIsImN0eSI6InZjK2xkK2pzb24ifQ.eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvbnMvY3JlZGVudGlhbHMvdjIiLCJodHRwczovL3d3dy53My5vcmcvbnMvY3JlZGVudGlhbHMvZXhhbXBsZXMvdjIiXSwiaXNzdWVyIjoiaHR0cHM6Ly91bml2ZXJzaXR5LmV4YW1wbGUvaXNzdWVycy81NjUwNDkiLCJ2YWxpZEZyb20iOiIyMDEwLTAxLTAxVDE5OjIzOjI0WiIsImNyZWRlbnRpYWxTY2hlbWEiOnsiX3NkIjpbIkU3dU1sSWFyS29iYXJTdEZGRjctZm5qaV9sQVdnM3BGMkV5dVc4dWFYakUiLCJYelRaSVgyNGdDSWxSQVFHclFoNU5FRm1XWkQtZ3Z3dkIybzB5Y0FwNFZzIl19LCJjcmVkZW50aWFsU3ViamVjdCI6eyJkZWdyZWUiOnsibmFtZSI6IkJhY2hlbG9yIG9mIFNjaWVuY2UgYW5kIEFydHMiLCJfc2QiOlsiT3oxUEZIMG0tWk9TdEhwUVZyeGlmVlpKRzhvNmlQQmNnLVZ2SXQwd2plcyJdfSwiX3NkIjpbIkVZQ1daMTZZMHB5X1VNNzRHU3NVYU9zT19mdDExTlVSaFFUTS1TT1lFTVEiXX0sIl9zZCI6WyJqT055NnZUbGNvVlAzM25oSTdERGN3ekVka3d2R3VVRXlLUjdrWEVLd3VVIiwid21BdHpwc0dRbDJveS1PY2JrSEVZcE8xb3BoX3VYcWVWVTRKekF0aFFibyJdLCJfc2RfYWxnIjoic2hhLTI1NiIsImlzcyI6Imh0dHBzOi8vdW5pdmVyc2l0eS5leGFtcGxlL2lzc3VlcnMvNTY1MDQ5IiwiaWF0IjoxNjk3Mjg5OTk2LCJleHAiOjE3Mjg5MTIzOTYsImNuZiI6eyJqd2siOnsia3R5IjoiRUMiLCJjcnYiOiJQLTM4NCIsImFsZyI6IkVTMzg0IiwieCI6InZFdV84WGxZT0ZFU2hTcVRpZ2JSYWduZ0ZGM1p5U0xrclNHekh3azFBT1loanhlazVhV21HY2UwZU05S0pWOEIiLCJ5IjoiRUpNY2czWXBzUTB3M2RLNHlVa25QczE1Z0lsY2Yyay03dzFKLTNlYlBiOERENmQtUkhBeGUwMDkzSWpfdTRCOSJ9fX0.rYzbxb6j1dwop8_s491iArVVJNm6A6C3b742gOm_qYO3zdkyQU4_VxxOSJ8ECcmWj2r5KyiCNC1ojfO4Yms-zBsjt7PoMYpYWBplsqXpiIvnehmM7D0eOLi40uHXki0X~WyJSWTg1YTZNMmEwX3VDWlFTVGZmTFdRIiwgImlkIiwgImh0dHA6Ly91bml2ZXJzaXR5LmV4YW1wbGUvY3JlZGVudGlhbHMvMTg3MiJd~WyJMeG5GYTBXVm8wRUluVy1QdS1fd1dRIiwgInR5cGUiLCBbIlZlcmlmaWFibGVDcmVkZW50aWFsIiwgIkV4YW1wbGVBbHVtbmlDcmVkZW50aWFsIl1d~WyJUQVdrakpCaVpxdC1rVU54X1EweUJBIiwgImlkIiwgImh0dHBzOi8vZXhhbXBsZS5vcmcvZXhhbXBsZXMvZGVncmVlLmpzb24iXQ~WyJTd2xuZFpPZzZEZ1ZERFp5X0RvYVFBIiwgInR5cGUiLCAiSnNvblNjaGVtYSJd~WyJuSnJlU3E1Nzg3RGZMSDJCbU03cXFRIiwgImlkIiwgImRpZDpleGFtcGxlOjEyMyJd~WyIxMjNNd3hNcHRiek02YUk2aW03ME1RIiwgInR5cGUiLCAiQmFjaGVsb3JEZWdyZWUiXQ~',
      type: 'EnvelopedVerifiableCredential',
    },
    {
      '@context': 'https://www.w3.org/ns/credentials/v2',
      id: 'data:application/vc+jwt,eyJraWQiOiJFeEhrQk1XOWZtYmt2VjI2Nm1ScHVQMnNVWV9OX0VXSU4xbGFwVXpPOHJvIiwiYWxnIjoiRVMyNTYifQ .eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvbnMvY3JlZGVudGlhbHMvdjIiLCJodHRwczovL3d3dy53My5vcmcvbnMvY3JlZGVudGlhbHMvZXhhbXBsZXMvdjIiXSwiaWQiOiJodHRwczovL2NvbnRvc28uZXhhbXBsZS9jcmVkZW50aWFscy8yMzg5NDY3MjM5NCIsInR5cGUiOlsiVmVyaWZpYWJsZUNyZWRlbnRpYWwiLCJLOVVuaXRDcmVkZW50aWFsIl0sImlzc3VlciI6eyJpZCI6Imh0dHBzOi8vY29udG9zby5leGFtcGxlIn0sInZhbGlkRnJvbSI6IjIwMTUtMDQtMTZUMDU6MTE6MzIuNDMyWiIsImNyZWRlbnRpYWxTdGF0dXMiOnsiaWQiOiJodHRwczovL2NvbnRvc28uZXhhbXBsZS9jcmVkZW50aWFscy9zdGF0dXMvNCMyNzM3NjIiLCJ0eXBlIjoiU3RhdHVzTGlzdDIwMjFFbnRyeSIsInN0YXR1c1B1cnBvc2UiOiJyZXZvY2F0aW9uIiwic3RhdHVzTGlzdEluZGV4IjoiMjczNzYyIiwic3RhdHVzTGlzdENyZWRlbnRpYWwiOiJodHRwczovL2NvbnRvc28uZXhhbXBsZS9jcmVkZW50aWFscy9zdGF0dXMvNCJ9LCJjcmVkZW50aWFsU3ViamVjdCI6W3siaWQiOiJkaWQ6ZXhhbXBsZToxMzEyMzg3NjQxIiwidHlwZSI6IlBlcnNvbiJ9LHsiaWQiOiJkaWQ6ZXhhbXBsZTo2Mzg4ODIzMSIsInR5cGUiOiJEb2cifV19 .yQi8SfQIk9NoQJfJGJnBjFXe9kXZMMS7GvX1o_BztgC4jMMQoQiLTo2nPH_o6OP1IszRuW_M3ubRZs3WEoiZVw',
      type: 'EnvelopedVerifiableCredential',
    },
  ],
}

describe('W3cV2Presentation', () => {
  test('throws an error when verifiable credential context is missing or not the first entry', () => {
    expect(() => JsonTransformer.fromJSON({ ...validPresentation, '@context': [] }, W3cV2Presentation)).toThrow(
      /context must be an array of strings or objects, where the first item is the verifiable credential context URL./
    )

    expect(() =>
      JsonTransformer.fromJSON(
        {
          ...validPresentation,
          '@context': ['https://www.w3.org/2018/credentials/examples/v1', 'https://www.w3.org/2018/credentials/v1'],
        },
        W3cV2Presentation
      )
    ).toThrow(
      /context must be an array of strings or objects, where the first item is the verifiable credential context URL./
    )

    expect(() =>
      JsonTransformer.fromJSON({ ...validPresentation, '@context': { some: 'property' } }, W3cV2Presentation)
    ).toThrow(
      /context must be an array of strings or objects, where the first item is the verifiable credential context URL./
    )
  })

  test('throws an error when id is present and it is not an uri', () => {
    expect(() =>
      JsonTransformer.fromJSON({ ...validPresentation, id: 'f8c7d9c9-3f9f-4d1d-9c0d-5b3b5d7b8f5c' }, W3cV2Presentation)
    ).toThrow(/id must be an URI/)

    expect(() => JsonTransformer.fromJSON({ ...validPresentation, id: 10 }, W3cV2Presentation)).toThrow(
      /id must be an URI/
    )
  })

  test('throws an error when type is not an array of string or does not include VerifiablePresentation', () => {
    expect(() => JsonTransformer.fromJSON({ ...validPresentation, type: [] }, W3cV2Presentation)).toThrow(
      /type must be "VerifiablePresentation" or an array of strings which includes "VerifiablePresentation"/
    )

    expect(() => JsonTransformer.fromJSON({ ...validPresentation, type: ['AnotherType'] }, W3cV2Presentation)).toThrow(
      /type must be "VerifiablePresentation" or an array of strings which includes "VerifiablePresentation"/
    )

    expect(() => JsonTransformer.fromJSON({ ...validPresentation, type: { some: 'prop' } }, W3cV2Presentation)).toThrow(
      /type must be "VerifiablePresentation" or an array of strings which includes "VerifiablePresentation"/
    )
  })

  test('throws an error when holder is present and it is not an uri', () => {
    expect(() =>
      JsonTransformer.fromJSON(
        { ...validPresentation, holder: 'f8c7d9c9-3f9f-4d1d-9c0d-5b3b5d7b8f5c' },
        W3cV2Presentation
      )
    ).toThrow(/holder must be an URL/)

    expect(() => JsonTransformer.fromJSON({ ...validPresentation, holder: 10 }, W3cV2Presentation)).toThrow(
      /holder must be an URL/
    )
  })

  test('throws an error when verifiableCredential is not a credential or an array of credentials', () => {
    expect(() =>
      JsonTransformer.fromJSON({ ...validPresentation, verifiableCredential: undefined }, W3cV2Presentation)
    ).toThrow(
      /verifiableCredential value must be an instance of, or an array of instances containing W3cV2EnvelopedVerifiableCredential/
    )

    expect(() =>
      JsonTransformer.fromJSON({ ...validPresentation, verifiableCredential: [] }, W3cV2Presentation)
    ).toThrow(
      /verifiableCredential value must be an instance of, or an array of instances containing W3cV2EnvelopedVerifiableCredential/
    )

    expect(() =>
      JsonTransformer.fromJSON({ ...validPresentation, verifiableCredential: [{ random: 'prop' }] }, W3cV2Presentation)
    ).toThrow(/property verifiableCredential\[0\]\.context/)
  })

  it('should transform from JSON to a class instance and back', () => {
    const presentation = JsonTransformer.fromJSON(validPresentation, W3cV2Presentation)
    expect(presentation).toBeInstanceOf(W3cV2Presentation)

    const transformedJson = JsonTransformer.toJSON(presentation)
    expect(transformedJson).toEqual(validPresentation)
  })
})
