import { isAbbreviatedVerkey, isDid, isDidIdentifier, isFullVerkey, isVerkey } from './did';

const validAbbreviatedVerkeys = [
  '~PKAYz8Ev4yoQgr2LaMAWFx',
  '~Soy1augaQrQYtNZRRHsikB',
  '~BUF7uxYTxZ6qYdZ4G9e1Gi',
  '~DbZ4gkBqhFRVsT5P7BJqyZ',
  '~4zmNTdG78iYyMAQdEQLrf8',
];

const validFullVerkeys = [
  '6YnVN5Qdb6mqimTRQcQmSXrHXKdTEdRn5YHZReezUTvt',
  '8jG2Bim1HNSybCTdKBRppP4PCQSSijx1pBnreqsdo8JG',
  '9wMLhw9SSxtTUyosrndMbvWY4TtDbVvRnMtzG2NysniP',
  '6m2XT39vivJ7tLSxNPM8siMnhYCZcdMxbkTcJDSzAQTu',
  'CAgL85iEecPNQMmxQ1hgbqczwq7SAerQ8RbWTRtC7SoK',
];

const validDids = [
  'did:indy:BBPoJqRKatdcfLEAFL7exC',
  'did:sov:N8NQHLtCKfPmWMgCSdfa7h',
  'did:random:FBSegXg6AsF8J73kx22gjk',
  'did:sov:8u2b8ZH6sHeWfvphyQuHCL',
  'did:ethr:0xb9c5714089478a327f09197987f16f9e5d936e8a',
  'did:btcr:xyv2-xzpq-q9wa-p7t',
];

const validDidIdentifiers = [
  '8kyt-fzzq-qpqq-ljsc-5l',
  '9noxi4nL4SiJAsFcMLp2U4',
  'QdAJFDpbVoHYrUpNAMe3An',
  'B9Y3e8PUKrM1ShumWU36xW',
  '0xf3beac30c498d9e26865f34fcaa57dbb935b0d74',
];

describe('Utils | Did', () => {
  describe('isAbbreviatedVerkey()', () => {
    it('should return true when passed in verkey is an abbreviated verkey', () => {
      for (const verkey of validAbbreviatedVerkeys) {
        expect(isAbbreviatedVerkey(verkey)).toBe(true);
      }
    });

    it('should return false when passed in verkey is not an abbreviated verkey', () => {
      const invalidAbbreviatedVerksy = [
        '6YnVN5Qdb6mqimTRQcQmSXrHXKdTEdRn5YHZReezUTvt',
        '8jG2Bim1HNSybCTdKBRppP4PCQSSijx1pBnreqsdo8JG',
        'ABUF7uxYTxZ6qYdZ4G9e1Gi',
        '~Db3IgkBqhFRVsT5P7BJqyZ',
        '~4zmNTlG78iYyMAQdEQLrf8',
      ];

      for (const verkey of invalidAbbreviatedVerksy) {
        expect(isAbbreviatedVerkey(verkey)).toBe(false);
      }
    });
  });

  describe('isFullVerkey()', () => {
    it('should return true when passed in verkey is a full verkey', () => {
      for (const verkey of validFullVerkeys) {
        expect(isFullVerkey(verkey)).toBe(true);
      }
    });

    it('should return false when passed in verkey is not a full verkey', () => {
      const invalidFullVerkeys = [
        '~PKAYz8Ev4yoQgr2LaMAWFx',
        '~Soy1augaQrQYtNZRRHsikB',
        '6YnVN5Qdb6mqimTRQcQmSXrHXKdTEdRn5YHZReezUTvta',
        '6m2XT39vIvJ7tLSxNPM8siMnhYCZcdMxbkTcJDSzAQTu',
        'CAgL85iEecPNQMlxQ1hgbqczwq7SAerQ8RbWTRtC7SoK',
      ];

      for (const verkey of invalidFullVerkeys) {
        expect(isFullVerkey(verkey)).toBe(false);
      }
    });
  });

  describe('isVerkey()', () => {
    it('should return true when passed in verkey is a valid verkey', () => {
      const validVerkeys = [...validAbbreviatedVerkeys, ...validFullVerkeys];

      for (const verkey of validVerkeys) {
        expect(isVerkey(verkey)).toBe(true);
      }
    });

    it('should return false when passed in verkey is not a valid verkey', () => {
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
      ];

      for (const verkey of invalidVerkeys) {
        expect(isVerkey(verkey)).toBe(false);
      }
    });
  });

  describe('isDid()', () => {
    it('should return true when passed in did is a valid did', () => {
      for (const did of validDids) {
        expect(isDid(did)).toBe(true);
      }
    });

    it('should return false when passed in did is not a valid did', () => {
      const invalidDids = [
        '6YnVN5Qdb6mqimTIQcQmSXrHXKdTEdRn5YHZReezUTvta',
        'did:BBPoJqRKatdcfLEAFL7exC',
        'sov:N8NQHLtCKfPmWMgCSdfa7h',
        '8kyt-fzzq-qpqq-ljsc-5l',
        'did:test1:N8NQHLtCKfPmWMgCSdfa7h',
        'deid:ethr:9noxi4nL4SiJAsFcMLp2U4',
      ];

      for (const did of invalidDids) {
        expect(isDid(did)).toBe(false);
      }
    });
  });

  describe('isDidIdentifier()', () => {
    it('should return true when passed in did identifier is a valid did identifier', () => {
      for (const didIdentifier of validDidIdentifiers) {
        expect(isDidIdentifier(didIdentifier)).toBe(true);
      }
    });

    it('should return false when passed in verkey is not a valid did identifier', () => {
      const invalidDidIdentifiers = [
        '6YnVN5Qdb6mqimTIQcQmSXrHXKdTEdRn5YHZReezUTvta',
        'did:BBPoJqRKatdcfLEAFL7exC',
        'sov:N8NQHLtCKfPmWMgCSdfa7h',
        'did:test1:N8NQHLtCKfPmWMgCSdfa7h',
        'deid:ethr:9noxi4nL4SiJAsFcMLp2U4',
      ];

      for (const didIdentifier of invalidDidIdentifiers) {
        expect(isVerkey(didIdentifier)).toBe(false);
      }
    });
  });
});
