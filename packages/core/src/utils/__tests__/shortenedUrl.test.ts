import type { Response } from 'node-fetch'

import { OutOfBandInvitation } from '../../modules/oob'
import { JsonTransformer } from '../JsonTransformer'
import { MessageValidator } from '../MessageValidator'
import { fromShortUrl } from '../parseInvitation'

const mockInvite = {
  '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/out-of-band/1.0/invitation',
  '@id': '764af259-8bb4-4546-b91a-924c912d0bb8',
  label: 'Alice',
  handshake_protocols: ['did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/connections/1.0'],
  services: ['did:sov:MvTqVXCEmJ87usL9uQTo7v'],
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

mockedResponseOobJson.headers.append('Content-type', 'application/json')

const mockedResponseOobUrl = {
  status: 200,
  json: async () => ({
    url: 'https://wonderful-rabbit-5.tun2.indiciotech.io?oob=eyJAdHlwZSI6ICJkaWQ6c292OkJ6Q2JzTlloTXJqSGlxWkRUVUFTSGc7c3BlYy9vdXQtb2YtYmFuZC8xLjAvaW52aXRhdGlvbiIsICJAaWQiOiAiNzY0YWYyNTktOGJiNC00NTQ2LWI5MWEtOTI0YzkxMmQwYmI4IiwgImxhYmVsIjogIkFsaWNlIiwgImhhbmRzaGFrZV9wcm90b2NvbHMiOiBbImRpZDpzb3Y6QnpDYnNOWWhNcmpIaXFaRFRVQVNIZztzcGVjL2Nvbm5lY3Rpb25zLzEuMCJdLCAic2VydmljZXMiOiBbImRpZDpzb3Y6TXZUcVZYQ0VtSjg3dXNMOXVRVG83diJdfQ====',
  }),
} as Response

let outOfBandInvitationMock: OutOfBandInvitation

beforeAll(async () => {
  outOfBandInvitationMock = await JsonTransformer.fromJSON(mockInvite, OutOfBandInvitation)
  await MessageValidator.validate(outOfBandInvitationMock)
})

describe('shortUrl', () => {
  test('oobToJson', () => {
    expect(fromShortUrl(mockedResponseOobJson)).toEqual(outOfBandInvitationMock)
  })

  test('oobFromUrl', () => {
    expect(fromShortUrl(mockedResponseOobUrl)).toEqual(outOfBandInvitationMock)
  })
})
