/*
 * Test vectors from https://identity.foundation/didcomm-messaging/spec/#appendix
 * */
export const jweEcdhEsX25519Xc20P_1 = {
  ciphertext:
    'KWS7gJU7TbyJlcT9dPkCw-ohNigGaHSukR9MUqFM0THbCTCNkY-g5tahBFyszlKIKXs7qOtqzYyWbPou2q77XlAeYs93IhF6NvaIjyNqYklvj-OtJt9W2Pj5CLOMdsR0C30wchGoXd6wEQZY4ttbzpxYznqPmJ0b9KW6ZP-l4_DSRYe9B-1oSWMNmqMPwluKbtguC-riy356Xbu2C9ShfWmpmjz1HyJWQhZfczuwkWWlE63g26FMskIZZd_jGpEhPFHKUXCFwbuiw_Iy3R0BIzmXXdK_w7PZMMPbaxssl2UeJmLQgCAP8j8TukxV96EKa6rGgULvlo7qibjJqsS5j03bnbxkuxwbfyu3OxwgVzFWlyHbUH6p',
  protected:
    'eyJlcGsiOnsia3R5IjoiT0tQIiwiY3J2IjoiWDI1NTE5IiwieCI6IkpIanNtSVJaQWFCMHpSR193TlhMVjJyUGdnRjAwaGRIYlc1cmo4ZzBJMjQifSwiYXB2IjoiTmNzdUFuclJmUEs2OUEtcmtaMEw5WFdVRzRqTXZOQzNaZzc0QlB6NTNQQSIsInR5cCI6ImFwcGxpY2F0aW9uL2RpZGNvbW0tZW5jcnlwdGVkK2pzb24iLCJlbmMiOiJYQzIwUCIsImFsZyI6IkVDREgtRVMrQTI1NktXIn0',
  recipients: [
    {
      encrypted_key: '3n1olyBR3nY7ZGAprOx-b7wYAKza6cvOYjNwVg3miTnbLwPP_FmE1A',
      header: {
        kid: 'did:example:bob#key-x25519-1',
      },
    },
    {
      encrypted_key: 'j5eSzn3kCrIkhQAWPnEwrFPMW6hG0zF_y37gUvvc5gvlzsuNX4hXrQ',
      header: {
        kid: 'did:example:bob#key-x25519-2',
      },
    },
    {
      encrypted_key: 'TEWlqlq-ao7Lbynf0oZYhxs7ZB39SUWBCK4qjqQqfeItfwmNyDm73A',
      header: {
        kid: 'did:example:bob#key-x25519-3',
      },
    },
  ],
  tag: '6ylC_iAs4JvDQzXeY6MuYQ',
  iv: 'ESpmcyGiZpRjc5urDela21TOOTW8Wqd1',
}

