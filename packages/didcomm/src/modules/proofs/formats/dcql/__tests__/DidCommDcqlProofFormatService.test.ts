import type { DcqlQueryResult, JsonValue } from '@credo-ts/core'
import { DcqlService } from '@credo-ts/core'
import { getAgentContext } from '../../../../../../../core/tests'
import { DidCommAttachment, DidCommAttachmentData } from '../../../../../decorators/attachment/DidCommAttachment'
import { DidCommProofRole, DidCommProofState } from '../../../models'
import { DidCommProofExchangeRecord } from '../../../repository'
import { DidCommDcqlProofFormatService, withUnsupportedFormatsUnmatched } from '../DidCommDcqlProofFormatService'

const agentContext = getAgentContext()
const dcqlFormatService = new DidCommDcqlProofFormatService()

const pidQuery = { id: 'pid', format: 'dc+sd-jwt', meta: { vct_values: ['https://example.com/pid'] } }
const mdlQuery = { id: 'mdl', format: 'mso_mdoc', meta: { doctype_value: 'org.iso.18013.5.1.mDL' } }

const matched = (id: string) => ({
  success: true,
  credential_query_id: id,
  valid_credentials: [{ record: {} }],
})

const queryResult = (credentialSets?: Array<{ options: string[][]; required: boolean }>): DcqlQueryResult =>
  ({
    credentials: [mdlQuery, pidQuery],
    credential_matches: { mdl: matched('mdl'), pid: matched('pid') },
    credential_sets: credentialSets?.map((set) => ({ ...set, matching_options: set.options })),
    can_be_satisfied: true,
  }) as unknown as DcqlQueryResult

const attachment = (json: unknown) =>
  new DidCommAttachment({
    id: 'dcql',
    mimeType: 'application/json',
    data: new DidCommAttachmentData({ json: json as JsonValue }),
  })

const proofRecord = () =>
  new DidCommProofExchangeRecord({
    state: DidCommProofState.RequestReceived,
    threadId: 'thread',
    protocolVersion: 'v2',
    role: DidCommProofRole.Prover,
  })

const request = (overrides: Record<string, unknown> = {}) => ({
  dcql_query: { credentials: [pidQuery] },
  nonce: 'abc-_.~123',
  audience: 'didcomm:did:example:verifier',
  ...overrides,
})

const processRequest = (json: unknown) =>
  dcqlFormatService.processRequest(agentContext, { attachment: attachment(json), proofRecord: proofRecord() })

