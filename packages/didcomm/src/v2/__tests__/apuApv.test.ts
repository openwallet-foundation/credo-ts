import { TypedArrayEncoder } from '@credo-ts/core'

import { computeApu, computeApv } from '../apuApv'

describe('computeApu', () => {
  it('returns the UTF-8 bytes of the sender key id', () => {
    const skid = 'did:example:alice#key-x25519-1'
    expect(TypedArrayEncoder.toBase64Url(computeApu(skid))).toBe('ZGlkOmV4YW1wbGU6YWxpY2Uja2V5LXgyNTUxOS0x')
  })
})

describe('computeApv', () => {
  it('matches the SICPA TEST_ENCRYPTED_DIDCOMM_MESSAGE_AUTH_X25519 expected value', () => {
    const kids = [
      'did:example:bob#key-x25519-1',
      'did:example:bob#key-x25519-2',
      'did:example:bob#key-x25519-3',
      'did:example:bob#key-x25519-4',
    ]
    expect(TypedArrayEncoder.toBase64Url(computeApv(kids))).toBe('Y1YxwoNwYNG4dJFPJjvm-94ibauqA9HrWKYZhmcoeSg')
  })

  it('produces the same digest regardless of input order', () => {
    const sorted = ['did:example:bob#key-x25519-1', 'did:example:bob#key-x25519-2']
    const unsorted = ['did:example:bob#key-x25519-2', 'did:example:bob#key-x25519-1']
    expect(computeApv(unsorted)).toEqual(computeApv(sorted))
  })

  it('produces different digests for different recipient sets', () => {
    expect(computeApv(['did:example:bob#key-x25519-1'])).not.toEqual(computeApv(['did:example:bob#key-x25519-2']))
  })

  it('does not mutate the caller-provided array', () => {
    const kids = ['did:example:bob#key-x25519-2', 'did:example:bob#key-x25519-1']
    const snapshot = [...kids]
    computeApv(kids)
    expect(kids).toEqual(snapshot)
  })
})
