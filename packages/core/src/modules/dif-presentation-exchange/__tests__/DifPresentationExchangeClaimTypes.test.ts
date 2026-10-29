import { randomUUID } from 'crypto'
import { getAgentOptions } from '../../../../tests'
import { Agent } from '../../../agent/Agent'
import { JsonTransformer } from '../../../utils'
import { DidKey, DidsModule, KeyDidRegistrar, KeyDidResolver } from '../../dids'
import { PublicJwk } from '../../kms'
import { DateOnly, Mdoc, MdocDeviceResponse, MdocRecord, type MdocSessionTranscriptOptions } from '../../mdoc'
import { mdocIssuerP256Certificate, mdocIssuerP256PrivateJwk } from '../../mdoc/__tests__/mdoc.fixtures'
import { SdJwtVcRecord } from '../../sd-jwt-vc'
import { ClaimFormat, W3cCredential, W3cCredentialRecord } from '../../vc'
import { X509Certificate } from '../../x509'
import { DifPresentationExchangeService } from '../DifPresentationExchangeService'
import {
  type DifPresentationExchangeDefinitionV2,
  DifPresentationExchangeSubmissionLocation,
  type VerifiablePresentation,
} from '../models'

/**
 * Proves that the claims of every credential format Credo presents with DIF Presentation Exchange are matched
 * by their JSON value: strings, numbers, booleans, null, dates, objects and arrays, and for mdocs the CBOR
 * values with a JSON primitive equivalent (full-dates and tdates) as that value. A byte string can be asked for, but
 * no filter matches it.
 *
 * Every format runs the whole flow with all the fields at once (query, select, present, and the verifier
 * checking the presentation), and checks per field that a filter the claim does not satisfy can't be satisfied.
 */

const agent = new Agent(
  getAgentOptions(
    'pex-claim-types',
    {},
    {},
    {
      dids: new DidsModule({ resolvers: [new KeyDidResolver()], registrars: [new KeyDidRegistrar()] }),
    }
  )
)

type Field = NonNullable<
  DifPresentationExchangeDefinitionV2['input_descriptors'][number]['constraints']['fields']
>[number]
type Filter = NonNullable<Field['filter']>

const MDOC_DOCTYPE = 'org.iso.18013.5.1.mDL'
const MDOC_NAMESPACE = 'org.iso.18013.5.1'

// The claims every credential has, as JSON
const claims = {
  string: 'text',
  integer: 42,
  number: 1.5,
  boolean: true,
  null: null,
  date: '2007-03-25',
  date_time: '2023-10-24T12:00:00Z',
  object: { nested: 'value' },
  array: ['a', 'b'],
  objects: [{ code: 'A' }, { code: 'B' }],
}

// Per claim, a filter it satisfies and filters it doesn't
// Without a `satisfied` filter, the claim is only asked for
const filters: Array<{ claim: string; satisfied?: Filter; notSatisfied: Filter[] }> = [
  {
    claim: 'string',
    satisfied: { type: 'string', const: 'text', minLength: 4, maxLength: 4, not: { const: 'other' } },
    notSatisfied: [{ type: 'string', const: 'other' }, { type: 'number' }, { type: 'string', maxLength: 3 }],
  },
  {
    claim: 'integer',
    satisfied: { type: 'integer', minimum: 18, exclusiveMaximum: 100, enum: [41, 42] },
    notSatisfied: [{ type: 'integer', maximum: 18 }, { type: 'string' }, { type: 'number', exclusiveMinimum: 42 }],
  },
  {
    claim: 'number',
    satisfied: { type: 'number', exclusiveMinimum: 1, maximum: 2 },
    notSatisfied: [{ type: 'integer' }, { type: 'number', minimum: 2 }],
  },
  {
    claim: 'boolean',
    satisfied: { type: 'boolean', const: true },
    notSatisfied: [{ type: 'boolean', const: false }, { type: 'string' }],
  },
  {
    claim: 'null',
    satisfied: { type: 'null' },
    notSatisfied: [{ type: 'string' }, { type: 'object' }],
  },
  {
    claim: 'date',
    satisfied: { type: 'string', format: 'date', minimum: '2000-01-01', maximum: '2010-01-01' },
    notSatisfied: [
      { type: 'string', format: 'date', maximum: '2000-01-01' },
      { type: 'string', format: 'date-time' },
    ],
  },
  {
    claim: 'date_time',
    satisfied: { type: 'string', format: 'date-time', exclusiveMinimum: '2023-10-24T11:00:00Z' },
    notSatisfied: [{ type: 'string', format: 'date-time', exclusiveMaximum: '2023-10-24T11:00:00Z' }],
  },
  {
    claim: 'object',
    satisfied: { type: 'object' },
    notSatisfied: [{ type: 'array' }, { type: 'string' }],
  },
  {
    claim: 'array',
    satisfied: { type: 'array', contains: { type: 'string', const: 'b' }, items: { type: 'string' } },
    notSatisfied: [
      { type: 'array', contains: { type: 'string', const: 'c' } },
      { type: 'array', items: { type: 'number' } },
      { type: 'object' },
    ],
  },
]

