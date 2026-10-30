import type { DcqlQuery } from 'dcql'
import { Subject } from 'rxjs'
import { InMemoryStorageService } from '../../../../../../tests/InMemoryStorageService'
import { agentDependencies, getAgentContext } from '../../../../tests'
import { AgentContext } from '../../../agent'
import { InjectionSymbols } from '../../../constants'
import type { NonEmptyArray } from '../../../types'
import { MdocApi } from '../../mdoc'
import { type SdJwtVc, SdJwtVcApi, type SdJwtVcPayload } from '../../sd-jwt-vc'
import {
  ClaimFormat,
  W3cCredentialRecord,
  W3cCredentialRepository,
  W3cV2EnvelopedVerifiableCredential,
  W3cV2SdJwtVerifiableCredential,
} from '../../vc'
import { CredoEs256DidJwkJwtVc } from '../../vc/jwt-vc/__tests__/fixtures/credo-jwt-vc'
import { Ed25519Signature2018Fixtures } from '../../vc/linked-data-proofs/__tests__/fixtures'
import { DcqlError } from '../DcqlError'
import { DcqlService } from '../DcqlService'

const dcqlService = new DcqlService()

describe('DcqlService', () => {
  describe('getCredentialsForRequest', () => {
    test.each([false, true])('retrieves LDP credentials with JWT queries present: %s', async (includeJwt) => {
      const storage = new InMemoryStorageService()
      const agentContext = getAgentContext({
        registerInstances: [
          [InjectionSymbols.StorageService, storage],
          [InjectionSymbols.AgentDependencies, agentDependencies],
          [InjectionSymbols.Stop$, new Subject<boolean>()],
          [MdocApi, { findAllByQuery: vi.fn().mockResolvedValue([]) }],
          [SdJwtVcApi, { findAllByQuery: vi.fn().mockResolvedValue([]) }],
        ],
      })
      const repository = agentContext.resolve(W3cCredentialRepository)
      agentContext.dependencyManager.registerInstance(W3cCredentialRepository, repository)
      const findByQuery = vi.spyOn(repository, 'findByQuery')
      const expandedTypes: NonEmptyArray<string> = [
        'https://www.w3.org/2018/credentials#VerifiableCredential',
        'https://example.org/UniversityDegreeCredential',
      ]
      const ldpRecord = new W3cCredentialRecord({
        credentialInstances: [{ credential: Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED }],
        tags: { expandedTypes },
      })
      const jwtRecord = new W3cCredentialRecord({
        credentialInstances: [{ credential: CredoEs256DidJwkJwtVc }],
      })
      await storage.save(agentContext, ldpRecord)
      await storage.save(agentContext, jwtRecord)

      const credentials: DcqlQuery['credentials'] = [
        {
          id: 'ldp',
          format: 'ldp_vc',
          multiple: false,
          require_cryptographic_holder_binding: true,
          meta: { type_values: [expandedTypes, ['https://example.org/OtherCredential']] },
        },
      ]
      if (includeJwt) {
        credentials.push({
          id: 'jwt',
          format: 'jwt_vc_json',
          multiple: false,
          require_cryptographic_holder_binding: true,
          meta: { type_values: [['OpenBadgeCredential']] },
        })
      }

      const result = await dcqlService.getCredentialsForRequest(agentContext, { credentials })

      expect(findByQuery).toHaveBeenCalledWith(agentContext, {
        claimFormat: ClaimFormat.LdpVc,
        $or: [{ expandedTypes }, { expandedTypes: ['https://example.org/OtherCredential'] }],
      })
      expect(result.credential_matches.ldp).toMatchObject({
        success: true,
        valid_credentials: [{ record: { id: ldpRecord.id } }],
      })
      if (includeJwt) {
        expect(findByQuery).toHaveBeenCalledWith(agentContext, {
          claimFormat: ClaimFormat.JwtVc,
          $or: [{ types: ['OpenBadgeCredential'] }],
        })
        expect(result.credential_matches.jwt).toMatchObject({
          success: true,
          valid_credentials: [{ record: { id: jwtRecord.id } }],
        })
      }
    })
  })

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
      resolve: () => ({ fetchTypeMetadata: async () => undefined }),
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
