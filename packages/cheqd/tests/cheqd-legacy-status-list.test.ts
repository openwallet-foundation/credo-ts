import {
  createBitstring,
  createLegacyStatusEntry,
  decodeBitstring,
  encodeBitstring,
  expandLegacyStatusIndices,
  getBitstringStatus,
  getLegacyStatusListUri,
  parseLegacyStatusListData,
  parseLegacyStatusListUri,
  setBitstringStatus,
} from '../src'
import { legacyStatusListFixtures as fixtures } from './legacyStatusListFixtures'

describe('bitstring', () => {
  it('reads and writes entries from the top bit of the first byte', () => {
    const bits = createBitstring(16, 1)
    setBitstringStatus(bits, 0, 1, 1)
    setBitstringStatus(bits, 9, 1, 1)
    expect(Array.from(bits)).toEqual([0b10000000, 0b01000000])
    expect(getBitstringStatus(bits, 0, 1)).toBe(1)
    expect(getBitstringStatus(bits, 1, 1)).toBe(0)
    expect(getBitstringStatus(bits, 9, 1)).toBe(1)
  })

  it('reads the first bit of an entry as its least significant, as Veramo does', () => {
    // bits 0 and 1 are `1 0`: the value 1, not 2
    expect(getBitstringStatus(Uint8Array.of(0b10000000), 0, 2)).toBe(1)
    expect(getBitstringStatus(Uint8Array.of(0b01000000), 0, 2)).toBe(2)
  })

  it('reads and writes entries of 2 bits', () => {
    const bits = createBitstring(8, 2)
    setBitstringStatus(bits, 1, 2, 2)
    setBitstringStatus(bits, 2, 2, 1)
    // entry 1 is bits 2-3, entry 2 is bits 4-5, and the first bit of an entry is its least significant
    expect(Array.from(bits)).toEqual([0b00011000, 0])
    expect(getBitstringStatus(bits, 0, 2)).toBe(0)
    expect(getBitstringStatus(bits, 1, 2)).toBe(2)
    expect(getBitstringStatus(bits, 2, 2)).toBe(1)

    setBitstringStatus(bits, 1, 2, 0)
    expect(getBitstringStatus(bits, 1, 2)).toBe(0)
    expect(getBitstringStatus(bits, 2, 2)).toBe(1)
  })

  it('refuses an index outside the list and a value that does not fit', () => {
    const bits = createBitstring(16, 1)
    expect(() => getBitstringStatus(bits, 16, 1)).toThrow('out of range')
    expect(() => setBitstringStatus(bits, -1, 1, 1)).toThrow('Invalid status list index')
    expect(() => setBitstringStatus(bits, 0, 2, 4)).toThrow('does not fit')
  })

  it('encodes as gzip in base64url, and decodes it with or without the multibase prefix', () => {
    const bits = createBitstring(131072, 1)
    setBitstringStatus(bits, 5, 1, 1)
    const encoded = encodeBitstring(bits)
    // the start of every gzip stream
    expect(encoded.startsWith('H4sI')).toBe(true)
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodeBitstring(encoded)).toEqual(bits)
    expect(decodeBitstring(`u${encoded}`)).toEqual(bits)
  })

  it('refuses something that is not a gzip bitstring', () => {
    expect(() => decodeBitstring('not-a-list')).toThrow('not a gzip compressed bitstring')
  })
})