describe('DidCommDcqlProofFormatService', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('withUnsupportedFormatsUnmatched', () => {
    test('keeps the supported alternative option of a credential set', () => {
      const result = withUnsupportedFormatsUnmatched(queryResult([{ options: [['mdl'], ['pid']], required: true }]))

      expect(result.credential_matches.mdl).toEqual({ success: false, credential_query_id: 'mdl' })
      expect(result.credential_matches.pid.success).toBe(true)
      expect(result.credential_sets?.[0].matching_options).toEqual([['pid']])
      expect(result.can_be_satisfied).toBe(true)
    })

    test('a required set with only an mso_mdoc option cannot be satisfied', () => {
      const result = withUnsupportedFormatsUnmatched(
        queryResult([
          { options: [['mdl']], required: true },
          { options: [['pid']], required: true },
        ])
      )

      expect(result.credential_sets?.[0].matching_options).toBeUndefined()
      expect(result.credential_sets?.[1].matching_options).toEqual([['pid']])
      expect(result.can_be_satisfied).toBe(false)
    })

    test('an optional set with only an mso_mdoc option is ignored', () => {
      const result = withUnsupportedFormatsUnmatched(
        queryResult([
          { options: [['pid']], required: true },
          { options: [['mdl']], required: false },
        ])
      )

      expect(result.credential_sets?.[1].matching_options).toBeUndefined()
      expect(result.can_be_satisfied).toBe(true)
    })

    test('an mso_mdoc query without credential sets cannot be satisfied', () => {
      const result = withUnsupportedFormatsUnmatched(queryResult())

      expect(result.credential_sets).toBeUndefined()
      expect(result.can_be_satisfied).toBe(false)
    })
  })

  test('getCredentialsForRequest leaves unsupported formats unmatched', async () => {
    vi.spyOn(DcqlService.prototype, 'getCredentialsForRequest').mockResolvedValue(
      queryResult([{ options: [['mdl'], ['pid']], required: true }])
    )

    const result = await dcqlFormatService.getCredentialsForRequest(agentContext, {
      proofRecord: proofRecord(),
      requestAttachment: attachment(request({ dcql_query: { credentials: [mdlQuery, pidQuery] } })),
    })

    expect(result.credential_matches.mdl.success).toBe(false)
    expect(result.credential_sets?.[0].matching_options).toEqual([['pid']])
  })

  describe('request validation', () => {
    test.each([
      ['a nonce with characters that are not URL safe', request({ nonce: 'abc/def' }), "a 'nonce' of URL safe"],
      ['a missing nonce', request({ nonce: undefined }), "a 'nonce' of URL safe"],
      [
        'an audience without the didcomm prefix',
        request({ audience: 'did:example:verifier' }),
        "starts with 'didcomm:'",
      ],
      [
        'an audience that is a DID URL',
        request({ audience: 'didcomm:did:example:verifier#key-1' }),
        'a DID without a path, query or fragment',
      ],
      ['transaction_data', request({ transaction_data: ['abc'] }), "must not have 'transaction_data'"],
      [
        'a query without meta',
        request({ dcql_query: { credentials: [{ id: 'pid', format: 'dc+sd-jwt' }] } }),
        "Credential Query 'pid' must have 'meta'",
      ],
      [
        'a dc+sd-jwt query without vct_values',
        request({ dcql_query: { credentials: [{ id: 'pid', format: 'dc+sd-jwt', meta: {} }] } }),
        "must have 'meta.vct_values'",
      ],
      [
        'a vc+sd-jwt query with vct_values',
        request({
          dcql_query: {
            credentials: [{ id: 'vc', format: 'vc+sd-jwt', meta: { type_values: [['A']], vct_values: ['A'] } }],
          },
        }),
        "no 'meta.vct_values'",
      ],
      [
        'a vc+sd-jwt query with flat type_values',
        request({ dcql_query: { credentials: [{ id: 'vc', format: 'vc+sd-jwt', meta: { type_values: ['A'] } }] } }),
        "must have 'meta.type_values' as an array of string arrays",
      ],
      [
        'a vc+sd-jwt query with type_values that are not strings',
        request({
          dcql_query: { credentials: [{ id: 'vc', format: 'vc+sd-jwt', meta: { type_values: [['A', 1]] } }] },
        }),
        "must have 'meta.type_values' as an array of string arrays",
      ],
    ])('rejects a request with %s', async (_, json, message) => {
      await expect(processRequest(json)).rejects.toThrow(message)
    })

    test.each([
      ['a nonce', { nonce: 'abc' }],
      ['an audience', { audience: 'didcomm:did:example:verifier' }],
    ])('rejects a proposal with %s', async (_, extra) => {
      await expect(
        dcqlFormatService.processProposal(agentContext, {
          attachment: attachment({ dcql_query: { credentials: [pidQuery] }, ...extra }),
          proofRecord: proofRecord(),
        })
      ).rejects.toThrow("must not have a 'nonce' or an 'audience'")
    })

    test('accepts a proposal with a valid query', async () => {
      await expect(
        dcqlFormatService.processProposal(agentContext, {
          attachment: attachment({ dcql_query: { credentials: [pidQuery] } }),
          proofRecord: proofRecord(),
        })
      ).resolves.toBeUndefined()
    })
  })
})