// For an mdoc, also the CBOR values that have no JSON type. A full-date and a tdate are compared as their string, while
// a byte string has no JSON equivalent, so it can be asked for but no filter matches it.
const mdocFilters: typeof filters = [
  {
    claim: 'full_date',
    satisfied: { type: 'string', format: 'date', const: '2007-03-25', minimum: '2000-01-01' },
    notSatisfied: [{ type: 'string', format: 'date', maximum: '2000-01-01' }, { type: 'object' }],
  },
  {
    claim: 'tdate',
    satisfied: { type: 'string', format: 'date-time', const: '2023-10-24T12:00:00Z', minimum: '2023-10-24T00:00:00Z' },
    notSatisfied: [{ type: 'string', format: 'date-time', maximum: '2023-10-24T00:00:00Z' }, { type: 'object' }],
  },
  {
    claim: 'bytes',
    notSatisfied: [{ type: 'string' }, { type: 'object' }, { type: 'array' }, { const: 'AQID' }],
  },
  {
    claim: 'objects',
    satisfied: { type: 'array', contains: { type: 'object' } },
    notSatisfied: [{ type: 'array', items: { type: 'string' } }],
  },
]

// Paths into arrays, which an mdoc input descriptor can't have
const arrayPathFilters = [
  {
    path: (prefix: string) => `${prefix}.array[1]`,
    satisfied: { type: 'string', const: 'b' },
    notSatisfied: { type: 'string', const: 'a' },
  },
  {
    path: (prefix: string) => `${prefix}.objects[*].code`,
    satisfied: { type: 'string', const: 'B' },
    notSatisfied: { type: 'string', const: 'C' },
  },
] satisfies Array<{ path: (prefix: string) => string; satisfied: Filter; notSatisfied: Filter }>