describe('status list uri', () => {
  const did = 'did:cheqd:testnet:5RpEg66jhhbmASWPXJRWrA'

  it('is the url of the public resolver, with the name encoded', () => {
    const uri = getLegacyStatusListUri({ did, name: 'my list', resourceType: 'StatusList2021Revocation' })
    expect(uri).toBe(
      `https://resolver.cheqd.net/1.0/identifiers/${did}?resourceName=my%20list&resourceType=StatusList2021Revocation`
    )
    expect(parseLegacyStatusListUri(uri)).toEqual({ did, name: 'my list', resourceType: 'StatusList2021Revocation' })
  })

  it('reads the forms Veramo wrote: the name not encoded, the did url itself, and a resource id', () => {
    expect(
      parseLegacyStatusListUri(
        `https://resolver.cheqd.net/1.0/identifiers/${did}?resourceName=testingstatuslist&resourceType=StatusList2021Suspension`
      )
    ).toEqual({ did, name: 'testingstatuslist', resourceType: 'StatusList2021Suspension' })
    expect(parseLegacyStatusListUri(`${did}?resourceName=a&resourceType=b`)).toEqual({
      did,
      name: 'a',
      resourceType: 'b',
    })
    expect(parseLegacyStatusListUri(`${did}/resources/4131a6bf-3596-4a15-9e3b-5a5da570b5f6`)).toEqual({
      did,
      resourceId: '4131a6bf-3596-4a15-9e3b-5a5da570b5f6',
    })
    // an entry id carries the index as a fragment
    expect(parseLegacyStatusListUri(`${did}?resourceName=a&resourceType=b#12`)).toEqual({
      did,
      name: 'a',
      resourceType: 'b',
    })
  })

  it('is null for anything that is not a did:cheqd list', () => {
    expect(parseLegacyStatusListUri('https://example.com/status/1')).toBeNull()
    expect(parseLegacyStatusListUri('did:web:example.com?resourceName=a&resourceType=b')).toBeNull()
    expect(parseLegacyStatusListUri(`${did}`)).toBeNull()
    expect(parseLegacyStatusListUri(`${did}?resourceName=a`)).toBeNull()
  })
})

describe('lists as stored on the testnet by Veramo', () => {
  it('reads a Bitstring list: 2 bits per entry, with the messages of the list', () => {
    const list = parseLegacyStatusListData(fixtures.bitstring.data)
    expect(list.format).toBe('BitstringStatusList')
    expect(list.purposes).toEqual(['revocation', 'suspension', 'message'])
    expect(list.statusSize).toBe(2)
    expect(list.bits.length * 8).toBe(131072 * 2)
    expect(list.statusMessages?.map((message) => message.message)).toEqual(['valid', 'revoked', 'suspended', 'unknown'])

    // entries 1, 2 and 5 to 8 were revoked in this list. Veramo's own validator reads the same values.
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map((index) => getBitstringStatus(list.bits, index, list.statusSize))).toEqual([
      0, 1, 1, 0, 0, 1, 1, 1, 1,
    ])
  })

  it('reads a StatusList2021 revocation list: 1 bit per entry', () => {
    const list = parseLegacyStatusListData(fixtures.statusList2021Revocation.data)
    expect(list.format).toBe('StatusList2021')
    expect(list.purposes).toEqual(['revocation'])
    expect(list.statusSize).toBe(1)
    expect(list.bits.length * 8).toBe(140000)
    // entries 9, 11, 13 and 15 are revoked in this list
    expect(Array.from({ length: 17 }, (_, index) => getBitstringStatus(list.bits, index, 1)).join('')).toBe(
      '00000000010101010'
    )
  })

  it('reads a StatusList2021 suspension list', () => {
    const list = parseLegacyStatusListData(fixtures.statusList2021Suspension.data)
    expect(list.purposes).toEqual(['suspension'])
    const set: number[] = []
    for (let index = 0; index < list.bits.length * 8; index++) {
      if (getBitstringStatus(list.bits, index, 1)) set.push(index)
    }
    expect(set).toEqual([295, 468, 37769, 68870, 72779, 79122, 97540, 111921])
  })

  it('refuses data that is not a status list, and encrypted lists', () => {
    expect(() => parseLegacyStatusListData({ something: 'else' })).toThrow('not a StatusList2021 or Bitstring')
    expect(() =>
      parseLegacyStatusListData({
        StatusList2021: { statusPurpose: 'revocation', encodedList: 'x' },
        metadata: { encrypted: true },
      })
    ).toThrow('Encrypted status lists are not supported')
  })

  it('round trips what it reads: re-encoding gives the same list', () => {
    const list = parseLegacyStatusListData(fixtures.bitstring.data)
    expect(decodeBitstring(encodeBitstring(list.bits))).toEqual(list.bits)
  })
})

