import { isAbbreviatedVerkey, isFullVerkey, isLegacySelfCertifiedDid } from '../did'

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

describe('Utils | Did', () => {
  describe('isSelfCertifiedDid()', () => {
    test('returns true if the verkey is abbreviated', () => {
      expect(isLegacySelfCertifiedDid('PW8ZHpNupeWXbmpPWog6Ki', '~QQ5jiH1dgXPAnvHdJvazn9')).toBe(true)
    })

    test('returns true if the verkey is not abbreviated and the did is generated from the verkey', () => {
      expect(isLegacySelfCertifiedDid('Y8q4Aq6gRAcmB6jjKk3Z7t', 'HyEoPRNvC7q4jj5joUo8AWYtxbNccbEnTAeuMYkpmNS2')).toBe(
        true
      )
    })

    test('returns false if the verkey is not abbreviated and the did is not generated from the verkey', () => {
      expect(isLegacySelfCertifiedDid('Y8q4Aq6gRAcmB6jjKk3Z7t', 'AcU7DnRqoXGYATD6VqsRq4eHuz55gdM3uzFBEhFd6rGh')).toBe(
        false
      )
    })
  })

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
})
