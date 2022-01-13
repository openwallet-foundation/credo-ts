export const SEED = '00000000000000000000000000000My2'
export const VERKEY = 'kqa2HyagzfMAq42H5f9u3UMwnSBPQx2QfrSyXbUPxMn'

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
  protected:
    'eyJhbGciOiJFZERTQSIsImp3ayI6eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6IkN6cmtiNjQ1MzdrVUVGRkN5SXI4STgxUWJJRGk2MnNrbU41Rm41LU1zVkUifX0',
  signature: 'OsDP4FM8792J9JlessA9IXv4YUYjIGcIAnPPrEJmgxYomMwDoH-h2DMAF5YF2VtsHHyhGN_0HryDjWSEAZdYBQ',
}