describe('createLegacyStatusEntry', () => {
  const statusListCredential =
    'https://resolver.cheqd.net/1.0/identifiers/did:cheqd:testnet:abc?resourceName=l&resourceType=t'

  it('makes a StatusList2021 entry', () => {
    expect(
      createLegacyStatusEntry({ format: 'StatusList2021', statusListCredential, statusPurpose: 'revocation', index: 7 })
    ).toEqual({
      id: `${statusListCredential}#7`,
      type: 'StatusList2021Entry',
      statusPurpose: 'revocation',
      statusListIndex: '7',
      statusListCredential,
    })
  })

  it('makes a Bitstring entry with the size and messages of the list', () => {
    const entry = createLegacyStatusEntry({
      format: 'BitstringStatusList',
      statusListCredential,
      statusPurpose: 'message',
      index: 3,
    })
    expect(entry).toMatchObject({
      type: 'BitstringStatusListEntry',
      statusPurpose: 'message',
      statusListIndex: '3',
      statusSize: 2,
    })
    expect(entry.statusMessage?.map((message) => message.message)).toEqual(['valid', 'revoked', 'suspended', 'unknown'])
  })
})

describe('expandLegacyStatusIndices', () => {
  it('is the single index', () => {
    expect(expandLegacyStatusIndices({ statusListIndex: '42' })).toEqual([42])
    expect(expandLegacyStatusIndices({ statusListIndex: 0 })).toEqual([0])
  })

  it('reads a list of numbers, numeric strings and ranges, each index once and in order', () => {
    expect(expandLegacyStatusIndices({ statusListIndices: [5, '7', '10-12', 6, '11-13'] })).toEqual([
      5, 7, 10, 11, 12, 6, 13,
    ])
  })

  it('reads a range, whichever end is first', () => {
    expect(expandLegacyStatusIndices({ statusListRangeStart: 3, statusListRangeEnd: 5 })).toEqual([3, 4, 5])
    expect(expandLegacyStatusIndices({ statusListIndices: ['9-7'] })).toEqual([7, 8, 9])
  })

  it('combines the single index, the list and the range', () => {
    expect(
      expandLegacyStatusIndices({
        statusListIndex: 1,
        statusListIndices: [2],
        statusListRangeStart: 3,
        statusListRangeEnd: 4,
      })
    ).toEqual([1, 2, 3, 4])
  })

  it('refuses an entry that asks about too many indices, before reading them', () => {
    expect(() => expandLegacyStatusIndices({ statusListRangeStart: 0, statusListRangeEnd: 1_000_000 })).toThrow(
      'more than 10000 indices'
    )
    expect(() => expandLegacyStatusIndices({ statusListIndices: ['0-50000'] })).toThrow('more than 10000 indices')
    expect(() => expandLegacyStatusIndices({ statusListRangeStart: 0, statusListRangeEnd: 5 }, 3)).toThrow(
      'more than 3 indices'
    )
  })

  it('refuses an entry without an index, a half range, and an invalid index', () => {
    expect(() => expandLegacyStatusIndices({})).toThrow('has no index')
    expect(() => expandLegacyStatusIndices({ statusListRangeStart: 3 })).toThrow('both statusListRangeStart')
    expect(() => expandLegacyStatusIndices({ statusListIndex: 'x' })).toThrow('Invalid status list index')
    expect(() => expandLegacyStatusIndices({ statusListIndices: [-1] })).toThrow('Invalid status list index')
  })
})
