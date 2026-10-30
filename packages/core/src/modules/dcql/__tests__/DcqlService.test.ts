import { AgentContext } from '../../../agent'
import type { SdJwtVc, SdJwtVcPayload } from '../../sd-jwt-vc'
import { ClaimFormat, W3cV2EnvelopedVerifiableCredential, W3cV2SdJwtVerifiableCredential } from '../../vc'
import { DcqlError } from '../DcqlError'
import { DcqlService } from '../DcqlService'

const dcqlService = new DcqlService()

describe('DcqlService', () => {
  test('assertValidPresentation', async () => {
    await expect(
      dcqlService.assertValidDcqlPresentation(
        {} as AgentContext,
        {
          something: [
            {
              claimFormat: ClaimFormat.SdJwtDc,
              header: {},
              payload: {
                vct: 'something',
              } as SdJwtVcPayload,
              prettyClaims: {
                vct: 'something',
                age_over_21: true,
              },
              kbJwt: { header: {}, payload: {} },
            } satisfies Partial<SdJwtVc> as unknown as SdJwtVc,
          ],
        },
        {
          credentials: [
            {
              format: 'dc+sd-jwt',
              multiple: false,
              require_cryptographic_holder_binding: true,
              id: 'something',
              claims: [
                {
                  path: ['age_over_18'],
                },
              ],
              meta: {
                vct_values: ['something'],
              },
            },
          ],
        }
      )
    ).rejects.toThrow(
      new DcqlError('Presentations do not satisfy the DCQL query.', {
        additionalMessages: [
          `Presentation at index 0 does not match query credential 'something'. {
  "claims": [
    {
      "age_over_18": [
        "Expected claim 'age_over_18' to be defined"
      ]
    }
  ]
}`,
        ],
      })
    )
  })

  test('assertValidPresentation rejects a presentation without holder binding when the query requires it', async () => {
    const presentation = {
      claimFormat: ClaimFormat.SdJwtDc,
      header: {},
      payload: { vct: 'something' } as SdJwtVcPayload,
      prettyClaims: { vct: 'something', age_over_18: true },
    } satisfies Partial<SdJwtVc> as unknown as SdJwtVc
    const query = (
      requireCryptographicHolderBinding: boolean
    ): Parameters<typeof dcqlService.assertValidDcqlPresentation>[2] => ({
      credentials: [
        {
          format: 'dc+sd-jwt',
          multiple: false,
          require_cryptographic_holder_binding: requireCryptographicHolderBinding,
          id: 'something',
          claims: [{ path: ['age_over_18'] }],
          meta: { vct_values: ['something'] },
        },
      ],
    })

    await expect(
      dcqlService.assertValidDcqlPresentation({} as AgentContext, { something: [presentation] }, query(true))
    ).rejects.toThrow(DcqlError)
    await expect(
      dcqlService.assertValidDcqlPresentation({} as AgentContext, { something: [presentation] }, query(false))
    ).resolves.toBeDefined()
  })

  describe('cryptographic holder binding of a presentation', () => {
    const subjectId = 'did:example:holder'
    const cnf = { kid: 'did:example:holder#key-1' }
    const agentContext = {
      dependencyManager: { resolve: () => ({ getExpandedTypesForCredential: async () => [] }) },
    } as unknown as AgentContext

    const sdJwtVc = (kbJwt?: object) =>
      ({ claimFormat: ClaimFormat.SdJwtDc, header: {}, payload: { vct: 'vct' }, prettyClaims: {}, kbJwt }) as unknown

    const w3cV1Presentation = (claimFormat: ClaimFormat.JwtVp | ClaimFormat.LdpVp, credentialSubjectIds: string[]) => ({
      claimFormat,
      verifiableCredential: [{ credentialSubjectIds, jsonCredential: {}, type: [] }],
    })

    const w3cV2SdJwtPresentation = (options: { cnf?: object; credentialSubjectIds: string[] }) => ({
      claimFormat: ClaimFormat.SdJwtW3cVp,
      resolvedPresentation: {
        verifiableCredential: Object.create(W3cV2EnvelopedVerifiableCredential.prototype, {
          envelopedCredential: {
            value: Object.create(W3cV2SdJwtVerifiableCredential.prototype, {
              sdJwt: { value: { prettyClaims: { cnf: options.cnf } } },
              resolvedCredential: { value: { credentialSubjectIds: options.credentialSubjectIds } },
            }),
          },
          resolvedCredential: { value: { type: ['VerifiableCredential'], toJSON: () => ({}) } },
        }),
      },
    })

    test.each([
      ['dc+sd-jwt with a KB-JWT', 'dc+sd-jwt', sdJwtVc({ header: {}, payload: {} }), true],
      ['dc+sd-jwt without a KB-JWT', 'dc+sd-jwt', sdJwtVc(), false],
      ['jwt_vc_json with a subject id', 'jwt_vc_json', w3cV1Presentation(ClaimFormat.JwtVp, [subjectId]), true],
      ['jwt_vc_json without a subject id', 'jwt_vc_json', w3cV1Presentation(ClaimFormat.JwtVp, []), false],
      ['ldp_vc with a subject id', 'ldp_vc', w3cV1Presentation(ClaimFormat.LdpVp, [subjectId]), true],
      ['ldp_vc without a subject id', 'ldp_vc', w3cV1Presentation(ClaimFormat.LdpVp, []), false],
      [
        'vc+sd-jwt with cnf and a subject id',
        'vc+sd-jwt',
        w3cV2SdJwtPresentation({ cnf, credentialSubjectIds: [subjectId] }),
        true,
      ],
      ['vc+sd-jwt with cnf', 'vc+sd-jwt', w3cV2SdJwtPresentation({ cnf, credentialSubjectIds: [] }), true],
      ['vc+sd-jwt with a subject id', 'vc+sd-jwt', w3cV2SdJwtPresentation({ credentialSubjectIds: [subjectId] }), true],
      [
        'vc+sd-jwt without cnf and subject id',
        'vc+sd-jwt',
        w3cV2SdJwtPresentation({ credentialSubjectIds: [] }),
        false,
      ],
    ])('%s', async (_, format, presentation, cryptographicHolderBinding) => {
      const representation = await dcqlService.getDcqlCredentialRepresentation(
        agentContext,
        presentation as never,
        { id: 'query', format, multiple: false, require_cryptographic_holder_binding: true } as never
      )

      expect(representation.cryptographic_holder_binding).toBe(cryptographicHolderBinding)
    })
  })
})
