export const SEED = '00000000000000000000000000000My2'

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
  header: { kid: 'did:key:z6MkfD6ccYE22Y9pHKtixeczk92MmMi2oJCP6gmNooZVKB9A' },
  signature: 'fmJcjnkAmdjYw37ztAizmnW7YepR26M0CEc2fpZeGgFcZTrkbrZTDB8hjLwoQjay8UnY1nvrWx-KGPNVbAKJCA',
  protected:
    'eyJhbGciOiJFZERTQSIsImtpZCI6ImRpZDprZXk6ejZNa2ZENmNjWUUyMlk5cEhLdGl4ZWN6azkyTW1NaTJvSkNQNmdtTm9vWlZLQjlBIiwiandrIjp7Imt0eSI6Ik9LUCIsImNydiI6IkVkMjU1MTkiLCJ4IjoiQ3pya2I2NDUzN2tVRUZGQ3lJcjhJODFRYklEaTYyc2ttTjVGbjUtTXNWRSIsImtpZCI6ImRpZDprZXk6ejZNa2ZENmNjWUUyMlk5cEhLdGl4ZWN6azkyTW1NaTJvSkNQNmdtTm9vWlZLQjlBIn19',
}