export const jweEcdh1PuA256CbcHs512_1 = {
  ciphertext:
    'MJezmxJ8DzUB01rMjiW6JViSaUhsZBhMvYtezkhmwts1qXWtDB63i4-FHZP6cJSyCI7eU-gqH8lBXO_UVuviWIqnIUrTRLaumanZ4q1dNKAnxNL-dHmb3coOqSvy3ZZn6W17lsVudjw7hUUpMbeMbQ5W8GokK9ZCGaaWnqAzd1ZcuGXDuemWeA8BerQsfQw_IQm-aUKancldedHSGrOjVWgozVL97MH966j3i9CJc3k9jS9xDuE0owoWVZa7SxTmhl1PDetmzLnYIIIt-peJtNYGdpd-FcYxIFycQNRUoFEr77h4GBTLbC-vqbQHJC1vW4O2LEKhnhOAVlGyDYkNbA4DSL-LMwKxenQXRARsKSIMn7z-ZIqTE-VCNj9vbtgR',
  protected:
    'eyJlcGsiOnsia3R5IjoiT0tQIiwiY3J2IjoiWDI1NTE5IiwieCI6IkdGY01vcEpsamY0cExaZmNoNGFfR2hUTV9ZQWY2aU5JMWRXREd5VkNhdzAifSwiYXB2IjoiTmNzdUFuclJmUEs2OUEtcmtaMEw5WFdVRzRqTXZOQzNaZzc0QlB6NTNQQSIsInNraWQiOiJkaWQ6ZXhhbXBsZTphbGljZSNrZXkteDI1NTE5LTEiLCJhcHUiOiJaR2xrT21WNFlXMXdiR1U2WVd4cFkyVWphMlY1TFhneU5UVXhPUzB4IiwidHlwIjoiYXBwbGljYXRpb24vZGlkY29tbS1lbmNyeXB0ZWQranNvbiIsImVuYyI6IkEyNTZDQkMtSFM1MTIiLCJhbGciOiJFQ0RILTFQVStBMjU2S1cifQ',
  recipients: [
    {
      encrypted_key: 'o0FJASHkQKhnFo_rTMHTI9qTm_m2mkJp-wv96mKyT5TP7QjBDuiQ0AMKaPI_RLLB7jpyE-Q80Mwos7CvwbMJDhIEBnk2qHVB',
      header: {
        kid: 'did:example:bob#key-x25519-1',
      },
    },
    {
      encrypted_key: 'rYlafW0XkNd8kaXCqVbtGJ9GhwBC3lZ9AihHK4B6J6V2kT7vjbSYuIpr1IlAjvxYQOw08yqEJNIwrPpB0ouDzKqk98FVN7rK',
      header: {
        kid: 'did:example:bob#key-x25519-2',
      },
    },
    {
      encrypted_key: 'aqfxMY2sV-njsVo-_9Ke9QbOf6hxhGrUVh_m-h_Aq530w3e_4IokChfKWG1tVJvXYv_AffY7vxj0k5aIfKZUxiNmBwC_QsNo',
      header: {
        kid: 'did:example:bob#key-x25519-3',
      },
    },
  ],
  tag: 'uYeo7IsZjN7AnvBjUZE5lNryNENbf6_zew_VC-d4b3U',
  iv: 'o02OXDQ6_-sKz2PX_6oyJg',
}

export const aliceX25519Secret1 = {
  kid: 'did:example:alice#key-x25519-1',
  value: {
    kty: 'OKP',
    crv: 'X25519',
    x: 'avH0O2Y4tqLAq8y9zpianr8ajii5m4F_mICrzNlatXs',
  },
}

export const bobX25519Secret1 = {
  kid: 'did:example:bob#key-x25519-1',
  value: {
    kty: 'OKP',
    d: 'b9NnuOCB0hm7YGNvaE9DMhwH_wjZA1-gWD6dA0JWdL0',
    crv: 'X25519',
    x: 'GDTrI66K0pFfO54tlCSvfjjNapIs44dzpneBgyx0S3E',
  },
}

export const bobX25519Secret2 = {
  kid: 'did:example:bob#key-x25519-2',
  value: {
    kty: 'OKP',
    d: 'p-vteoF1gopny1HXywt76xz_uC83UUmrgszsI-ThBKk',
    crv: 'X25519',
    x: 'UT9S3F5ep16KSNBBShU2wh3qSfqYjlasZimn0mB8_VM',
  },
}

export const bobX25519Secret3 = {
  kid: 'did:example:bob#key-x25519-3',
  value: {
    kty: 'OKP',
    d: 'f9WJeuQXEItkGM8shN4dqFr5fLQLBasHnWZ-8dPaSo0',
    crv: 'X25519',
    x: '82k2BTUiywKv49fKLZa-WwDi8RBf0tB0M8bvSAUQ3yY',
  },
}

export const message = {
  id: '1234567890',
  typ: 'application/didcomm-plain+json',
  type: 'http://example.com/protocols/lets_do_lunch/1.0/proposal',
  from: 'did:example:alice',
  to: ['did:example:bob'],
  created_time: 1516269022,
  expires_time: 1516385931,
  body: { messagespecificattribute: 'and its value' },
}
