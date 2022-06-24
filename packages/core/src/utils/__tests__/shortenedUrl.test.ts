import type { Response } from 'node-fetch'

// eslint-disable-next-line import/no-extraneous-dependencies
import { Headers } from 'node-fetch'

import { ConnectionInvitationMessage } from '../../modules/connections'
import { OutOfBandInvitation } from '../../modules/oob'
import { convertToNewInvitation } from '../../modules/oob/helpers'
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

const header = new Headers()

header.append('Content-Type', 'application/json')

const dummyHeader = new Headers()

const mockedResponseOobJson = {
  status: 200,
  ok: true,
  json: async () => ({
    '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/out-of-band/1.0/invitation',
    '@id': '764af259-8bb4-4546-b91a-924c912d0bb8',
    label: 'Alice',
    handshake_protocols: ['did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/connections/1.0'],
    services: ['did:sov:MvTqVXCEmJ87usL9uQTo7v'],
  }),
} as Response

mockedResponseOobJson['headers'] = header

const mockedResponseOobUrl = {
  status: 200,
  ok: true,
  url: 'https://wonderful-rabbit-5.tun2.indiciotech.io?oob=eyJAdHlwZSI6ICJkaWQ6c292OkJ6Q2JzTlloTXJqSGlxWkRUVUFTSGc7c3BlYy9vdXQtb2YtYmFuZC8xLjAvaW52aXRhdGlvbiIsICJAaWQiOiAiNzY0YWYyNTktOGJiNC00NTQ2LWI5MWEtOTI0YzkxMmQwYmI4IiwgImxhYmVsIjogIkFsaWNlIiwgImhhbmRzaGFrZV9wcm90b2NvbHMiOiBbImRpZDpzb3Y6QnpDYnNOWWhNcmpIaXFaRFRVQVNIZztzcGVjL2Nvbm5lY3Rpb25zLzEuMCJdLCAic2VydmljZXMiOiBbImRpZDpzb3Y6TXZUcVZYQ0VtSjg3dXNMOXVRVG83diJdfQ====',
} as Response

mockedResponseOobUrl['headers'] = dummyHeader

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
  await MessageValidator.validate(outOfBandInvitationMock)
  connectionInvitationMock = await JsonTransformer.fromJSON(mockConnectionInvite, ConnectionInvitationMessage)
  await MessageValidator.validate(connectionInvitationMock)
  connectionInvitationToNew = convertToNewInvitation(connectionInvitationMock)
})

describe('shortUrlOobJson', () => {
  test('oobToJson', async () => {
    const short = await fromShortUrl(mockedResponseOobJson)
    expect(short).toEqual(outOfBandInvitationMock)
  })
})
describe('shortUrlOobUrl', () => {
  test('oobFromUrl', async () => {
    const short = await fromShortUrl(mockedResponseOobUrl)
    expect(short).toEqual(outOfBandInvitationMock)
  })
})
describe('shortUrlConnectionJson', () => {
  test('connectionInvitationToJson', async () => {
    const short = await fromShortUrl(mockedResponseConnectionJson)
    expect(short).toEqual(connectionInvitationToNew)
  })
})
describe('shortUrlConnectionUrl', () => {
  test('connectionFromUrl', async () => {
    const short = await fromShortUrl(mockedResponseConnectionUrl)
    expect(short).toEqual(connectionInvitationToNew)
  })
})
