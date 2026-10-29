import { getAgentOptions } from '../../../../tests'
import { Agent } from '../../../agent/Agent'
import { PublicJwk } from '../../kms'
import { DateOnly, Mdoc, MdocRecord, type MdocSessionTranscriptOptions } from '../../mdoc'
import { mdocIssuerP256Certificate, mdocIssuerP256PrivateJwk } from '../../mdoc/__tests__/mdoc.fixtures'
import { X509Certificate } from '../../x509'
import { DcqlService } from '../DcqlService'

/**
 * Proves that DCQL matches the `values` of a claims query against the element values of an mdoc that have a JSON
 * primitive equivalent: a full-date and a tdate as their string, and numbers, booleans and strings as they are. A
 * byte string has none, so it can be asked for, but no value matches it. The values inside a data element are kept
 * as they are, as a claims query can't address them.
 *
 * The holder and the verifier compare the same values, and both get the element values of the mdoc in the output.
 */

const agent = new Agent(getAgentOptions('dcql-mdoc-claim-values'))

type DcqlQuery = Parameters<DcqlService['getCredentialsForRequest']>[1]

const docType = 'org.iso.18013.5.1.mDL'
const nameSpace = 'org.iso.18013.5.1'

const elements = {
  birth_date: new DateOnly('2007-03-25'),
  issue_time: new Date('2023-10-24T12:00:00Z'),
  portrait: new Uint8Array([1, 2, 3]),
  age_over_18: true,
  age_in_years: 18,
  issuing_country: 'NL',
  // A map an issuer crafted with a `__proto__` key, and keys that become the same name as a string
  crafted: new Map<unknown, unknown>([
    ['__proto__', new Map([['polluted', true]])],
    [1, 'number key'],
    ['1', 'string key'],
  ]),
}

describe('DCQL mdoc claim values', () => {
  let dcqlService: DcqlService

  const mdocSessionTranscript: MdocSessionTranscriptOptions = {
    type: 'openId4VpDraft18',
    clientId: 'https://verifier.example.com',
    responseUri: 'https://verifier.example.com/response',
    verifierGeneratedNonce: 'challenge',
    mdocGeneratedNonce: 'mdoc-nonce',
  }

  beforeAll(async () => {
    await agent.initialize()
    dcqlService = agent.dependencyManager.resolve(DcqlService)

    const holderKey = PublicJwk.fromPublicJwk(
      (await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk
    )
    const issuerKey = await agent.kms.importKey({ privateJwk: mdocIssuerP256PrivateJwk })
    const issuerCertificate = X509Certificate.fromEncodedCertificate(mdocIssuerP256Certificate)
    issuerCertificate.keyId = issuerKey.keyId

    const mdoc = await Mdoc.sign(agent.context, {
      docType,
      validityInfo: {
        signed: new Date('2023-10-24'),
        validFrom: new Date('2023-10-24'),
        validUntil: new Date('2050-10-24'),
      },
      holderKey,
      issuerCertificate,
      namespaces: { [nameSpace]: elements },
    })
    await agent.mdoc.store({
      record: new MdocRecord({
        credentialInstances: [{ issuerSignedBase64Url: mdoc.base64Url, kmsKeyId: holderKey.keyId }],
      }),
    })
  })

  afterAll(async () => {
    await agent.shutdown()
  })

  const getQuery = (claims: Array<{ name: string; values?: Array<string | number | boolean> }>) =>
    ({
      credentials: [
        {
          id: 'mdl',
          format: 'mso_mdoc',
          meta: { doctype_value: docType },
          claims: claims.map(({ name, values }) => ({ path: [nameSpace, name], values, intent_to_retain: false })),
        },
      ],
    }) as unknown as DcqlQuery

  test.each([
    { name: 'birth_date', values: ['2007-03-25'] },
    { name: 'issue_time', values: ['2023-10-24T12:00:00Z'] },
    { name: 'age_over_18', values: [true] },
    { name: 'age_in_years', values: [18] },
    { name: 'issuing_country', values: ['DE', 'NL'] },
    { name: 'portrait', values: undefined },
    { name: 'crafted', values: undefined },
  ])('matches $name with values $values, and the verifier finds the presentation matches', async (claim) => {
    const dcqlQuery = getQuery([claim])

    const queryResult = await dcqlService.getCredentialsForRequest(agent.context, dcqlQuery)
    expect(queryResult.can_be_satisfied).toBe(true)

    // The output holds the element value of the mdoc, not the value DCQL compared
    const expectedOutput = { [nameSpace]: { [claim.name]: elements[claim.name as keyof typeof elements] } }
    const match = queryResult.credential_matches.mdl
    if (!match.success) throw new Error('Expected the credential query to match')
    expect(match.valid_credentials[0].claims.valid_claim_sets[0].output).toStrictEqual(expectedOutput)

    const { dcqlPresentation } = await dcqlService.createPresentation(agent.context, {
      credentialQueryToCredential: dcqlService.selectCredentialsForRequest(queryResult),
      challenge: 'challenge',
      domain: 'https://verifier.example.com',
      mdocSessionTranscript,
    })

    const presentationResult = await dcqlService.assertValidDcqlPresentation(agent.context, dcqlPresentation, dcqlQuery)
    const presentationMatch = presentationResult.credential_matches.mdl
    if (!presentationMatch.success) throw new Error('Expected the presentation to match')
    expect(presentationMatch.valid_credentials[0].claims.valid_claim_sets[0].output).toStrictEqual(expectedOutput)
  })

  test.each([
    { name: 'birth_date', values: ['2000-01-01'] },
    { name: 'issue_time', values: ['2023-10-24T12:00:00.000Z'] },
    { name: 'age_over_18', values: [false] },
    { name: 'age_in_years', values: ['18'] },
    { name: 'portrait', values: ['AQID'] },
  ])("can't match $name with values $values", async (claim) => {
    const queryResult = await dcqlService.getCredentialsForRequest(agent.context, getQuery([claim]))

    expect(queryResult.can_be_satisfied).toBe(false)
  })
})
