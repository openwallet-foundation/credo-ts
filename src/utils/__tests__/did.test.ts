import { isAbbreviatedVerkey, isDid, isDidIdentifier, isFullVerkey, isVerkey } from '../did'

const validAbbreviatedVerkeys = [
  '~PKAYz8Ev4yoQgr2LaMAWFx',
  '~Soy1augaQrQYtNZRRHsikB',
  '~BUF7uxYTxZ6qYdZ4G9e1Gi',
  '~DbZ4gkBqhFRVsT5P7BJqyZ',
  '~4zmNTdG78iYyMAQdEQLrf8',
]

const invalidAbbreviatedVerkeys = [
  '6YnVN5Qdb6mqimTRQcQmSXrHXKdTEdRn5YHZReezUTvt',
  '8jG2Bim1HNSybCTdKBRppP4PCQSSijx1pBnreqsdo8JG',
  'ABUF7uxYTxZ6qYdZ4G9e1Gi',
  '~Db3IgkBqhFRVsT5P7BJqyZ',
  '~4zmNTlG78iYyMAQdEQLrf8',
]

const validFullVerkeys = [
  '6YnVN5Qdb6mqimTRQcQmSXrHXKdTEdRn5YHZReezUTvt',
  '8jG2Bim1HNSybCTdKBRppP4PCQSSijx1pBnreqsdo8JG',
  '9wMLhw9SSxtTUyosrndMbvWY4TtDbVvRnMtzG2NysniP',
  '6m2XT39vivJ7tLSxNPM8siMnhYCZcdMxbkTcJDSzAQTu',
  'CAgL85iEecPNQMmxQ1hgbqczwq7SAerQ8RbWTRtC7SoK',
  'MqXmB7cTsTXqyxDPBbrgu5EPqw61kouK1qjMvnoPa96',
]

const invalidFullVerkeys = [
  '~PKAYz8Ev4yoQgr2LaMAWFx',
  '~Soy1augaQrQYtNZRRHsikB',
  '6YnVN5Qdb6mqimTRQcQmSXrHXKdTEdRn5YHZReezUTvta',
  '6m2XT39vIvJ7tLSxNPM8siMnhYCZcdMxbkTcJDSzAQTu',
  'CAgL85iEecPNQMlxQ1hgbqczwq7SAerQ8RbWTRtC7SoK',
]

const invalidVerkeys = [
  '6YnVN5Qdb6mqimTIQcQmSXrHXKdTEdRn5YHZReezUTvta',
  '6m2XT39vIvJ7tlSxNPM8siMnhYCZcdMxbkTcJDSzAQTu',
  'CAgL85iEecPNQMlxQ1hgbqczwq7SAerQ8RbWTRtC7SoK',
  '6YnVN5Qdb6mqilTRQcQmSXrHXKdTEdRn5YHZReezUTvt',
  '8jG2Bim1HNIybCTdKBRppP4PCQSSijx1pBnreqsdo8JG',
  'ABUF7uxYTxZ6qYdZ4G9e1Gi',
  '~Db3IgkBqhFRVsT5P7BJqyZ',
  '~4zmNTlG78IYyMAQdEQLrf8',
  'randomverkey',
]

const validDids = [
  'did:indy:BBPoJqRKatdcfLEAFL7exC',
  'did:sov:N8NQHLtCKfPmWMgCSdfa7h',
  'did:random:FBSegXg6AsF8J73kx22gjk',
  'did:sov:8u2b8ZH6sHeWfvphyQuHCL',
  'did:ethr:0xb9c5714089478a327f09197987f16f9e5d936e8a',
  'did:btcr:xyv2-xzpq-q9wa-p7t',
]

const invalidDids = [
  '6YnVN5Qdb6mqimTIQcQmSXrHXKdTEdRn5YHZReezUTvta',
  'did:BBPoJqRKatdcfLEAFL7exC',
  'sov:N8NQHLtCKfPmWMgCSdfa7h',
  '8kyt-fzzq-qpqq-ljsc-5l',
  'did:test1:N8NQHLtCKfPmWMgCSdfa7h',
  'deid:ethr:9noxi4nL4SiJAsFcMLp2U4',
]

const validDidIdentifiers = [
  '8kyt-fzzq-qpqq-ljsc-5l',
  'fEMDp21GvaafC5hXLaLHf',
  '9noxi4nL4SiJAsFcMLp2U4',
  'QdAJFDpbVoHYrUpNAMe3An',
  'B9Y3e8PUKrM1ShumWU36xW',
  '0xf3beac30c498d9e26865f34fcaa57dbb935b0d74',
]

const invalidDidIdentifiers = [
  '6YnVN5Qdb6mqimTIQcQmSXrHXKdTEdRn5YHZReezUTvt/a',
  'did:BBPoJqRKatdcfLEAFL7exC',
  'sov:N8NQHLtCKfPmWMgCSdfa7h',
  'did:test1:N8NQHLtCKfPmWMgCSdfa7h',
  'deid:ethr:9noxi4nL4SiJAsFcMLp2U4',
]

describe('Utils | Did', () => {
  describe('isAbbreviatedVerkey()', () => {
    test.each(validAbbreviatedVerkeys)('returns true when valid abbreviated verkey "%s" is passed in', (verkey) => {
      expect(isAbbreviatedVerkey(verkey)).toBe(true)
    })

    test.each(invalidAbbreviatedVerkeys)(
      'returns false when invalid abbreviated verkey "%s" is passed in',
      (verkey) => {
        expect(isAbbreviatedVerkey(verkey)).toBe(false)
      }
    )
  })

  describe('isFullVerkey()', () => {
    test.each(validFullVerkeys)('returns true when valid full verkey "%s" is passed in', (verkey) => {
      expect(isFullVerkey(verkey)).toBe(true)
    })

    test.each(invalidFullVerkeys)('returns false when invalid full verkey "%s" is passed in', (verkey) => {
      expect(isFullVerkey(verkey)).toBe(false)
    })
  })

  describe('isVerkey()', () => {
    const validVerkeys = [...validAbbreviatedVerkeys, ...validFullVerkeys]

    test.each(validVerkeys)('returns true when valid verkey "%s" is passed in', (verkey) => {
      expect(isVerkey(verkey)).toBe(true)
    })

    test.each(invalidVerkeys)('returns false when invalid verkey "%s" is passed in', (verkey) => {
      expect(isVerkey(verkey)).toBe(false)
    })
  })

  describe('isDid()', () => {
    test.each(validDids)('returns true when valid did "%s" is passed in', (did) => {
      expect(isDid(did)).toBe(true)
    })

    test.each(invalidDids)('returns false when invalid did "%s" is passed in', (did) => {
      expect(isDid(did)).toBe(false)
    })
  })

  describe('isDidIdentifier()', () => {
    test.each(validDidIdentifiers)('returns true when valid did identifier "%s" is passed in', (didIdentifier) => {
      expect(isDidIdentifier(didIdentifier)).toBe(true)
    })

    test.each(invalidDidIdentifiers)('returns false when invalid did identifier "%s" is passed in', (didIdentifier) => {
      expect(isDidIdentifier(didIdentifier)).toBe(false)
    })
  })
})
