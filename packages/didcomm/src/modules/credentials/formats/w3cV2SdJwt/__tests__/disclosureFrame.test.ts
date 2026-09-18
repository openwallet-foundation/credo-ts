import type { IDisclosureFrame } from '@credo-ts/core'
import { claimPathsFromDisclosureFrame, disclosureFrameFromClaimPaths, resolveClaimPath } from '../disclosureFrame'

// `IDisclosureFrame` types `_sd` as `string[]`, while array item disclosure uses numeric indices, so
// frames containing them need a cast. The implementation casts in the same way.
const frameWithArrayIndices = {
  credentialSubject: { _sd: ['familyName'], result: { _sd: [0, 1] } },
} as unknown as IDisclosureFrame

describe('claimPathsFromDisclosureFrame', () => {
  test('derives paths for nested claims and array indices', () => {
    expect(claimPathsFromDisclosureFrame(frameWithArrayIndices)).toEqual([
      '$.credentialSubject.familyName',
      '$.credentialSubject.result[0]',
      '$.credentialSubject.result[1]',
    ])
  })

  test('ignores decoy entries', () => {
    expect(claimPathsFromDisclosureFrame({ credentialSubject: { _sd: ['name'], _sd_decoy: 2 } })).toEqual([
      '$.credentialSubject.name',
    ])
  })
})

describe('disclosureFrameFromClaimPaths', () => {
  test('returns undefined for no paths', () => {
    expect(disclosureFrameFromClaimPaths(undefined)).toBeUndefined()
    expect(disclosureFrameFromClaimPaths([])).toBeUndefined()
  })

  test('builds a nested frame, keeping array indices numeric', () => {
    expect(disclosureFrameFromClaimPaths(['$.credentialSubject.familyName', '$.credentialSubject.result[0]'])).toEqual({
      credentialSubject: { _sd: ['familyName'], result: { _sd: [0] } },
    })
  })

  test('places a top level claim in the root _sd', () => {
    expect(disclosureFrameFromClaimPaths(['$.type'])).toEqual({ _sd: ['type'] })
  })

  test('round trips with claimPathsFromDisclosureFrame', () => {
    expect(disclosureFrameFromClaimPaths(claimPathsFromDisclosureFrame(frameWithArrayIndices))).toEqual(
      frameWithArrayIndices
    )
  })
})

describe('resolveClaimPath', () => {
  const credential = {
    type: ['VerifiableCredential'],
    credentialSubject: { name: 'John', minimumAge: 0, nickname: '', missing: null, addresses: [{ street: 'Main' }] },
  }

  test('resolves a top level claim', () => {
    expect(resolveClaimPath(credential, '$.type')).toEqual({ found: true, value: ['VerifiableCredential'] })
  })

  test('resolves a nested claim', () => {
    expect(resolveClaimPath(credential, '$.credentialSubject.name')).toEqual({ found: true, value: 'John' })
  })

  test('resolves a claim through an array index', () => {
    expect(resolveClaimPath(credential, '$.credentialSubject.addresses[0].street')).toEqual({
      found: true,
      value: 'Main',
    })
  })

  test('reports falsy and null claims as found', () => {
    expect(resolveClaimPath(credential, '$.credentialSubject.minimumAge')).toEqual({ found: true, value: 0 })
    expect(resolveClaimPath(credential, '$.credentialSubject.nickname')).toEqual({ found: true, value: '' })
    expect(resolveClaimPath(credential, '$.credentialSubject.missing')).toEqual({ found: true, value: null })
  })

  test('reports an absent claim as not found', () => {
    expect(resolveClaimPath(credential, '$.credentialSubject.unknown')).toEqual({ found: false })
    expect(resolveClaimPath(credential, '$.credentialSubject.addresses[1].street')).toEqual({ found: false })
    expect(resolveClaimPath(credential, '$.credentialSubject.name.deeper')).toEqual({ found: false })
  })
})
