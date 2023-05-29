import { JsonEncoder } from '../../../utils'

export const SEED = '00000000000000000000000000000My1'
export const PUBLIC_KEY_BASE58 = 'GjZWsBLgZCR18aL468JAT7w9CZRiBnpxUPPgyQxh4voa'

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
  protected:
    'eyJhbGciOiJFZERTQSIsImp3ayI6eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6IjZjWjJiWkttS2lVaUY5TUxLQ1Y4SUlZSUVzT0xIc0pHNXFCSjlTclFZQmsifX0',
  signature: 'Js_ibaz24b4GRikbGPeLvRe5FyrcVR2aNVZSs26CLl3DCMJdPqUNRxVDNOD-dBnLs0HyTh6_mX9cG9vWEimtBA',
  header: { kid: 'did:key:z6MkvBpZTRb7tjuUF5AkmhG1JDV928hZbg5KAQJcogvhz9ax' },
  payload: JsonEncoder.toBase64URL(DATA_JSON),
}
