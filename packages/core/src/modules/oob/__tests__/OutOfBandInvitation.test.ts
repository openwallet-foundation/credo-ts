import type { ValidationError } from 'class-validator'

import { JsonEncoder } from '../../../utils/JsonEncoder'
import { JsonTransformer } from '../../../utils/JsonTransformer'
import { OutOfBandInvitation } from '../messages/OutOfBandInvitation'

describe('OutOfBandInvitation', () => {
  describe('toUrl', () => {
    test('encode the message into the URL containing the base64 encoded invitation as the oob query parameter', async () => {
      const domain = 'https://example.com/ssi'
      const json = {
        '@type': 'https://didcomm.org/out-of-band/1.1/invitation',
        services: ['did:sov:LjgpST2rjsoxYegQDRm7EL'],
        '@id': '69212a3a-d068-4f9d-a2dd-4741bca89af3',
        label: 'Faber College',
        goal_code: 'issue-vc',
        goal: 'To issue a Faber College Graduate credential',
        handshake_protocols: ['https://didcomm.org/didexchange/1.0', 'https://didcomm.org/connections/1.0'],
      }
      const invitation = JsonTransformer.fromJSON(json, OutOfBandInvitation, { validate: false })
      const invitationUrl = invitation.toUrl({
        domain,
      })

      expect(invitationUrl).toBe(`${domain}?oob=${JsonEncoder.toBase64URL(json)}`)
    })
  })

  describe('fromUrl', () => {
    test('decode the URL containing the base64 encoded invitation as the oob parameter into an `OutOfBandInvitation`', async () => {
      const invitationUrl =
        'http://example.com/ssi?oob=eyJAdHlwZSI6Imh0dHBzOi8vZGlkY29tbS5vcmcvb3V0LW9mLWJhbmQvMS4xL2ludml0YXRpb24iLCJAaWQiOiI2OTIxMmEzYS1kMDY4LTRmOWQtYTJkZC00NzQxYmNhODlhZjMiLCJsYWJlbCI6IkZhYmVyIENvbGxlZ2UiLCJnb2FsX2NvZGUiOiJpc3N1ZS12YyIsImdvYWwiOiJUbyBpc3N1ZSBhIEZhYmVyIENvbGxlZ2UgR3JhZHVhdGUgY3JlZGVudGlhbCIsImhhbmRzaGFrZV9wcm90b2NvbHMiOlsiaHR0cHM6Ly9kaWRjb21tLm9yZy9kaWRleGNoYW5nZS8xLjAiLCJodHRwczovL2RpZGNvbW0ub3JnL2Nvbm5lY3Rpb25zLzEuMCJdLCJzZXJ2aWNlcyI6WyJkaWQ6c292OkxqZ3BTVDJyanNveFllZ1FEUm03RUwiXX0K'

      const invitation = await OutOfBandInvitation.fromUrl(invitationUrl)
      const json = JsonTransformer.toJSON(invitation)
      expect(json).toEqual({
        '@type': 'https://didcomm.org/out-of-band/1.1/invitation',
        '@id': '69212a3a-d068-4f9d-a2dd-4741bca89af3',
        label: 'Faber College',
        goal_code: 'issue-vc',
        goal: 'To issue a Faber College Graduate credential',
        handshake_protocols: ['https://didcomm.org/didexchange/1.0', 'https://didcomm.org/connections/1.0'],
        services: ['did:sov:LjgpST2rjsoxYegQDRm7EL'],
      })
    })
  })

  describe('fromJson', () => {
    test('create an instance of `OutOfBandInvitation` from JSON object', async () => {
      const json = {
        '@type': 'https://didcomm.org/out-of-band/1.1/invitation',
        '@id': '69212a3a-d068-4f9d-a2dd-4741bca89af3',
        label: 'Faber College',
        goal_code: 'issue-vc',
        goal: 'To issue a Faber College Graduate credential',
        handshake_protocols: ['https://didcomm.org/didexchange/1.0', 'https://didcomm.org/connections/1.0'],
        services: ['did:sov:LjgpST2rjsoxYegQDRm7EL'],
      }

      const invitation = await OutOfBandInvitation.fromJson(json)

      expect(invitation).toBeDefined()
      expect(invitation).toBeInstanceOf(OutOfBandInvitation)
    })

    test('create an instance of `OutOfBandInvitation` from JSON object with inline service', async () => {
      const json = {
        '@type': 'https://didcomm.org/out-of-band/1.1/invitation',
        '@id': '69212a3a-d068-4f9d-a2dd-4741bca89af3',
        label: 'Faber College',
        goal_code: 'issue-vc',
        goal: 'To issue a Faber College Graduate credential',
        handshake_protocols: ['https://didcomm.org/didexchange/1.0', 'https://didcomm.org/connections/1.0'],
        services: [
          {
            id: '#inline',
            recipientKeys: ['did:key:z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th'],
            routingKeys: ['did:key:z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th'],
            serviceEndpoint: 'https://example.com/ssi',
          },
        ],
      }

      const invitation = await OutOfBandInvitation.fromJson(json)
      expect(invitation).toBeDefined()
      expect(invitation).toBeInstanceOf(OutOfBandInvitation)
    })

    test('throw validation error when services attribute is empty', async () => {
      const json = {
        '@type': 'https://didcomm.org/out-of-band/1.1/invitation',
        '@id': '69212a3a-d068-4f9d-a2dd-4741bca89af3',
        label: 'Faber College',
        goal_code: 'issue-vc',
        goal: 'To issue a Faber College Graduate credential',
        handshake_protocols: ['https://didcomm.org/didexchange/1.0', 'https://didcomm.org/connections/1.0'],
        services: [],
      }

      expect.assertions(1)
      try {
        await OutOfBandInvitation.fromJson(json)
      } catch (error) {
        const [firstError] = error as [ValidationError]
        expect(firstError.constraints).toEqual({ arrayNotEmpty: 'services should not be empty' })
      }
    })

    test('throw validation error when incorrect service object present in services attribute', async () => {
      const json = {
        '@type': 'https://didcomm.org/out-of-band/1.1/invitation',
        '@id': '69212a3a-d068-4f9d-a2dd-4741bca89af3',
        label: 'Faber College',
        goal_code: 'issue-vc',
        goal: 'To issue a Faber College Graduate credential',
        handshake_protocols: ['https://didcomm.org/didexchange/1.0', 'https://didcomm.org/connections/1.0'],
        services: [
          {
            id: '#inline',
            routingKeys: ['did:sov:LjgpST2rjsoxYegQDRm7EL'],
            serviceEndpoint: 'https://example.com/ssi',
          },
        ],
      }

      // expect.assertions(1)
      try {
        await OutOfBandInvitation.fromJson(json)
      } catch (error) {
        const [firstError] = error as [ValidationError]
        expect(firstError).toMatchObject({
          children: [
            {
              children: [
                {
                  constraints: {
                    arrayNotEmpty: 'recipientKeys should not be empty',
                    isDidKeyString: 'each value in recipientKeys must be a did:key string',
                  },
                },
                { constraints: { isDidKeyString: 'each value in routingKeys must be a did:key string' } },
              ],
            },
          ],
        })
      }
    })
  })
})
