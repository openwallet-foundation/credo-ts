import type { Response } from 'node-fetch'

import { Headers } from 'node-fetch'

import { ConnectionInvitationMessage } from '../../modules/connections'
import { OutOfBandInvitation } from '../../modules/oob'
import { convertToNewInvitation } from '../../modules/oob/helpers'
import { JsonTransformer } from '../JsonTransformer'
import { MessageValidator } from '../MessageValidator'
import { oobInvitationFromShortUrl } from '../parseInvitation'

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

const header = new Headers()

const dummyHeader = new Headers()

header.append('Content-Type', 'application/json')

const mockedResponseOobJson = {
  status: 200,
  ok: true,
  headers: header,
  json: async () => ({
    '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/out-of-band/1.0/invitation',
    '@id': '764af259-8bb4-4546-b91a-924c912d0bb8',
    label: 'Alice',
    handshake_protocols: ['did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/connections/1.0'],
    services: ['did:sov:MvTqVXCEmJ87usL9uQTo7v'],
  }),
} as Response

const mockedResponseOobUrl = {
  status: 200,
  ok: true,
  headers: dummyHeader,
  url: 'https://wonderful-rabbit-5.tun2.indiciotech.io?oob=eyJAdHlwZSI6ICJkaWQ6c292OkJ6Q2JzTlloTXJqSGlxWkRUVUFTSGc7c3BlYy9vdXQtb2YtYmFuZC8xLjAvaW52aXRhdGlvbiIsICJAaWQiOiAiNzY0YWYyNTktOGJiNC00NTQ2LWI5MWEtOTI0YzkxMmQwYmI4IiwgImxhYmVsIjogIkFsaWNlIiwgImhhbmRzaGFrZV9wcm90b2NvbHMiOiBbImRpZDpzb3Y6QnpDYnNOWWhNcmpIaXFaRFRVQVNIZztzcGVjL2Nvbm5lY3Rpb25zLzEuMCJdLCAic2VydmljZXMiOiBbImRpZDpzb3Y6TXZUcVZYQ0VtSjg3dXNMOXVRVG83diJdfQ====',
} as Response

mockedResponseOobUrl.headers = dummyHeader

const mockedResponseConnectionJson = {
  status: 200,
  ok: true,
  json: async () => ({
    '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/connections/1.0/invitation',
    '@id': '20971ef0-1029-46db-a25b-af4c465dd16b',
    label: 'test',
    serviceEndpoint: 'http://sour-cow-15.tun1.indiciotech.io',
    recipientKeys: ['5Gvpf9M4j7vWpHyeTyvBKbjYe7qWc72kGo6qZaLHkLrd'],
  }),
} as Response

mockedResponseConnectionJson['headers'] = header

const mockedResponseConnectionUrl = {
  status: 200,
  ok: true,
  url: 'http://sour-cow-15.tun1.indiciotech.io?c_i=eyJAdHlwZSI6ICJkaWQ6c292OkJ6Q2JzTlloTXJqSGlxWkRUVUFTSGc7c3BlYy9jb25uZWN0aW9ucy8xLjAvaW52aXRhdGlvbiIsICJAaWQiOiAiMjA5NzFlZjAtMTAyOS00NmRiLWEyNWItYWY0YzQ2NWRkMTZiIiwgImxhYmVsIjogInRlc3QiLCAic2VydmljZUVuZHBvaW50IjogImh0dHA6Ly9zb3VyLWNvdy0xNS50dW4xLmluZGljaW90ZWNoLmlvIiwgInJlY2lwaWVudEtleXMiOiBbIjVHdnBmOU00ajd2V3BIeWVUeXZCS2JqWWU3cVdjNzJrR282cVphTEhrTHJkIl19',
} as Response

mockedResponseConnectionUrl['headers'] = dummyHeader

let outOfBandInvitationMock: OutOfBandInvitation
let connectionInvitationMock: ConnectionInvitationMessage
let connectionInvitationToNew: OutOfBandInvitation

beforeAll(async () => {
  outOfBandInvitationMock = await JsonTransformer.fromJSON(mockOobInvite, OutOfBandInvitation)
  MessageValidator.validateSync(outOfBandInvitationMock)
  connectionInvitationMock = await JsonTransformer.fromJSON(mockConnectionInvite, ConnectionInvitationMessage)
  MessageValidator.validateSync(connectionInvitationMock)
  connectionInvitationToNew = convertToNewInvitation(connectionInvitationMock)
})

describe('shortened urls resolving to oob invitations', () => {
  test('Resolve a mocked response in the form of a oob invitation as a json object', async () => {
    const short = await oobInvitationFromShortUrl(mockedResponseOobJson)
    expect(short).toEqual(outOfBandInvitationMock)
  })
  test('Resolve a mocked response in the form of a oob invitation encoded in an url', async () => {
    const short = await oobInvitationFromShortUrl(mockedResponseOobUrl)
    expect(short).toEqual(outOfBandInvitationMock)
  })

  test("Resolve a mocked response in the form of a oob invitation as a json object with header 'application/json; charset=utf-8'", async () => {
    const short = await oobInvitationFromShortUrl({
      ...mockedResponseOobJson,
      headers: new Headers({
        'content-type': 'application/json; charset=utf-8',
      }),
    } as Response)
    expect(short).toEqual(outOfBandInvitationMock)
  })
})

describe('shortened urls resolving to connection invitations', () => {
  test('Resolve a mocked response in the form of a connection invitation as a json object', async () => {
    const short = await oobInvitationFromShortUrl(mockedResponseConnectionJson)
    expect(short).toEqual(connectionInvitationToNew)
  })
  test('Resolve a mocked Response in the form of a connection invitation encoded in an url', async () => {
    const short = await oobInvitationFromShortUrl(mockedResponseConnectionUrl)
    expect(short).toEqual(connectionInvitationToNew)
  })
})
