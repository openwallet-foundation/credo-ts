import type { Response } from 'node-fetch'

import { ConnectionInvitationMessage } from '../../modules/connections'
import { OutOfBandInvitation } from '../../modules/oob'
import { JsonTransformer } from '../JsonTransformer'
import { MessageValidator } from '../MessageValidator'
import { fromShortUrl } from '../parseInvitation'

const mockOobInvite = {
  '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/out-of-band/1.0/invitation',
  '@id': '764af259-8bb4-4546-b91a-924c912d0bb8',
  label: 'Alice',
  handshake_protocols: ['did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/connections/1.0'],
  services: ['did:sov:MvTqVXCEmJ87usL9uQTo7v'],
}

const mockConnectionInvite = {
  '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/connections/1.0/invitation',
  '@id': '20971ef0-1029-46db-a25b-af4c465dd16b',
  label: 'test',
  serviceEndpoint: 'http://sour-cow-15.tun1.indiciotech.io',
  recipientKeys: ['5Gvpf9M4j7vWpHyeTyvBKbjYe7qWc72kGo6qZaLHkLrd'],
}

const mockedResponseOobJson = {
  status: 200,
  json: async () => ({
    '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/out-of-band/1.0/invitation',
    '@id': '764af259-8bb4-4546-b91a-924c912d0bb8',
    label: 'Alice',
    handshake_protocols: ['did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/connections/1.0'],
    services: ['did:sov:MvTqVXCEmJ87usL9uQTo7v'],
  }),
} as Response

mockedResponseOobJson.headers.append('Content-Type', 'application/json')

const mockedResponseOobUrl = {
  status: 200,
  json: async () => ({
    url: 'https://wonderful-rabbit-5.tun2.indiciotech.io?oob=eyJAdHlwZSI6ICJkaWQ6c292OkJ6Q2JzTlloTXJqSGlxWkRUVUFTSGc7c3BlYy9vdXQtb2YtYmFuZC8xLjAvaW52aXRhdGlvbiIsICJAaWQiOiAiNzY0YWYyNTktOGJiNC00NTQ2LWI5MWEtOTI0YzkxMmQwYmI4IiwgImxhYmVsIjogIkFsaWNlIiwgImhhbmRzaGFrZV9wcm90b2NvbHMiOiBbImRpZDpzb3Y6QnpDYnNOWWhNcmpIaXFaRFRVQVNIZztzcGVjL2Nvbm5lY3Rpb25zLzEuMCJdLCAic2VydmljZXMiOiBbImRpZDpzb3Y6TXZUcVZYQ0VtSjg3dXNMOXVRVG83diJdfQ====',
  }),
} as Response

const mockedResponseConnectionJson = {
  status: 200,
  json: async () => ({
    '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/out-of-band/1.0/invitation',
    '@id': '764af259-8bb4-4546-b91a-924c912d0bb8',
    label: 'Alice',
    handshake_protocols: ['did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/connections/1.0'],
    services: ['did:sov:MvTqVXCEmJ87usL9uQTo7v'],
  }),
} as Response

mockedResponseConnectionJson.headers.append('Content-Type', 'application/json')

const mockedResponseConnectionUrl = {
  status: 200,
  json: async () => ({
    url: 'http://sour-cow-15.tun1.indiciotech.io?c_i=eyJAdHlwZSI6ICJkaWQ6c292OkJ6Q2JzTlloTXJqSGlxWkRUVUFTSGc7c3BlYy9jb25uZWN0aW9ucy8xLjAvaW52aXRhdGlvbiIsICJAaWQiOiAiMjA5NzFlZjAtMTAyOS00NmRiLWEyNWItYWY0YzQ2NWRkMTZiIiwgImxhYmVsIjogInRlc3QiLCAic2VydmljZUVuZHBvaW50IjogImh0dHA6Ly9zb3VyLWNvdy0xNS50dW4xLmluZGljaW90ZWNoLmlvIiwgInJlY2lwaWVudEtleXMiOiBbIjVHdnBmOU00ajd2V3BIeWVUeXZCS2JqWWU3cVdjNzJrR282cVphTEhrTHJkIl19',
  }),
} as Response

let outOfBandInvitationMock: OutOfBandInvitation
let connectionInvitationMock: ConnectionInvitationMessage

beforeAll(async () => {
  outOfBandInvitationMock = await JsonTransformer.fromJSON(mockOobInvite, OutOfBandInvitation)
  await MessageValidator.validate(outOfBandInvitationMock)
  connectionInvitationMock = await JsonTransformer.fromJSON(mockConnectionInvite, ConnectionInvitationMessage)
  await MessageValidator.validate(connectionInvitationMock)
})

describe('shortUrl', () => {
  test('oobToJson', () => {
    expect(fromShortUrl(mockedResponseOobJson)).toEqual(outOfBandInvitationMock)
  })

  test('oobFromUrl', () => {
    expect(fromShortUrl(mockedResponseOobUrl)).toEqual(outOfBandInvitationMock)
  })

  test('connectionInvitationToJson', () => {
    expect(fromShortUrl(mockedResponseConnectionJson)).toEqual(connectionInvitationMock)
  })

  test('connectionFromUrl', () => {
    expect(fromShortUrl(mockedResponseConnectionUrl)).toEqual(connectionInvitationMock)
  })
})
