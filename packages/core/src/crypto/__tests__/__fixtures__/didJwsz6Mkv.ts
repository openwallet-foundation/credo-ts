export const SEED = '00000000000000000000000000000My1'
export const VERKEY = 'GjZWsBLgZCR18aL468JAT7w9CZRiBnpxUPPgyQxh4voa'

export const DATA_JSON = {
  did: 'did',
  did_doc: {
    '@context': 'https://w3id.org/did/v1',
    service: [
      {
        id: 'did:example:123456789abcdefghi#did-communication',
        type: 'did-communication',
        priority: 0,
        recipientKeys: ['someVerkey'],
        routingKeys: [],
        serviceEndpoint: 'https://agent.example.com/',
      },
    ],
  },
}

export const JWS_JSON = {
  header: {
    kid: 'did:key:z6MkvBpZTRb7tjuUF5AkmhG1JDV928hZbg5KAQJcogvhz9ax',
  },
  protected:
    'eyJhbGciOiJFZERTQSIsImtpZCI6ImRpZDprZXk6ejZNa3ZCcFpUUmI3dGp1VUY1QWttaEcxSkRWOTI4aFpiZzVLQVFKY29ndmh6OWF4IiwiandrIjp7Imt0eSI6Ik9LUCIsImNydiI6IkVkMjU1MTkiLCJ4IjoiNmNaMmJaS21LaVVpRjlNTEtDVjhJSVlJRXNPTEhzSkc1cUJKOVNyUVlCayIsImtpZCI6ImRpZDprZXk6ejZNa3ZCcFpUUmI3dGp1VUY1QWttaEcxSkRWOTI4aFpiZzVLQVFKY29ndmh6OWF4In19',
  signature: 'eA3MPRpSTt5NR8EZkDNb849E9qfrlUm8-StWPA4kMp-qcH7oEc2-1En4fgpz_IWinEbVxCLbmKhWNyaTAuHNAg',
}
