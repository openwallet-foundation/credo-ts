import { sprindFunkeTestVectorBase64Url } from '../../__tests__/mdoc.fixtures'
import { Mdoc } from '../../Mdoc'
import { MdocRecord } from '../MdocRecord'

describe('MdocRecord', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('decodes the first credential once', () => {
    const fromBase64Url = vi.spyOn(Mdoc, 'fromBase64Url')
    const record = new MdocRecord({
      credentialInstances: [{ issuerSignedBase64Url: sprindFunkeTestVectorBase64Url, kmsKeyId: 'kms-key-1' }],
    })

    expect(record.getTags()).toMatchObject({ docType: 'eu.europa.ec.eudi.pid.1', alg: 'ES256' })
    expect(record.getTags()).toMatchObject({ docType: 'eu.europa.ec.eudi.pid.1', alg: 'ES256' })
    expect(record.firstCredential.deviceKeyId).toBe('kms-key-1')
    expect(fromBase64Url).toHaveBeenCalledTimes(1)
  })

  test('returns a new mdoc on every access', () => {
    const record = new MdocRecord({
      credentialInstances: [{ issuerSignedBase64Url: sprindFunkeTestVectorBase64Url, kmsKeyId: 'kms-key-1' }],
    })

    record.firstCredential.deviceKeyId = 'changed'
    expect(record.firstCredential.deviceKeyId).toBe('kms-key-1')

    record.credentialInstances[0].kmsKeyId = 'kms-key-2'
    expect(record.firstCredential.deviceKeyId).toBe('kms-key-2')
  })

  test('decodes again when the first credential instance changes', () => {
    const fromBase64Url = vi.spyOn(Mdoc, 'fromBase64Url')
    const record = new MdocRecord({
      credentialInstances: [{ issuerSignedBase64Url: sprindFunkeTestVectorBase64Url }],
    })

    record.getTags()
    record.credentialInstances = [{ issuerSignedBase64Url: 'not-an-mdoc' }]

    expect(() => record.getTags()).toThrow()
    expect(fromBase64Url).toHaveBeenCalledTimes(2)
  })
})