describe('DIF Presentation Exchange claim types', () => {
  let pexService: DifPresentationExchangeService
  let issuerDid: string
  let issuerDidUrl: string
  let issuerKeyId: string
  let holderDid: string
  let holderKey: PublicJwk
  let mdocIssuerCertificate: X509Certificate

  const challenge = 'challenge'
  const domain = 'https://verifier.example.com'
  const mdocSessionTranscript: MdocSessionTranscriptOptions = {
    type: 'openId4VpDraft18',
    clientId: domain,
    responseUri: `${domain}/response`,
    verifierGeneratedNonce: challenge,
    mdocGeneratedNonce: 'mdoc-nonce',
  }

  beforeAll(async () => {
    await agent.initialize()
    pexService = agent.dependencyManager.resolve(DifPresentationExchangeService)

    const issuerKey = PublicJwk.fromPublicJwk(
      (await agent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })).publicJwk
    )
    issuerKeyId = issuerKey.keyId
    const issuerDidDocument = new DidKey(issuerKey).didDocument
    issuerDid = issuerDidDocument.id
    issuerDidUrl = (issuerDidDocument.verificationMethod ?? [])[0].id
    await agent.dids.import({
      did: issuerDid,
      didDocument: issuerDidDocument,
      keys: [{ didDocumentRelativeKeyId: `#${issuerDidUrl.split('#')[1]}`, kmsKeyId: issuerKeyId }],
    })

    const holderDidResult = await agent.dids.create({
      method: 'key',
      options: { createKey: { type: { kty: 'OKP', crv: 'Ed25519' } } },
    })
    if (!holderDidResult.didState.did) throw new Error('Expected the holder did to be created')
    holderDid = holderDidResult.didState.did

    holderKey = PublicJwk.fromPublicJwk((await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk)

    const mdocIssuerKey = await agent.kms.importKey({ privateJwk: mdocIssuerP256PrivateJwk })
    mdocIssuerCertificate = X509Certificate.fromEncodedCertificate(mdocIssuerP256Certificate)
    mdocIssuerCertificate.keyId = mdocIssuerKey.keyId
  })

  afterAll(async () => {
    await agent.shutdown()
  })

  type Format = {
    name: string
    // Stores a credential with the claims, and returns the fields that select it
    store: () => Promise<{ inputDescriptorId: string; selectFields: Field[] }>
    claimPath: (claim: string) => string
    filters: typeof filters
    arrayPathPrefix?: string
    verify?: (presentation: VerifiablePresentation) => Promise<void>
  }

  const formats: Format[] = [
    {
      name: 'SD-JWT VC',
      store: async () => {
        const vct = `urn:vct:${randomUUID()}`
        const disclosureFrame = { _sd: Object.keys(claims) }
        const { compact } = await agent.sdJwtVc.sign({
          holder: { method: 'jwk', jwk: holderKey },
          issuer: { method: 'did', didUrl: issuerDidUrl },
          payload: { vct, ...claims },
          disclosureFrame,
        })
        await agent.sdJwtVc.store({
          record: new SdJwtVcRecord({
            credentialInstances: [{ compactSdJwtVc: compact, kmsKeyId: holderKey.keyId }],
          }),
        })

        return {
          inputDescriptorId: 'credential',
          selectFields: [{ path: ['$.vct'], filter: { type: 'string', const: vct } }],
        }
      },
      claimPath: (claim) => `$.${claim}`,
      filters,
      arrayPathPrefix: '$',
    },
    {
      name: 'mdoc',
      store: async () => {
        const mdoc = await Mdoc.sign(agent.context, {
          docType: MDOC_DOCTYPE,
          validityInfo: {
            signed: new Date('2023-10-24'),
            validFrom: new Date('2023-10-24'),
            validUntil: new Date('2050-10-24'),
          },
          holderKey,
          issuerCertificate: mdocIssuerCertificate,
          namespaces: {
            [MDOC_NAMESPACE]: {
              ...claims,
              full_date: new DateOnly('2007-03-25'),
              tdate: new Date('2023-10-24T12:00:00Z'),
              bytes: new Uint8Array([1, 2, 3]),
            },
          },
        })
        await agent.mdoc.store({
          record: new MdocRecord({
            credentialInstances: [{ issuerSignedBase64Url: mdoc.base64Url, kmsKeyId: holderKey.keyId }],
          }),
        })

        return { inputDescriptorId: MDOC_DOCTYPE, selectFields: [] }
      },
      claimPath: (claim) => `$['${MDOC_NAMESPACE}']['${claim}']`,
      filters: [...filters, ...mdocFilters],
      verify: async (presentation) => {
        await (presentation as MdocDeviceResponse).verify(agent.context, {
          trustedCertificates: [mdocIssuerP256Certificate],
          sessionTranscriptOptions: mdocSessionTranscript,
        })
      },
    },
    {
      name: 'W3C JWT VC',
      store: async () => {
        const type = `Credential${randomUUID().replaceAll('-', '')}`
        const signed = await agent.w3cCredentials.signCredential({
          format: ClaimFormat.JwtVc,
          alg: 'EdDSA',
          verificationMethod: issuerDidUrl,
          credential: JsonTransformer.fromJSON(
            {
              '@context': ['https://www.w3.org/2018/credentials/v1'],
              type: ['VerifiableCredential', type],
              issuer: issuerDid,
              issuanceDate: '2023-10-24T00:00:00Z',
              credentialSubject: { id: holderDid, ...claims },
            },
            W3cCredential
          ),
        })
        await agent.w3cCredentials.store({ record: W3cCredentialRecord.fromCredential(signed) })

        return {
          inputDescriptorId: 'credential',
          selectFields: [{ path: ['$.vc.type[*]'], filter: { type: 'string', const: type } }],
        }
      },
      claimPath: (claim) => `$.vc.credentialSubject.${claim}`,
      filters,
      arrayPathPrefix: '$.vc.credentialSubject',
      verify: async (presentation) => {
        const result = await agent.w3cCredentials.verifyPresentation({ presentation, challenge, domain } as never)
        expect(result.isValid).toBe(true)
      },
    },
    {
      name: 'W3C JSON-LD VC',
      store: async () => {
        const type = `Credential${randomUUID().replaceAll('-', '')}`
        const signed = await agent.w3cCredentials.signCredential({
          format: ClaimFormat.LdpVc,
          proofType: 'Ed25519Signature2018',
          verificationMethod: issuerDidUrl,
          credential: JsonTransformer.fromJSON(
            {
              '@context': ['https://www.w3.org/2018/credentials/v1', { '@vocab': 'https://example.org/vocab#' }],
              type: ['VerifiableCredential', type],
              issuer: issuerDid,
              issuanceDate: '2023-10-24T00:00:00Z',
              credentialSubject: { id: holderDid, ...claims },
            },
            W3cCredential
          ),
        })
        await agent.w3cCredentials.store({ record: W3cCredentialRecord.fromCredential(signed) })

        return {
          inputDescriptorId: 'credential',
          selectFields: [{ path: ['$.type[*]'], filter: { type: 'string', const: type } }],
        }
      },
      claimPath: (claim) => `$.credentialSubject.${claim}`,
      filters,
      arrayPathPrefix: '$.credentialSubject',
    },
  ]

  const getDefinition = (
    format: Format,
    { inputDescriptorId, selectFields }: { inputDescriptorId: string; selectFields: Field[] },
    fields: Field[]
  ): DifPresentationExchangeDefinitionV2 => ({
    id: randomUUID(),
    input_descriptors: [
      {
        id: inputDescriptorId,
        ...(format.name === 'mdoc' && { format: { mso_mdoc: { alg: ['ES256'] } } }),
        constraints: {
          ...(format.name !== 'W3C JWT VC' && format.name !== 'W3C JSON-LD VC' && { limit_disclosure: 'required' }),
          fields: [...selectFields, ...fields].map((field) => ({ intent_to_retain: false, ...field })),
        },
      },
    ],
  })

  describe.each(formats)('$name', (format) => {
    let selection: Awaited<ReturnType<Format['store']>>

    beforeAll(async () => {
      selection = await format.store()
    })

    const satisfiedFields = (): Field[] => [
      ...format.filters.map(({ claim, satisfied }) => ({
        path: [format.claimPath(claim)],
        ...(satisfied && { filter: satisfied }),
      })),
      ...(format.arrayPathPrefix !== undefined
        ? arrayPathFilters.map(({ path, satisfied }) => ({
            path: [path(format.arrayPathPrefix as string)],
            filter: satisfied,
          }))
        : []),
    ]

    test('presents a credential satisfying a filter on every claim, which the verifier accepts', async () => {
      const definition = getDefinition(format, selection, satisfiedFields())

      const queryResult = await pexService.getCredentialsForRequest(agent.context, definition)
      expect(queryResult.can_be_satisfied).toBe(true)

      const { verifiablePresentations, presentationSubmission } = await pexService.createPresentation(agent.context, {
        credentialsForInputDescriptor: pexService.selectCredentialsForRequest(queryResult),
        presentationDefinition: definition,
        presentationSubmissionLocation: DifPresentationExchangeSubmissionLocation.External,
        challenge,
        domain,
        mdocSessionTranscript,
      })
      await format.verify?.(verifiablePresentations[0])

      expect(() =>
        pexService.validatePresentation(definition, verifiablePresentations, presentationSubmission)
      ).not.toThrow()

      // The verifier evaluates the filters on what was presented, as the holder did
      const [{ claim, notSatisfied }] = format.filters.filter(({ claim }) => claim === 'integer')
      expect(() =>
        pexService.validatePresentation(
          {
            ...definition,
            input_descriptors: [
              getDefinition(format, selection, [{ path: [format.claimPath(claim)], filter: notSatisfied[0] }])
                .input_descriptors[0],
            ],
          },
          verifiablePresentations,
          presentationSubmission
        )
      ).toThrow('Invalid presentation')
    })

    test.each(format.filters.flatMap(({ claim, notSatisfied }) => notSatisfied.map((filter) => ({ claim, filter }))))(
      "can't be satisfied when '$claim' must satisfy $filter",
      async ({ claim, filter }) => {
        const definition = getDefinition(format, selection, [{ path: [format.claimPath(claim)], filter }])

        const queryResult = await pexService.getCredentialsForRequest(agent.context, definition)
        expect(queryResult.can_be_satisfied).toBe(false)
      }
    )

    if (format.arrayPathPrefix !== undefined) {
      test.each(arrayPathFilters)(
        "can't be satisfied with a path into an array and $notSatisfied",
        async ({ path, notSatisfied }) => {
          const definition = getDefinition(format, selection, [
            { path: [path(format.arrayPathPrefix as string)], filter: notSatisfied },
          ])

          const queryResult = await pexService.getCredentialsForRequest(agent.context, definition)
          expect(queryResult.can_be_satisfied).toBe(false)
        }
      )
    }
  })
})
