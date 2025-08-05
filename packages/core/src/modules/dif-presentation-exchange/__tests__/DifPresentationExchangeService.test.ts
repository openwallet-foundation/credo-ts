import { Subject } from 'rxjs'

import { InMemoryStorageService } from '../../../../../../tests/InMemoryStorageService'
import { agentDependencies, getAgentContext } from '../../../../tests'
import { InjectionSymbols } from '../../../constants'
import { JsonTransformer } from '../../../utils'
import { KeyManagementApi } from '../../kms'
import { Mdoc, MdocDeviceResponse, MdocRecord, MdocRepository } from '../../mdoc'
import { sprindFunkeTestVectorBase64Url } from '../../mdoc/__tests__/mdoc.fixtures'
import { SdJwtVcRecord, SdJwtVcRepository } from '../../sd-jwt-vc'
import {
  SignatureSuiteToken,
  W3cCredentialService,
  W3cCredentialsModuleConfig,
  W3cJsonLdVerifiablePresentation,
} from '../../vc'
import { DifPresentationExchangeService } from '../DifPresentationExchangeService'
import { type DifPresentationExchangeDefinitionV2, DifPresentationExchangeSubmissionLocation } from '../models'

const agentContext = getAgentContext({
  registerInstances: [
    [InjectionSymbols.StorageService, new InMemoryStorageService()],
    [InjectionSymbols.AgentDependencies, agentDependencies],
    [InjectionSymbols.Stop$, new Subject<boolean>()],
    [SignatureSuiteToken, 'default'],
    [W3cCredentialsModuleConfig, new W3cCredentialsModuleConfig()],
  ],
})

const kms = agentContext.resolve(KeyManagementApi)

const sdJwtVcRecord = new SdJwtVcRecord({
  compactSdJwtVc:
    'eyJ4NWMiOlsiTUlJQ2REQ0NBaHVnQXdJQkFnSUJBakFLQmdncWhrak9QUVFEQWpDQmlERUxNQWtHQTFVRUJoTUNSRVV4RHpBTkJnTlZCQWNNQmtKbGNteHBiakVkTUJzR0ExVUVDZ3dVUW5WdVpHVnpaSEoxWTJ0bGNtVnBJRWR0WWtneEVUQVBCZ05WQkFzTUNGUWdRMU1nU1VSRk1UWXdOQVlEVlFRRERDMVRVRkpKVGtRZ1JuVnVhMlVnUlZWRVNTQlhZV3hzWlhRZ1VISnZkRzkwZVhCbElFbHpjM1ZwYm1jZ1EwRXdIaGNOTWpRd05UTXhNRGd4TXpFM1doY05NalV3TnpBMU1EZ3hNekUzV2pCc01Rc3dDUVlEVlFRR0V3SkVSVEVkTUJzR0ExVUVDZ3dVUW5WdVpHVnpaSEoxWTJ0bGNtVnBJRWR0WWtneENqQUlCZ05WQkFzTUFVa3hNakF3QmdOVkJBTU1LVk5RVWtsT1JDQkdkVzVyWlNCRlZVUkpJRmRoYkd4bGRDQlFjbTkwYjNSNWNHVWdTWE56ZFdWeU1Ga3dFd1lIS29aSXpqMENBUVlJS29aSXpqMERBUWNEUWdBRU9GQnE0WU1LZzR3NWZUaWZzeXR3QnVKZi83RTdWaFJQWGlObTUyUzNxMUVUSWdCZFh5REsza1Z4R3hnZUhQaXZMUDN1dU12UzZpREVjN3FNeG12ZHVLT0JrRENCalRBZEJnTlZIUTRFRmdRVWlQaENrTEVyRFhQTFcyL0owV1ZlZ2h5dyttSXdEQVlEVlIwVEFRSC9CQUl3QURBT0JnTlZIUThCQWY4RUJBTUNCNEF3TFFZRFZSMFJCQ1l3SklJaVpHVnRieTV3YVdRdGFYTnpkV1Z5TG1KMWJtUmxjMlJ5ZFdOclpYSmxhUzVrWlRBZkJnTlZIU01FR0RBV2dCVFVWaGpBaVRqb0RsaUVHTWwyWXIrcnU4V1F2akFLQmdncWhrak9QUVFEQWdOSEFEQkVBaUFiZjVUemtjUXpoZldvSW95aTFWTjdkOEk5QnNGS20xTVdsdVJwaDJieUdRSWdLWWtkck5mMnhYUGpWU2JqVy9VLzVTNXZBRUM1WHhjT2FudXNPQnJvQmJVPSIsIk1JSUNlVENDQWlDZ0F3SUJBZ0lVQjVFOVFWWnRtVVljRHRDaktCL0gzVlF2NzJnd0NnWUlLb1pJemowRUF3SXdnWWd4Q3pBSkJnTlZCQVlUQWtSRk1ROHdEUVlEVlFRSERBWkNaWEpzYVc0eEhUQWJCZ05WQkFvTUZFSjFibVJsYzJSeWRXTnJaWEpsYVNCSGJXSklNUkV3RHdZRFZRUUxEQWhVSUVOVElFbEVSVEUyTURRR0ExVUVBd3d0VTFCU1NVNUVJRVoxYm10bElFVlZSRWtnVjJGc2JHVjBJRkJ5YjNSdmRIbHdaU0JKYzNOMWFXNW5JRU5CTUI0WERUSTBNRFV6TVRBMk5EZ3dPVm9YRFRNME1EVXlPVEEyTkRnd09Wb3dnWWd4Q3pBSkJnTlZCQVlUQWtSRk1ROHdEUVlEVlFRSERBWkNaWEpzYVc0eEhUQWJCZ05WQkFvTUZFSjFibVJsYzJSeWRXTnJaWEpsYVNCSGJXSklNUkV3RHdZRFZRUUxEQWhVSUVOVElFbEVSVEUyTURRR0ExVUVBd3d0VTFCU1NVNUVJRVoxYm10bElFVlZSRWtnVjJGc2JHVjBJRkJ5YjNSdmRIbHdaU0JKYzNOMWFXNW5JRU5CTUZrd0V3WUhLb1pJemowQ0FRWUlLb1pJemowREFRY0RRZ0FFWUd6ZHdGRG5jNytLbjVpYkF2Q09NOGtlNzdWUXhxZk1jd1pMOElhSUErV0NST2NDZm1ZL2dpSDkycU1ydTVwL2t5T2l2RTBSQy9JYmRNT052RG9VeWFObU1HUXdIUVlEVlIwT0JCWUVGTlJXR01DSk9PZ09XSVFZeVhaaXY2dTd4WkMrTUI4R0ExVWRJd1FZTUJhQUZOUldHTUNKT09nT1dJUVl5WFppdjZ1N3haQytNQklHQTFVZEV3RUIvd1FJTUFZQkFmOENBUUF3RGdZRFZSMFBBUUgvQkFRREFnR0dNQW9HQ0NxR1NNNDlCQU1DQTBjQU1FUUNJR0VtN3drWktIdC9hdGI0TWRGblhXNnlybndNVVQydTEzNmdkdGwxMFk2aEFpQnVURnF2Vll0aDFyYnh6Q1AweFdaSG1RSzlrVnl4bjhHUGZYMjdFSXp6c3c9PSJdLCJraWQiOiJNSUdVTUlHT3BJR0xNSUdJTVFzd0NRWURWUVFHRXdKRVJURVBNQTBHQTFVRUJ3d0dRbVZ5YkdsdU1SMHdHd1lEVlFRS0RCUkNkVzVrWlhOa2NuVmphMlZ5WldrZ1IyMWlTREVSTUE4R0ExVUVDd3dJVkNCRFV5QkpSRVV4TmpBMEJnTlZCQU1NTFZOUVVrbE9SQ0JHZFc1clpTQkZWVVJKSUZkaGJHeGxkQ0JRY205MGIzUjVjR1VnU1hOemRXbHVaeUJEUVFJQkFnPT0iLCJ0eXAiOiJ2YytzZC1qd3QiLCJhbGciOiJFUzI1NiJ9.eyJwbGFjZV9vZl9iaXJ0aCI6eyJfc2QiOlsiVS01ZlVXLU5EM1laajZTcUdyQXV4NXJWYWZOalhqZ2hvMmRUUmpQX3hOTSJdfSwiX3NkIjpbIjlFaUpQNEw2NDI0bEtTVGs5NHpIOWhaWVc5UjNuS1R3V0V5TVBJN2dvWHciLCJHVlhRWEtFMmpWR1d0VEF6T1d5ck85TTZySW1qYkZJWGFnRkMyWElMbGhJIiwiUUV2bHpNd0ozZS1tOEtpWEk5bGx2bnVQblh5UHRXN2VCSF9GcXFVTnk3WSIsImljWkpTRkFqLVg3T29Sam5vRFRReXFwU1dNQUVuaTcydWZDZmFFWC1uQkUiLCJsUHJqb3BqbEN5bFdHWVo0cmh4S1RUTUsxS3p1Sm5ISUtybzNwUUhlUXF3IiwicjJORHZtRFY3QmU3TlptVFR0VE9fekdZX3RTdWdYVXoxeDJBXzZuOFhvdyIsInJPbjFJUkpUQWtEV1pSTGc3MUYzaDVsbFpPc1ZPMl9aemlOUy1majNEUFUiXSwiYWRkcmVzcyI6eyJfc2QiOlsiQnI1aVZtZnZlaTloQ01mMktVOGRFVjFER2hrdUtsQ1pUeGFEQ0FMb3NJbyIsIkx6czJpR09SNHF0clhhYmdwMzFfcjFFUFNmazlaUDJQRElJUTRQaHlPT00iLCJadUV5cG41Y0s0WVpWdHdkeGFoWXJqMjZ1MFI2UmxpOVVJWlNjUGhoWTB3Iiwidi1rMzl2VGI5NFI5a25VWTZtbzlXUVdEQkNJS3lya0J4bExTQVl3T2MyNCJdfSwiaXNzdWluZ19jb3VudHJ5IjoiREUiLCJ2Y3QiOiJodHRwczovL2V4YW1wbGUuYm1pLmJ1bmQuZGUvY3JlZGVudGlhbC9waWQvMS4wIiwiaXNzdWluZ19hdXRob3JpdHkiOiJERSIsIl9zZF9hbGciOiJzaGEtMjU2IiwiaXNzIjoiaHR0cHM6Ly9kZW1vLnBpZC1pc3N1ZXIuYnVuZGVzZHJ1Y2tlcmVpLmRlL2MxIiwiY25mIjp7Imp3ayI6eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6IkhzS194Tl95SVU4eWlqdW9BWlhsbndFRU00ZlhZenVNRmd5TTE5SmRYMUkiLCJ5IjoiQUR2NnplVDl3YmgxU0ZxMG14TkcxMUZueC05eFdSRFcwR18xN1dSRXpRSSJ9fSwiZXhwIjoxNzMzNTcxMzI3LCJpYXQiOjE3MzIzNjE3MjcsImFnZV9lcXVhbF9vcl9vdmVyIjp7Il9zZCI6WyJLRDF0U0hnYWotZi1qbkZURkRDMW1sZ0RwNzhMZE1KcHlqWnRRU0k4a1ZnIiwiTDRjTTMtZU1mRHg0Znc2UEw3OVRTVFBnM042VXdzOGNPc3JOYmNqaEEtYyIsImRYUFBQX2lmNFM3XzBzcXZXNTBwZEdlMWszbS1wMnM3M1JicDlncThGaDAiLCJtYnllcU05YUkzRkVvWmFoODA5eTN0dlRCV1NvZTBMSlRUYTlONGNjdmlZIiwicm1zd0dEZnhvS0ZFYlFsNzZ4S1ZVT0hrX0MyQlVpVnQ5RDlvMTFrMmZNSSIsInZsY2Y4WTNhQnNTeEZBeVZfYk9NTndvX3FTT1pHc3ViSVZiY0FVSWVBSGMiXX19.gruqjNOuJBgHXEnG9e60wOoqiyEaL1K9pdL215a0ffZCjtIZ_kICDrO5vBiTrEmvjjd6w_N_thEYLhzob77Epg~WyJWRXlWQWF0LXoyNU8tbkQ0MVBaOGdnIiwiZmFtaWx5X25hbWUiLCJNVVNURVJNQU5OIl0~WyJLcnRPei1lRk9hMU9JYmpmUHUxcHRBIiwiZ2l2ZW5fbmFtZSIsIkVSSUtBIl0~WyJQQUVjSHp0NWk5bFFzNUZlRmFGUS1RIiwiYmlydGhkYXRlIiwiMTk2NC0wOC0xMiJd~',
})
const mdocRecord = new MdocRecord({
  mdoc: Mdoc.fromBase64Url(sprindFunkeTestVectorBase64Url),
})

const randomMdoc = new MdocRecord({
  mdoc: Mdoc.fromBase64Url(
    'uQACam5hbWVTcGFjZXOhZWhlbGxvg9gYWGOkaGRpZ2VzdElEAHFlbGVtZW50SWRlbnRpZmllcmV3b3JsZGxlbGVtZW50VmFsdWVpZnJvbS1tZG9jZnJhbmRvbVgg-8edSGZ4_YYWy4zTRYy_R2_-env6K0QPZV6bx5VrIvfYGFhgpGhkaWdlc3RJRAFxZWxlbWVudElkZW50aWZpZXJmc2VjcmV0bGVsZW1lbnRWYWx1ZWV2YWx1ZWZyYW5kb21YIFeRZQch_uztS3BgwZU1lOy1HnvbtisuakBr4dut_Q1e2BhYX6RoZGlnZXN0SUQCcWVsZW1lbnRJZGVudGlmaWVyZW5pY2VybGVsZW1lbnRWYWx1ZWVkaWNlcmZyYW5kb21YICeD0ZWG4LX7SgTdsaXHbs-zbkOdZ2pGAHr0Ki-YT-ugamlzc3VlckF1dGiEQ6EBJqIEWDF6RG5hZVQ2SGZWTGVqSmpYRTU4Wnd6ejlVUDVGNVNHWjE4b0hWZlpFTUhVTjRFcXRqGCFZASQwggEgMIHGoAMCAQICEERn7erWTVemixMortrLsmcwCgYIKoZIzj0EAwIwEDEOMAwGA1UEAxMFY3JlZG8wHhcNMjUwMzIwMTc1MjUxWhcNMjUwMzIyMTc1MjUxWjAQMQ4wDAYDVQQDEwVjcmVkbzBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABCeIfw1uOR6lHNOnTHUmDCCOoEUiV-8CD_XlkFm7R0qQRblyGCRyPASBQTkMDSBRutyU51-guQc8o2Ows8T5B4qjAjAAMAoGCCqGSM49BAMCA0kAMEYCIQDISRFJVg_c57Zeya_7ET8lZboClKEs3Ah2w9yTICP2awIhAOE1U5l6_siMKc3XoFtSSZNEaJL4L5j3cfaRt35mzNWyWQGc2BhZAZe5AAZndmVyc2lvbmMxLjBvZGlnZXN0QWxnb3JpdGhtZ1NIQS0yNTZsdmFsdWVEaWdlc3RzoWVoZWxsb6MAWCAqyMbsL2ne4fnZR-9F4ljmVALkkEO3ldc-3wR3FJfy1AFYIErI8BMR8z_mn8TnxaAGlnXCO7UsMuRWryEeGqd7KveOAlggGHwP3C0oNTFjnE5Y8d9NfWqAylZC5_bY4TFmATRwpqFtZGV2aWNlS2V5SW5mb7kAAWlkZXZpY2VLZXmkAQIgASFYIJZf9Yt9eS7hVbR956b8n21Cb83jn4AYLfH6s40uT1FLIlggWA6ogfJFJiOhH8j0-XNaLrr_Z2ALnt-nwzK0HTbiTjpnZG9jVHlwZXVvcmcuaXNvLjE4MDEzLjUuMS5tRExsdmFsaWRpdHlJbmZvuQADZnNpZ25lZMB0MjAyNS0wMy0yMVQxNzo1Mjo1MVppdmFsaWRGcm9twHQyMDI1LTAzLTIxVDE3OjUyOjUxWmp2YWxpZFVudGlswHQyMDI2LTAzLTIxVDE3OjUyOjUxWlhAMZsBgn9Pxs_0V-1X23zskwQgBcw20UxOHZBXlPQAUhwMIc9EnG2IPoSkHDsJMw3kNIEXrzJd5avegle2Pv4nTQ'
  ),
})

const sdJwtVcRepository = agentContext.dependencyManager.resolve(SdJwtVcRepository)
const mdocRepository = agentContext.dependencyManager.resolve(MdocRepository)
const pexService = new DifPresentationExchangeService(agentContext.dependencyManager.resolve(W3cCredentialService))

const presentationDefinition: DifPresentationExchangeDefinitionV2 = {
  id: '1ad8ea6e-ec51-4e14-b316-dd76a6275480',
  name: 'PID and MDL - Rent a Car (vc+sd-jwt)',
  purpose: 'To secure your car reservations and finalize the transaction, we require the following attributes',
  input_descriptors: [
    {
      id: 'bf8669f4-0cf3-4d16-b72b-b47eb702a7cd',
      format: {
        'vc+sd-jwt': {
          'sd-jwt_alg_values': ['ES256'],
          'kb-jwt_alg_values': ['ES256'],
        },
      },
      group: ['A'],
      constraints: {
        limit_disclosure: 'required',
        fields: [
          { path: ['$.document_number'] },
          { path: ['$.portrait'] },
          { path: ['$.issue_date'] },
          { path: ['$.expiry_date'] },
          { path: ['$.issuing_country'] },
          { path: ['$.issuing_authority'] },
          { path: ['$.driving_priviliges'] },
          {
            path: ['$.vct'],
            filter: {
              type: 'string',
              enum: ['https://example.eudi.ec.europa.eu/mdl/1'],
            },
          },
        ],
      },
    },
    {
      id: '99fce09b-a0d3-415b-b8a7-3eab8829babc',
      format: {
        'vc+sd-jwt': {
          'sd-jwt_alg_values': ['ES256'],
          'kb-jwt_alg_values': ['ES256'],
        },
      },
      group: ['B'],
      constraints: {
        limit_disclosure: 'required',
        fields: [
          { path: ['$.given_name'] },
          { path: ['$.family_name'] },
          { path: ['$.birthdate'] },
          {
            path: ['$.vct'],
            filter: {
              type: 'string',
              enum: ['https://example.bmi.bund.de/credential/pid/1.0', 'urn:eu.europa.ec.eudi:pid:1'],
            },
          },
          {
            path: ['$.iss'],
            filter: {
              type: 'string',
              enum: [
                'https://demo.pid-issuer.bundesdruckerei.de/c',
                'https://demo.pid-issuer.bundesdruckerei.de/c1',
                'https://demo.pid-issuer.bundesdruckerei.de/b1',
              ],
            },
          },
        ],
      },
    },
    {
      id: 'eu.europa.ec.eudi.pid.1',
      format: {
        mso_mdoc: {
          alg: ['ES256'],
        },
      },
      group: ['C'],
      constraints: {
        limit_disclosure: 'required',
        fields: [
          {
            intent_to_retain: false,
            path: ["$['eu.europa.ec.eudi.pid.1']['birth_date']"],
          },
        ],
      },
    },
    {
      id: 'org.iso.18013.5.1.mDL',
      format: {
        mso_mdoc: {
          alg: ['ES256'],
        },
      },
      group: ['D'],
      constraints: {
        limit_disclosure: 'required',
        fields: [
          {
            intent_to_retain: false,
            path: ["$['hello']['world']"],
          },
        ],
      },
    },
  ],
}

describe('DifPresentationExchangeService', () => {
  beforeAll(async () => {
    await sdJwtVcRepository.save(agentContext, sdJwtVcRecord)
    await mdocRepository.save(agentContext, mdocRecord)
  })

  test('handles request where two credentials are requested but only one available', async () => {
    const credentialsForRequest = await pexService.getCredentialsForRequest(agentContext, presentationDefinition)
    expect(credentialsForRequest).toEqual({
      requirements: [
        {
          rule: 'pick',
          needsCount: 1,
          submissionEntry: [
            {
              inputDescriptorId: 'bf8669f4-0cf3-4d16-b72b-b47eb702a7cd',
              name: undefined,
              purpose: undefined,
              verifiableCredentials: [],
            },
          ],
          isRequirementSatisfied: false,
        },
        {
          rule: 'pick',
          needsCount: 1,
          submissionEntry: [
            {
              inputDescriptorId: '99fce09b-a0d3-415b-b8a7-3eab8829babc',
              name: undefined,
              purpose: undefined,
              verifiableCredentials: [
                {
                  credentialRecord: await sdJwtVcRepository.getById(agentContext, sdJwtVcRecord.id),
                  disclosedPayload: {
                    address: {},
                    age_equal_or_over: {},
                    birthdate: '1964-08-12',
                    cnf: {
                      jwk: {
                        crv: 'P-256',
                        kty: 'EC',
                        x: 'HsK_xN_yIU8yijuoAZXlnwEEM4fXYzuMFgyM19JdX1I',
                        y: 'ADv6zeT9wbh1SFq0mxNG11Fnx-9xWRDW0G_17WREzQI',
                      },
                    },
                    exp: 1733571327,
                    family_name: 'MUSTERMANN',
                    given_name: 'ERIKA',
                    iat: 1732361727,
                    iss: 'https://demo.pid-issuer.bundesdruckerei.de/c1',
                    issuing_authority: 'DE',
                    issuing_country: 'DE',
                    place_of_birth: {},
                    vct: 'https://example.bmi.bund.de/credential/pid/1.0',
                  },
                  claimFormat: 'vc+sd-jwt',
                },
              ],
            },
          ],
          isRequirementSatisfied: true,
        },
        {
          isRequirementSatisfied: true,
          needsCount: 1,
          rule: 'pick',
          submissionEntry: [
            {
              inputDescriptorId: 'eu.europa.ec.eudi.pid.1',
              name: undefined,
              purpose: undefined,
              verifiableCredentials: [
                {
                  credentialRecord: await mdocRepository.getById(agentContext, mdocRecord.id),
                  disclosedPayload: {
                    'eu.europa.ec.eudi.pid.1': {
                      birth_date: '1984-01-26',
                    },
                  },
                  claimFormat: 'mso_mdoc',
                },
              ],
            },
          ],
        },
        {
          rule: 'pick',
          needsCount: 1,
          submissionEntry: [
            {
              inputDescriptorId: 'org.iso.18013.5.1.mDL',
              name: undefined,
              purpose: undefined,
              verifiableCredentials: [],
            },
          ],
          isRequirementSatisfied: false,
        },
      ],
      areRequirementsSatisfied: false,
      name: 'PID and MDL - Rent a Car (vc+sd-jwt)',
      purpose: 'To secure your car reservations and finalize the transaction, we require the following attributes',
    })
  })

  test('handles request with submission requirements where two credentials are requested but only one available', async () => {
    const credentialsForRequest = await pexService.getCredentialsForRequest(agentContext, {
      ...presentationDefinition,
      submission_requirements: [
        {
          rule: 'pick',
          count: 1,
          from: 'A',
        },
        {
          rule: 'all',
          from: 'B',
        },
        {
          rule: 'pick',
          count: 1,
          from: 'C',
        },
        {
          rule: 'all',
          from: 'D',
        },
      ],
    })
    expect(credentialsForRequest).toEqual({
      requirements: [
        {
          rule: 'pick',
          needsCount: 1,
          submissionEntry: [
            {
              inputDescriptorId: 'bf8669f4-0cf3-4d16-b72b-b47eb702a7cd',
              name: undefined,
              purpose: undefined,
              verifiableCredentials: [],
            },
          ],
          isRequirementSatisfied: false,
        },
        {
          rule: 'all',
          needsCount: 1,
          submissionEntry: [
            {
              inputDescriptorId: '99fce09b-a0d3-415b-b8a7-3eab8829babc',
              name: undefined,
              purpose: undefined,
              verifiableCredentials: [
                {
                  credentialRecord: await sdJwtVcRepository.getById(agentContext, sdJwtVcRecord.id),
                  disclosedPayload: {
                    address: {},
                    age_equal_or_over: {},
                    birthdate: '1964-08-12',
                    cnf: {
                      jwk: {
                        crv: 'P-256',
                        kty: 'EC',
                        x: 'HsK_xN_yIU8yijuoAZXlnwEEM4fXYzuMFgyM19JdX1I',
                        y: 'ADv6zeT9wbh1SFq0mxNG11Fnx-9xWRDW0G_17WREzQI',
                      },
                    },
                    exp: 1733571327,
                    family_name: 'MUSTERMANN',
                    given_name: 'ERIKA',
                    iat: 1732361727,
                    iss: 'https://demo.pid-issuer.bundesdruckerei.de/c1',
                    issuing_authority: 'DE',
                    issuing_country: 'DE',
                    place_of_birth: {},
                    vct: 'https://example.bmi.bund.de/credential/pid/1.0',
                  },
                  claimFormat: 'vc+sd-jwt',
                },
              ],
            },
          ],
          isRequirementSatisfied: true,
        },
        {
          isRequirementSatisfied: true,
          needsCount: 1,
          rule: 'pick',
          submissionEntry: [
            {
              inputDescriptorId: 'eu.europa.ec.eudi.pid.1',
              name: undefined,
              purpose: undefined,
              verifiableCredentials: [
                {
                  credentialRecord: await mdocRepository.getById(agentContext, mdocRecord.id),
                  disclosedPayload: {
                    'eu.europa.ec.eudi.pid.1': {
                      birth_date: '1984-01-26',
                    },
                  },
                  claimFormat: 'mso_mdoc',
                },
              ],
            },
          ],
        },
        {
          rule: 'all',
          needsCount: 1,
          submissionEntry: [
            {
              inputDescriptorId: 'org.iso.18013.5.1.mDL',
              name: undefined,
              purpose: undefined,
              verifiableCredentials: [],
            },
          ],
          isRequirementSatisfied: false,
        },
      ],
      areRequirementsSatisfied: false,
      name: 'PID and MDL - Rent a Car (vc+sd-jwt)',
      purpose: 'To secure your car reservations and finalize the transaction, we require the following attributes',
    })
  })

  test('handles request with request for one of two mdocs with submission requirements', async () => {
    await mdocRepository.save(agentContext, randomMdoc)
    const presentationDefinition = {
      id: 'OverAgeCheck',
      purpose: 'Age check',
      submission_requirements: [
        {
          name: 'Proof of age and photo',
          rule: 'pick',
          count: 1,
          from: 'validAgeCheckInputDescriptor',
        },
      ],
      input_descriptors: [
        {
          name: 'Mdoc proof of age and photo',
          id: 'eu.europa.ec.eudi.pid.1',
          group: ['validAgeCheckInputDescriptor'],
          format: { mso_mdoc: { alg: ['EdDSA', 'ES256'] } },
          constraints: {
            limit_disclosure: 'required',
            fields: [
              {
                path: [`$['eu.europa.ec.eudi.pid.1']['age_in_years']`],
                intent_to_retain: false,
              },
            ],
          },
        },
        {
          name: 'Driving licence Mdoc date of birth and photo',
          id: 'org.iso.18013.5.1.mDL',
          group: ['validAgeCheckInputDescriptor'],
          format: { mso_mdoc: { alg: ['EdDSA', 'ES256'] } },
          constraints: {
            limit_disclosure: 'required',
            fields: [
              {
                path: [`$['hello']['world']`],
                intent_to_retain: false,
              },
            ],
          },
        },
      ],
    } satisfies DifPresentationExchangeDefinitionV2

    const credentialsForRequest = await pexService.getCredentialsForRequest(agentContext, presentationDefinition)
    expect(credentialsForRequest).toEqual({
      requirements: [
        {
          rule: 'pick',
          needsCount: 1,
          purpose: undefined,
          name: 'Proof of age and photo',
          submissionEntry: [
            {
              inputDescriptorId: 'eu.europa.ec.eudi.pid.1',
              name: 'Mdoc proof of age and photo',
              purpose: undefined,
              verifiableCredentials: [
                {
                  credentialRecord: await mdocRepository.getById(agentContext, mdocRecord.id),
                  claimFormat: 'mso_mdoc',
                  disclosedPayload: {
                    'eu.europa.ec.eudi.pid.1': {
                      age_in_years: 40,
                    },
                  },
                },
              ],
            },
            {
              inputDescriptorId: 'org.iso.18013.5.1.mDL',
              name: 'Driving licence Mdoc date of birth and photo',
              purpose: undefined,
              verifiableCredentials: [
                {
                  credentialRecord: await mdocRepository.getById(agentContext, randomMdoc.id),
                  claimFormat: 'mso_mdoc',
                  disclosedPayload: {
                    hello: {
                      world: 'from-mdoc',
                    },
                  },
                },
              ],
            },
          ],
          isRequirementSatisfied: true,
        },
      ],
      areRequirementsSatisfied: true,
      name: undefined,
      purpose: 'Age check',
    })

    const selectedCredentials = pexService.selectCredentialsForRequest(credentialsForRequest)

    jest.spyOn(kms, 'sign').mockResolvedValue({ signature: new Uint8Array([]) })
    const presentation = await pexService.createPresentation(agentContext, {
      credentialsForInputDescriptor: selectedCredentials,
      challenge: 'something',
      presentationDefinition,
      domain: 'hello',
      presentationSubmissionLocation: DifPresentationExchangeSubmissionLocation.EXTERNAL,
      openid4vp: {
        type: 'openId4Vp',
        clientId: 'hello',
        mdocGeneratedNonce: 'something',
        responseUri: 'https://response.com',
      },
    })

    expect(presentation).toMatchObject({
      presentationSubmission: {
        id: expect.stringContaining('MdocPresentationSubmission'),
        definition_id: 'OverAgeCheck',
        descriptor_map: [{ id: 'eu.europa.ec.eudi.pid.1', format: 'mso_mdoc', path: '$' }],
      },
    })
    await mdocRepository.deleteById(agentContext, randomMdoc.id)
  })

  test('handles request with request containing optional properties', async () => {
    await mdocRepository.save(agentContext, randomMdoc)
    const presentationDefinition = {
      id: 'OverAgeCheck',
      purpose: 'Age check',
      submission_requirements: [
        {
          name: 'Proof of age and photo',
          rule: 'pick',
          count: 1,
          from: 'validAgeCheckInputDescriptor',
        },
      ],
      input_descriptors: [
        {
          name: 'Mdoc proof of age and photo',
          id: 'eu.europa.ec.eudi.pid.1',
          group: ['validAgeCheckInputDescriptor'],
          format: { mso_mdoc: { alg: ['EdDSA', 'ES256'] } },
          constraints: {
            limit_disclosure: 'required',
            fields: [
              {
                path: [`$['eu.europa.ec.eudi.pid.1']['age_in_years']`],
                optional: false,
                intent_to_retain: false,
              },
            ],
          },
        },
        {
          name: 'Driving licence Mdoc date of birth and photo',
          id: 'org.iso.18013.5.1.mDL',
          group: ['validAgeCheckInputDescriptor'],
          format: { mso_mdoc: { alg: ['EdDSA', 'ES256'] } },
          constraints: {
            limit_disclosure: 'required',
            fields: [
              {
                optional: true,
                path: [`$['hello']['not_available']`],
                intent_to_retain: false,
              },
              {
                optional: false,
                path: [`$['hello']['world']`],
                intent_to_retain: false,
              },
            ],
          },
        },
      ],
    } satisfies DifPresentationExchangeDefinitionV2

    const credentialsForRequest = await pexService.getCredentialsForRequest(agentContext, presentationDefinition)
    expect(credentialsForRequest).toEqual({
      requirements: [
        {
          rule: 'pick',
          needsCount: 1,
          purpose: undefined,
          name: 'Proof of age and photo',
          submissionEntry: [
            {
              inputDescriptorId: 'eu.europa.ec.eudi.pid.1',
              name: 'Mdoc proof of age and photo',
              purpose: undefined,
              verifiableCredentials: [
                {
                  credentialRecord: await mdocRepository.getById(agentContext, mdocRecord.id),
                  claimFormat: 'mso_mdoc',
                  disclosedPayload: {
                    'eu.europa.ec.eudi.pid.1': {
                      age_in_years: 40,
                    },
                  },
                },
              ],
            },
            {
              inputDescriptorId: 'org.iso.18013.5.1.mDL',
              name: 'Driving licence Mdoc date of birth and photo',
              purpose: undefined,
              verifiableCredentials: [
                {
                  credentialRecord: await mdocRepository.getById(agentContext, randomMdoc.id),
                  claimFormat: 'mso_mdoc',
                  disclosedPayload: {
                    hello: {
                      world: 'from-mdoc',
                    },
                  },
                },
              ],
            },
          ],
          isRequirementSatisfied: true,
        },
      ],
      areRequirementsSatisfied: true,
      name: undefined,
      purpose: 'Age check',
    })

    const selectedCredentials = pexService.selectCredentialsForRequest(credentialsForRequest)

    jest.spyOn(kms, 'sign').mockResolvedValue({ signature: new Uint8Array([]) })

    const presentation = await pexService.createPresentation(agentContext, {
      credentialsForInputDescriptor: selectedCredentials,
      challenge: 'something',
      presentationDefinition,
      domain: 'hello',
      presentationSubmissionLocation: DifPresentationExchangeSubmissionLocation.EXTERNAL,
      openid4vp: {
        type: 'openId4Vp',
        clientId: 'hello',
        mdocGeneratedNonce: 'something',
        responseUri: 'https://response.com',
      },
    })

    expect(presentation).toMatchObject({
      presentationSubmission: {
        id: expect.stringContaining('MdocPresentationSubmission'),
        definition_id: 'OverAgeCheck',
        descriptor_map: [{ id: 'eu.europa.ec.eudi.pid.1', format: 'mso_mdoc', path: '$' }],
      },
    })
    await mdocRepository.deleteById(agentContext, randomMdoc.id)
  })

  test('handles request with request for two mdocs with submission requirements', async () => {
    await mdocRepository.save(agentContext, randomMdoc)

    const presentationDefinition = {
      id: 'OverAgeCheck',
      purpose: 'Age check',
      submission_requirements: [
        {
          name: 'Proof of age and photo',
          rule: 'pick',
          count: 1,
          from: 'validAgeCheckInputDescriptor',
        },
        {
          name: 'Proof of age and photo 2',
          rule: 'pick',
          count: 1,
          from: 'validAgeCheckInputDescriptor2',
        },
      ],
      input_descriptors: [
        {
          name: 'Mdoc proof of age and photo',
          id: 'eu.europa.ec.eudi.pid.1',
          group: ['validAgeCheckInputDescriptor'],
          format: { mso_mdoc: { alg: ['EdDSA', 'ES256'] } },
          constraints: {
            limit_disclosure: 'required',
            fields: [
              {
                path: [`$['eu.europa.ec.eudi.pid.1']['age_in_years']`],
                intent_to_retain: false,
              },
            ],
          },
        },
        {
          name: 'Driving licence Mdoc date of birth and photo',
          id: 'org.iso.18013.5.1.mDL',
          group: ['validAgeCheckInputDescriptor2'],
          format: { mso_mdoc: { alg: ['EdDSA', 'ES256'] } },
          constraints: {
            limit_disclosure: 'required',
            fields: [
              {
                path: [`$['hello']['world']`],
                intent_to_retain: false,
              },
            ],
          },
        },
      ],
    } satisfies DifPresentationExchangeDefinitionV2

    const credentialsForRequest = await pexService.getCredentialsForRequest(agentContext, presentationDefinition)
    expect(credentialsForRequest).toEqual({
      requirements: [
        {
          rule: 'pick',
          needsCount: 1,
          purpose: undefined,
          name: 'Proof of age and photo',
          submissionEntry: [
            {
              inputDescriptorId: 'eu.europa.ec.eudi.pid.1',
              name: 'Mdoc proof of age and photo',
              purpose: undefined,
              verifiableCredentials: [
                {
                  credentialRecord: await mdocRepository.getById(agentContext, mdocRecord.id),
                  claimFormat: 'mso_mdoc',
                  disclosedPayload: {
                    'eu.europa.ec.eudi.pid.1': {
                      age_in_years: 40,
                    },
                  },
                },
              ],
            },
          ],
          isRequirementSatisfied: true,
        },
        {
          rule: 'pick',
          needsCount: 1,
          purpose: undefined,
          name: 'Proof of age and photo 2',
          submissionEntry: [
            {
              inputDescriptorId: 'org.iso.18013.5.1.mDL',
              name: 'Driving licence Mdoc date of birth and photo',
              purpose: undefined,
              verifiableCredentials: [
                {
                  credentialRecord: await mdocRepository.getById(agentContext, randomMdoc.id),
                  claimFormat: 'mso_mdoc',
                  disclosedPayload: {
                    hello: {
                      world: 'from-mdoc',
                    },
                  },
                },
              ],
            },
          ],
          isRequirementSatisfied: true,
        },
      ],
      areRequirementsSatisfied: true,
      name: undefined,
      purpose: 'Age check',
    })

    const selectedCredentials = pexService.selectCredentialsForRequest(credentialsForRequest)

    jest.spyOn(kms, 'sign').mockResolvedValue({ signature: new Uint8Array([]) })

    const presentation = await pexService.createPresentation(agentContext, {
      credentialsForInputDescriptor: selectedCredentials,
      challenge: 'something',
      presentationDefinition,
      domain: 'hello',
      presentationSubmissionLocation: DifPresentationExchangeSubmissionLocation.EXTERNAL,
      openid4vp: {
        type: 'openId4Vp',
        clientId: 'hello',
        mdocGeneratedNonce: 'something',
        responseUri: 'https://response.com',
      },
    })

    expect(presentation).toMatchObject({
      presentationSubmission: {
        id: expect.stringContaining('MdocPresentationSubmission'),
        definition_id: 'OverAgeCheck',
        descriptor_map: [
          {
            id: 'eu.europa.ec.eudi.pid.1',
            format: 'mso_mdoc',
            path: '$[0]',
          },
          {
            format: 'mso_mdoc',
            id: 'org.iso.18013.5.1.mDL',
            path: '$[1]',
          },
        ],
      },
    })
    await mdocRepository.deleteById(agentContext, randomMdoc.id)
  })

  test('handles response with multiple mdocs in a single device response', async () => {
    pexService.validatePresentation(
      {
        id: 'random',
        input_descriptors: [
          {
            id: 'org.iso.18013.5.1.mDL',
            format: {
              mso_mdoc: {
                alg: ['ES256'],
              },
            },
            constraints: {
              fields: [
                {
                  path: ["$['org.iso.18013.5.1']['given_name']"],
                  intent_to_retain: false,
                },
              ],
              limit_disclosure: 'required',
            },
          },
          {
            id: 'eu.europa.ec.eudi.pid.1',
            format: {
              mso_mdoc: {
                alg: ['ES256'],
              },
            },
            constraints: {
              fields: [
                {
                  path: ["$['eu.europa.ec.eudi.pid.1']['family_name']"],
                  intent_to_retain: false,
                },
              ],
              limit_disclosure: 'required',
            },
          },
        ],
      },
      MdocDeviceResponse.fromBase64Url(
        'o2d2ZXJzaW9uYzEuMGlkb2N1bWVudHOCo2dkb2NUeXBldW9yZy5pc28uMTgwMTMuNS4xLm1ETGxpc3N1ZXJTaWduZWSiam5hbWVTcGFjZXOhcW9yZy5pc28uMTgwMTMuNS4xgtgYWFOkaGRpZ2VzdElEE2ZyYW5kb21Q4UfVHznACC2C95ORlY-G23FlbGVtZW50SWRlbnRpZmllcmpnaXZlbl9uYW1lbGVsZW1lbnRWYWx1ZWVFcmlrYdgYWFqkaGRpZ2VzdElEGCdmcmFuZG9tUJWFQuwvUIV2n8J8njlewT9xZWxlbWVudElkZW50aWZpZXJrZmFtaWx5X25hbWVsZWxlbWVudFZhbHVlak11c3Rlcm1hbm5qaXNzdWVyQXV0aIRDoQEmoRghWQJDMIICPzCCAcSgAwIBAgIUDFLxB8mHnMFjy_IGSQH-yXzZ8UUwCgYIKoZIzj0EAwMwJjEXMBUGA1UEAwwOUGFuYXNvbmljIElBQ0ExCzAJBgNVBAYTAkpQMB4XDTI1MDIxNTAyMzgzOVoXDTI1MDYxNzAyMzgzOFowJDEVMBMGA1UEAwwMUGFuYXNvbmljIERTMQswCQYDVQQGEwJKUDBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABIKTkv6Cg6Z8WkEnBx3o6tcMaW7Tr9KHEfwclneUKT7pqCcEu4PjGaB8nvEp8SbbEgXLq4FWdFbpbQoSvT3d3mqjgdEwgc4wHwYDVR0jBBgwFoAUhfPpHuV4jk-ko8iG6U03USkGLzAwFQYDVR0lAQH_BAswCQYHKIGMXQUBAjA5BgNVHR8EMjAwMC6gLKAqhihodHRwczovL21kb2MucGFuYXNvbmljLmdvdi9DUkxzL21kb2MuY3JsMB0GA1UdDgQWBBSGkfSUDkZ4U4BjZUYX1S9SrxmBnTAOBgNVHQ8BAf8EBAMCB4AwKgYDVR0SBCMwIYYfaHR0cHM6Ly9tZG9jLnBhbmFzb25pYy5nb3YvbWRvYzAKBggqhkjOPQQDAwNpADBmAjEArspBUJqejhoIVYZu-H8XaVpkiXXlVjlefLBnzLgZm6-4Pb8yCCFt-l0sCjvHO0UUAjEAvvK76jTWNZYX_p1smPXtGeGVt5oRiZ3f-S2wvEDQpSGzjaZX4zI9Etq2FbFLvHuZWQzU2BhZDM-nZ3ZlcnNpb25jMS4wb2RpZ2VzdEFsZ29yaXRobWdTSEEtMjU2Z2RvY1R5cGV1b3JnLmlzby4xODAxMy41LjEubURMbHZhbHVlRGlnZXN0c6Jxb3JnLmlzby4xODAxMy41LjG4LBgnWCB6saB7hlK2EeykYwjZGmyZsbdi5El6gh0gHL2YDezDAxNYIIKn9I9zTq9V8BOGb9N7DscNj534Gd8qseZVYLVYz4drGCxYINVQxuaQuzPN-DYGnb8v4a-4YXU3CcPZ-sgZYj2PxfHhDVgg9AxPlVfbmoeQXJOpU4SmVc1w27XMxborcpsHohpDslwAWCBwK_m_a0mIG8x8efhS3UNmWFG7gKDeyy-SlK_PA5CUVRJYIDpsOCtM-lP72Bbz19ERDqibf356ftB5jAKmFiCd4vrPGC5YIPF4uWsnZwRYzGsPn2oUZLsVraecQSPbpSWzx5JdVxz1GDtYIJs610ro1jUN5X5TZHI1PwGo050OFmw-x4eGfJxeo-WAD1gg31NhmF3nyWGnoW3hSOTCrLh1bfjirYyAlhCxTz5HbrgYG1gg6SzB16Th8-rRgaM5jArWOFDB_eVvC3v6Bh5mEJZeC-kYH1ggXypmMFtYpjKCnA5OVRztyxfQV1Nz7T9kvSugBY-KR44OWCBhi3ZNcZF2Q-hWIYismtEu-j-KrywqXeLe5n-l4mOlvRgqWCBAxW0XyWXAg5v6N7ZVYWsQPFwGMhD6kLRGO93K6tpOKhVYICazH32afpmDNGDNQH5iJes0gN67mQqVP7Ko5j1ehvTeGC9YIL7CuUPZt71T0JZnALPLrzdRSzKNrierzBEGJgGCm64XDFgga8iElmC8dqeucT0FIVFCuS4eGMAtwCMUWGsWfgN8KpIYHFggX4EYOnP28xJtaJCz5qcEfZhcMx3WpKpVnuhCnxtWVNoIWCC-plqpjzCq-71Ovy3BpqdqQ6GwJNXHg8iB0rolKOuEbRgdWCC8baoAP7csHk3222_PlURDDK6L7GAWOcDXB1fqz0z2cQpYILX_GTVUyeVgcAerf7CsWvSPjkXzibmyXVHBi1Ovyva7EVggYcDim6qvlq_g7073r_UsN0SYLJLjSiro0K4qBZik0WYYMlggOEylD7okqt6RTW8JT0-oSF6DhWj_X1Rrpl4VJfhagPUYNlgg_MEm1PVnYAINigvP6t9-IW-D8p0tzJNd4tAg-gXvHVwYJlgg17sc9ZGMsizR8m-r9eie0th_59WvSpDRZs4Xd3wv-yoYLVggKtrNGpXZ3lZ2f5TbUKsg_I6UcKFVu_LPUmI0oAsaaN4YGVggTK0MC7h3_ks2gde6ZCo31rFXLY8syyhEZ3giaWm3qMILWCBduv8FuJVrwYyS3tnYybqQOt3p-vNjE4oroL--qMGzeBdYIAbOjSU-LslPy0L2QEXT2CmxLcL8vU9wJeIBolgtcKoPGB5YIDGsgmliLTlkl0IZyLMMk8siFr1oVxw6ztmOT1EhisGTGDNYIClO5x0QDZ99Ss9ZNVQd4EueLQEc8g4rXLJ0ZNdsd9lhGCRYIDk4GaNf8EiZrTxN5sfJll-EV8I-8Iios3rqH96cXXe9FFgg6rD_L4VPk-LsZBFAHgxgiawN9LQ-A1jUckYvi5jATKoYPVggOW7Xmsv8rhNOVS9wmCKp2-KOI0W39LTU1OQshcBBaq0YMFggCN-g2RcrlHkbbX9cJO5ivkc2Odyd7gPp3pDOSp3QKD8YK1gg8lX4aTc65OpTceQvZjOLcqGK1-FCp2KA4r8MQ9AQDgwYI1ggpGXcJLMh4PZD7x6dHxXEvYU8xWdYSIE4TMu8qxWHfOsYMVggxuqRPatXWacS3z-I0A-0mM2t7MYmEae7vnrhqOY6Lw4YGlggtfi_zYUi3IpP-UliESnUn99W724Dd1GKDWm8o-98ND0HWCAmbtsNzfSant4AC6TCBtS1kz3pFsCArSAcd7PJiRZUIRgiWCBE-bAQ357qRW5gLX96wzXPfB7edhPZIz-O18753o_p5gFYIA2mZSXR2tIrIaQCMN3x7kQL41aad93gmXQW8k3B26a3GDVYILDSmFT55xF5295NSoJ0eLp6CQvsLtL2oM3ccno4a7riGD5YIHdPsX_8oWkA99oyXmVeE8ZLIVZ1YQQwjWPyhS3TgpLVGBhYIDE5202b_1yOSBvKt06nsXaDCKsz6c2M2CAYa_W3CeGxd29yZy5pc28uMTgwMTMuNS4xLmFhbXZhswVYIA6cntt603dG-w91OSsv-j7z_Y4-JQANB85np9qAJdOPGClYIB5HnT6GvzsIotPPovUGEG48Zap4C1ecEGoTr6FLqmcCGDhYIEbEwf07GrRyd_a6Uph3rICMwoYqTchSlTcBcaoNy8uSGDxYIEl_56EYAUKgKd4RV8let7P5MQwDQ09KNAdkhJbIpfCQCVggsKK_ysVODzOyrUwRF15OenIFt622oUieCuDbXeeCJ3EWWCDrf_oKvuXuzJ8jcZo_67rZW2fphfpKAc9Tfzu2xwxdeBggWCBaTwR_K3vLUwezXWi54xNVAEbuUpmEo3-BE3gf6Y6wwBg3WCBkqBFWNStfElNNkscqIcc11lABlutHWNgwfF8dCixDJQZYINeqesfYofU5NHBqgL8b92dY4BxX1IAcKboJUQLDgjqlGChYILwZn-_93OybOROl2V2ArfcwERaSVQXju_Rl2Wps-qOBA1gg4ehfNKqnuRYJ1gW-1D5gOF9rYLlPR1kGpBRhH4tZQacYIVggL2xWR964Dyp1rgYSVhb8XPeH9V41T3DcG8vFj8mpyMUEWCC1H53yNkBNRujdChlNvcdGarPFIa9TkeFadwyO3wYRsBg6WCCe9XbS07jad-QnUx4ET_z2afSIPPycJ4qhQUn28Q3izBg0WCCWOiwEyVYTMe6quGkTBNv1ULfh3Ymkq2fUKwtdrKvWVgJYIMzirj9xLIzRVBBd6m2S_D4djAOJvfgEkbGuT3a5Vy7lGCVYIA7NpE_RLoHArQEgS10Oxyb66q6fVYzCfnaK8hq4_XROGDlYINjnDBwlHFpd2jUQcN9gvF1x7wUTJ6o0sV6zSIPNMR99EFgg7gPO4i3qK_6Knqk8pGunyK9peWZ8dWoy3RAW5I_VNoltZGV2aWNlS2V5SW5mb6FpZGV2aWNlS2V5pAECIAEhWCD3Po2C1fy6lR42h5pgc3fpLkQ_0SjE3ut-Bf1HDA9hvSJYIFqsA8JUONmJo81dBTBq4YiEqw9yz_-ayiW9GUazOePLbHZhbGlkaXR5SW5mb6Nmc2lnbmVkwHQyMDI1LTA0LTA5VDA5OjE2OjE0Wml2YWxpZEZyb23AdDIwMjUtMDQtMDlUMDk6MTY6MTRaanZhbGlkVW50aWzAdDIwMjUtMDUtMDlUMDk6MTY6MTRaZnN0YXR1c6Frc3RhdHVzX2xpc3SjY2lkeAxjdXJpeFFodHRwczovL3ByZGN2LW1zb3Jldm9jYXRpb24tc3RhdHVzbGlzdHMuczMuZXUtY2VudHJhbC0xLmFtYXpvbmF3cy5jb20vc3RhdHVzMS5jd3RrY2VydGlmaWNhdGVZAj0wggI5MIIBv6ADAgECAhQSZemtJ-Kjc9gCk9N25XcHI1xnpDAKBggqhkjOPQQDAzAmMRcwFQYDVQQDDA5QYW5hc29uaWMgSUFDQTELMAkGA1UEBhMCSlAwHhcNMjUwMjE1MDIwOTQyWhcNMzAwNjE4MDIwOTQxWjAmMRcwFQYDVQQDDA5QYW5hc29uaWMgSUFDQTELMAkGA1UEBhMCSlAwdjAQBgcqhkjOPQIBBgUrgQQAIgNiAAQ6ImCd4mrop3EHskDxaOTID5OZkUv3Kv3EbCyfVrhudJ7GA0HB-J2qNbjvoZSWbiKF992WzLwmSvB2U0fEonIvTPQi2aN-FT74QscslWGaBeeIjtPG1dh4BNjXSjLAKiCjga0wgaowEgYDVR0TAQH_BAgwBgEB_wIBADAqBgNVHRIEIzAhhh9odHRwczovL21kb2MucGFuYXNvbmljLmdvdi9tZG9jMDkGA1UdHwQyMDAwLqAsoCqGKGh0dHBzOi8vbWRvYy5wYW5hc29uaWMuZ292L0NSTHMvbWRvYy5jcmwwHQYDVR0OBBYEFIXz6R7leI5PpKPIhulNN1EpBi8wMA4GA1UdDwEB_wQEAwIBBjAKBggqhkjOPQQDAwNoADBlAjAMZzPMrON0hPLnL_LsLdSgUiF8swVgg_8iOvs6YD01sSqK9dtxuHruAItpxk_F828CMQCJ2uzzf0M3Qmj-lQJ_4W8IiqBTud2jYr6uUEB81s5xXXUKSDVGhJv89-1_DTicByJYQPjIJvRz-3lsEeqyVAh_05W7H7ovOSAcusDIQcuQq0wO11KEU7Cz_6pQ49hKiZOmpU38Mfk3ee6EbwI1WAvU4lVsZGV2aWNlU2lnbmVkompuYW1lU3BhY2Vz2BhBoGpkZXZpY2VBdXRooW9kZXZpY2VTaWduYXR1cmWEQ6EBJqD2WECIQA1r9B6cqQOVnDl9fVJwk5oRIZ62p7EoLWoKlyJDlZEDwjBt10y95K2OkW3mzNF2KLpBknRyX0KwZNRW_x_Go2dkb2NUeXBld2V1LmV1cm9wYS5lYy5ldWRpLnBpZC4xbGlzc3VlclNpZ25lZKJqbmFtZVNwYWNlc6F3ZXUuZXVyb3BhLmVjLmV1ZGkucGlkLjGC2BhYWqRoZGlnZXN0SUQYGmZyYW5kb21Q1YSWDmsS79W2Wc4yJWlZ3HFlbGVtZW50SWRlbnRpZmllcmtmYW1pbHlfbmFtZWxlbGVtZW50VmFsdWVqTXVzdGVybWFubtgYWFOkaGRpZ2VzdElECmZyYW5kb21QsrbGD64sRwj7_g_2g6fGVnFlbGVtZW50SWRlbnRpZmllcmpnaXZlbl9uYW1lbGVsZW1lbnRWYWx1ZWVFcmlrYWppc3N1ZXJBdXRohEOhASahGCFZAkMwggI_MIIBxKADAgECAhQMUvEHyYecwWPL8gZJAf7JfNnxRTAKBggqhkjOPQQDAzAmMRcwFQYDVQQDDA5QYW5hc29uaWMgSUFDQTELMAkGA1UEBhMCSlAwHhcNMjUwMjE1MDIzODM5WhcNMjUwNjE3MDIzODM4WjAkMRUwEwYDVQQDDAxQYW5hc29uaWMgRFMxCzAJBgNVBAYTAkpQMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEgpOS_oKDpnxaQScHHejq1wxpbtOv0ocR_ByWd5QpPumoJwS7g-MZoHye8SnxJtsSBcurgVZ0VultChK9Pd3eaqOB0TCBzjAfBgNVHSMEGDAWgBSF8-ke5XiOT6SjyIbpTTdRKQYvMDAVBgNVHSUBAf8ECzAJBgcogYxdBQECMDkGA1UdHwQyMDAwLqAsoCqGKGh0dHBzOi8vbWRvYy5wYW5hc29uaWMuZ292L0NSTHMvbWRvYy5jcmwwHQYDVR0OBBYEFIaR9JQORnhTgGNlRhfVL1KvGYGdMA4GA1UdDwEB_wQEAwIHgDAqBgNVHRIEIzAhhh9odHRwczovL21kb2MucGFuYXNvbmljLmdvdi9tZG9jMAoGCCqGSM49BAMDA2kAMGYCMQCuykFQmp6OGghVhm74fxdpWmSJdeVWOV58sGfMuBmbr7g9vzIIIW36XSwKO8c7RRQCMQC-8rvqNNY1lhf-nWyY9e0Z4ZW3mhGJnd_5LbC8QNClIbONplfjMj0S2rYVsUu8e5lZB7PYGFkHrqdndmVyc2lvbmMxLjBvZGlnZXN0QWxnb3JpdGhtZ1NIQS0yNTZnZG9jVHlwZXdldS5ldXJvcGEuZWMuZXVkaS5waWQuMWx2YWx1ZURpZ2VzdHOhd2V1LmV1cm9wYS5lYy5ldWRpLnBpZC4xuBsYGlggpMCxCPLrqGLVEOvYM0IQHu6-rNwHfZwXGNLOIT0hlasKWCBaqh4DdCQ6qxSRZG79jmsheukZ77t-5hd9q7om6lZvqBgYWCDlbxr826w78LujTnFHCv-6B7OsOpPzvH-L--f3z81oRhFYIFqvcccf8kDiuByS0vvvuAj5Nsf7Zs-EOiUjjSWE9rp9GBlYIOYMba1OBnqKF8YALj3fnfKTP1qPt7lYPi1luwD-MquRFVggswNmRoOVnAoKBv6J2vLk27PYFIM3FzkRXHJJ2AUOjqIFWCBuaMIWwBqUJfCTsJce4rIYwRwozqrYXTI3jLkD-47itQFYIGKi0ZtMLhiUFfghwO8V4Z9UpaNFLpbmIzT4WQtPNuzRFlggesM-LYdOipSWHOjF13XhJums8c8McPZNf_xd8TJSUj8TWCBLIl1Ym8OAD_BLZKerpFwow391z-v75m7yfj2j5TUvRAdYILjg_INbPVxje4ZxeRFjROaIb_SJZDN44z4DQFZ5vB-9CFggo4SZsazSEAYGV6qvdjyCHyIrwo6EvSSdjPDeg3PCyWYOWCC723cUlQkKRgnEtGPqtLpQvWc9Latbn-DI77vblmIvRBdYIFUBLC0JDTbhcNzZgufFkKKwxSkib2z1spSbwPp5lCsqC1ggbg4a-ENrKt1_OCH8b49Bbu6Bk873VxD4G9Ct7dZI5HEPWCDvH91FS5Ue2V5b8N4w6-D1XV5WkbshtW_oCOckj5YwDAZYIPgG6o78Fg6_g3BuLoDA32yM1Z6lgVzOWZB1xuX3mv4SDVggnRpMJNGRuHAIDJMBgQCPoHON3ZTwtYy9zhbvDZ2bdvIMWCA32wgoYuiv6lSmWQFGBmF2UcgXusJCtZDMYxoEdbtVdgJYIFcRIfPZ5lyBAwpV5I6FOoTbQlatHgvYMGOaKMPyiSlAA1gg29GgABR8vXwjp6Z1EJaGUH5pQNOkVJXGdTGXJJLfEx8QWCCitLkmm1zVOL4dRKmZGZMcCemj8t-pP5jpiJ_g2XLdtglYIIUHgvXvZkGSn6cRxJbVAF4UlXO_lzD3DMtNwlBSuBWpBFggGSB9uF6Jd41SQtBb2N0AOwjKNqkelh8dmjX5--7X3f0AWCC2JfDKnjCG4kV7HYlKIfa1dsV65bZ7C8qEWl_jw13jXhJYIEVymRECA89Vrp1RDz8B2LtL__733vK7_TFlxy_pkZ2gFFggaV5smOmzn8nxXKdOJOZ_vDlnelzIA30TDyjsc7GcC4ttZGV2aWNlS2V5SW5mb6FpZGV2aWNlS2V5pAECIAEhWCBsGaolq6lxU1spYc6-9GuI-QxxTk8p0Y0kAPhxSKMF7iJYIBZ4LDxFG1GK1vI4DN8Or0wVOv--v3hvgJeWvXglS3fvbHZhbGlkaXR5SW5mb6Nmc2lnbmVkwHQyMDI1LTA0LTA5VDA5OjE2OjI0Wml2YWxpZEZyb23AdDIwMjUtMDQtMDlUMDk6MTY6MjRaanZhbGlkVW50aWzAdDIwMjUtMDUtMDlUMDk6MTY6MjRaZnN0YXR1c6Frc3RhdHVzX2xpc3SjY2lkeAxjdXJpeFFodHRwczovL3ByZGN2LW1zb3Jldm9jYXRpb24tc3RhdHVzbGlzdHMuczMuZXUtY2VudHJhbC0xLmFtYXpvbmF3cy5jb20vc3RhdHVzMS5jd3RrY2VydGlmaWNhdGVZAj0wggI5MIIBv6ADAgECAhQSZemtJ-Kjc9gCk9N25XcHI1xnpDAKBggqhkjOPQQDAzAmMRcwFQYDVQQDDA5QYW5hc29uaWMgSUFDQTELMAkGA1UEBhMCSlAwHhcNMjUwMjE1MDIwOTQyWhcNMzAwNjE4MDIwOTQxWjAmMRcwFQYDVQQDDA5QYW5hc29uaWMgSUFDQTELMAkGA1UEBhMCSlAwdjAQBgcqhkjOPQIBBgUrgQQAIgNiAAQ6ImCd4mrop3EHskDxaOTID5OZkUv3Kv3EbCyfVrhudJ7GA0HB-J2qNbjvoZSWbiKF992WzLwmSvB2U0fEonIvTPQi2aN-FT74QscslWGaBeeIjtPG1dh4BNjXSjLAKiCjga0wgaowEgYDVR0TAQH_BAgwBgEB_wIBADAqBgNVHRIEIzAhhh9odHRwczovL21kb2MucGFuYXNvbmljLmdvdi9tZG9jMDkGA1UdHwQyMDAwLqAsoCqGKGh0dHBzOi8vbWRvYy5wYW5hc29uaWMuZ292L0NSTHMvbWRvYy5jcmwwHQYDVR0OBBYEFIXz6R7leI5PpKPIhulNN1EpBi8wMA4GA1UdDwEB_wQEAwIBBjAKBggqhkjOPQQDAwNoADBlAjAMZzPMrON0hPLnL_LsLdSgUiF8swVgg_8iOvs6YD01sSqK9dtxuHruAItpxk_F828CMQCJ2uzzf0M3Qmj-lQJ_4W8IiqBTud2jYr6uUEB81s5xXXUKSDVGhJv89-1_DTicByJYQAD9O_jyPB16JTnfHzmcL9avHP2SE3aiZXNLhkMAtxtwsNhrewkLPyz7hxWpbdW8KmbUI19Z_K8bRbQRanxYzaRsZGV2aWNlU2lnbmVkompuYW1lU3BhY2Vz2BhBoGpkZXZpY2VBdXRooW9kZXZpY2VTaWduYXR1cmWEQ6EBJqD2WEAbIUKrOTg0hHon6NklvLaIKeEZfCLf5NfGBeyPE4CTXbqxvUL4iPjCbdWWXli-QrKaTjiJgQLb-TlNuf-YVVTmZnN0YXR1cwA'
      ),
      {
        definition_id: 'random',
        descriptor_map: [
          {
            format: 'mso_mdoc',
            id: 'eu.europa.ec.eudi.pid.1',
            path: '$',
          },
          {
            format: 'mso_mdoc',
            id: 'org.iso.18013.5.1.mDL',
            path: '$',
          },
        ],
        id: 'something',
      }
    )
  })

  test('handles invalid response with multiple mdocs in a single device response', async () => {
    expect(() =>
      pexService.validatePresentation(
        {
          id: 'random',
          input_descriptors: [
            {
              id: 'org.iso.18013.5.1.mDL',
              format: {
                mso_mdoc: {
                  alg: ['ES256'],
                },
              },
              constraints: {
                fields: [
                  {
                    path: ["$['org.iso.18013.5.1']['given_name']"],
                    intent_to_retain: false,
                  },
                ],
                limit_disclosure: 'required',
              },
            },
            {
              id: 'eu.europa.ec.eudi.pid.1',
              format: {
                mso_mdoc: {
                  alg: ['ES256'],
                },
              },
              constraints: {
                fields: [
                  {
                    // Key name does not match
                    path: ["$['eu.europa.ec.eudi.pid.1']['family_name22']"],
                    intent_to_retain: false,
                  },
                ],
                limit_disclosure: 'required',
              },
            },
          ],
        },
        MdocDeviceResponse.fromBase64Url(
          'o2d2ZXJzaW9uYzEuMGlkb2N1bWVudHOCo2dkb2NUeXBldW9yZy5pc28uMTgwMTMuNS4xLm1ETGxpc3N1ZXJTaWduZWSiam5hbWVTcGFjZXOhcW9yZy5pc28uMTgwMTMuNS4xgtgYWFOkaGRpZ2VzdElEE2ZyYW5kb21Q4UfVHznACC2C95ORlY-G23FlbGVtZW50SWRlbnRpZmllcmpnaXZlbl9uYW1lbGVsZW1lbnRWYWx1ZWVFcmlrYdgYWFqkaGRpZ2VzdElEGCdmcmFuZG9tUJWFQuwvUIV2n8J8njlewT9xZWxlbWVudElkZW50aWZpZXJrZmFtaWx5X25hbWVsZWxlbWVudFZhbHVlak11c3Rlcm1hbm5qaXNzdWVyQXV0aIRDoQEmoRghWQJDMIICPzCCAcSgAwIBAgIUDFLxB8mHnMFjy_IGSQH-yXzZ8UUwCgYIKoZIzj0EAwMwJjEXMBUGA1UEAwwOUGFuYXNvbmljIElBQ0ExCzAJBgNVBAYTAkpQMB4XDTI1MDIxNTAyMzgzOVoXDTI1MDYxNzAyMzgzOFowJDEVMBMGA1UEAwwMUGFuYXNvbmljIERTMQswCQYDVQQGEwJKUDBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABIKTkv6Cg6Z8WkEnBx3o6tcMaW7Tr9KHEfwclneUKT7pqCcEu4PjGaB8nvEp8SbbEgXLq4FWdFbpbQoSvT3d3mqjgdEwgc4wHwYDVR0jBBgwFoAUhfPpHuV4jk-ko8iG6U03USkGLzAwFQYDVR0lAQH_BAswCQYHKIGMXQUBAjA5BgNVHR8EMjAwMC6gLKAqhihodHRwczovL21kb2MucGFuYXNvbmljLmdvdi9DUkxzL21kb2MuY3JsMB0GA1UdDgQWBBSGkfSUDkZ4U4BjZUYX1S9SrxmBnTAOBgNVHQ8BAf8EBAMCB4AwKgYDVR0SBCMwIYYfaHR0cHM6Ly9tZG9jLnBhbmFzb25pYy5nb3YvbWRvYzAKBggqhkjOPQQDAwNpADBmAjEArspBUJqejhoIVYZu-H8XaVpkiXXlVjlefLBnzLgZm6-4Pb8yCCFt-l0sCjvHO0UUAjEAvvK76jTWNZYX_p1smPXtGeGVt5oRiZ3f-S2wvEDQpSGzjaZX4zI9Etq2FbFLvHuZWQzU2BhZDM-nZ3ZlcnNpb25jMS4wb2RpZ2VzdEFsZ29yaXRobWdTSEEtMjU2Z2RvY1R5cGV1b3JnLmlzby4xODAxMy41LjEubURMbHZhbHVlRGlnZXN0c6Jxb3JnLmlzby4xODAxMy41LjG4LBgnWCB6saB7hlK2EeykYwjZGmyZsbdi5El6gh0gHL2YDezDAxNYIIKn9I9zTq9V8BOGb9N7DscNj534Gd8qseZVYLVYz4drGCxYINVQxuaQuzPN-DYGnb8v4a-4YXU3CcPZ-sgZYj2PxfHhDVgg9AxPlVfbmoeQXJOpU4SmVc1w27XMxborcpsHohpDslwAWCBwK_m_a0mIG8x8efhS3UNmWFG7gKDeyy-SlK_PA5CUVRJYIDpsOCtM-lP72Bbz19ERDqibf356ftB5jAKmFiCd4vrPGC5YIPF4uWsnZwRYzGsPn2oUZLsVraecQSPbpSWzx5JdVxz1GDtYIJs610ro1jUN5X5TZHI1PwGo050OFmw-x4eGfJxeo-WAD1gg31NhmF3nyWGnoW3hSOTCrLh1bfjirYyAlhCxTz5HbrgYG1gg6SzB16Th8-rRgaM5jArWOFDB_eVvC3v6Bh5mEJZeC-kYH1ggXypmMFtYpjKCnA5OVRztyxfQV1Nz7T9kvSugBY-KR44OWCBhi3ZNcZF2Q-hWIYismtEu-j-KrywqXeLe5n-l4mOlvRgqWCBAxW0XyWXAg5v6N7ZVYWsQPFwGMhD6kLRGO93K6tpOKhVYICazH32afpmDNGDNQH5iJes0gN67mQqVP7Ko5j1ehvTeGC9YIL7CuUPZt71T0JZnALPLrzdRSzKNrierzBEGJgGCm64XDFgga8iElmC8dqeucT0FIVFCuS4eGMAtwCMUWGsWfgN8KpIYHFggX4EYOnP28xJtaJCz5qcEfZhcMx3WpKpVnuhCnxtWVNoIWCC-plqpjzCq-71Ovy3BpqdqQ6GwJNXHg8iB0rolKOuEbRgdWCC8baoAP7csHk3222_PlURDDK6L7GAWOcDXB1fqz0z2cQpYILX_GTVUyeVgcAerf7CsWvSPjkXzibmyXVHBi1Ovyva7EVggYcDim6qvlq_g7073r_UsN0SYLJLjSiro0K4qBZik0WYYMlggOEylD7okqt6RTW8JT0-oSF6DhWj_X1Rrpl4VJfhagPUYNlgg_MEm1PVnYAINigvP6t9-IW-D8p0tzJNd4tAg-gXvHVwYJlgg17sc9ZGMsizR8m-r9eie0th_59WvSpDRZs4Xd3wv-yoYLVggKtrNGpXZ3lZ2f5TbUKsg_I6UcKFVu_LPUmI0oAsaaN4YGVggTK0MC7h3_ks2gde6ZCo31rFXLY8syyhEZ3giaWm3qMILWCBduv8FuJVrwYyS3tnYybqQOt3p-vNjE4oroL--qMGzeBdYIAbOjSU-LslPy0L2QEXT2CmxLcL8vU9wJeIBolgtcKoPGB5YIDGsgmliLTlkl0IZyLMMk8siFr1oVxw6ztmOT1EhisGTGDNYIClO5x0QDZ99Ss9ZNVQd4EueLQEc8g4rXLJ0ZNdsd9lhGCRYIDk4GaNf8EiZrTxN5sfJll-EV8I-8Iios3rqH96cXXe9FFgg6rD_L4VPk-LsZBFAHgxgiawN9LQ-A1jUckYvi5jATKoYPVggOW7Xmsv8rhNOVS9wmCKp2-KOI0W39LTU1OQshcBBaq0YMFggCN-g2RcrlHkbbX9cJO5ivkc2Odyd7gPp3pDOSp3QKD8YK1gg8lX4aTc65OpTceQvZjOLcqGK1-FCp2KA4r8MQ9AQDgwYI1ggpGXcJLMh4PZD7x6dHxXEvYU8xWdYSIE4TMu8qxWHfOsYMVggxuqRPatXWacS3z-I0A-0mM2t7MYmEae7vnrhqOY6Lw4YGlggtfi_zYUi3IpP-UliESnUn99W724Dd1GKDWm8o-98ND0HWCAmbtsNzfSant4AC6TCBtS1kz3pFsCArSAcd7PJiRZUIRgiWCBE-bAQ357qRW5gLX96wzXPfB7edhPZIz-O18753o_p5gFYIA2mZSXR2tIrIaQCMN3x7kQL41aad93gmXQW8k3B26a3GDVYILDSmFT55xF5295NSoJ0eLp6CQvsLtL2oM3ccno4a7riGD5YIHdPsX_8oWkA99oyXmVeE8ZLIVZ1YQQwjWPyhS3TgpLVGBhYIDE5202b_1yOSBvKt06nsXaDCKsz6c2M2CAYa_W3CeGxd29yZy5pc28uMTgwMTMuNS4xLmFhbXZhswVYIA6cntt603dG-w91OSsv-j7z_Y4-JQANB85np9qAJdOPGClYIB5HnT6GvzsIotPPovUGEG48Zap4C1ecEGoTr6FLqmcCGDhYIEbEwf07GrRyd_a6Uph3rICMwoYqTchSlTcBcaoNy8uSGDxYIEl_56EYAUKgKd4RV8let7P5MQwDQ09KNAdkhJbIpfCQCVggsKK_ysVODzOyrUwRF15OenIFt622oUieCuDbXeeCJ3EWWCDrf_oKvuXuzJ8jcZo_67rZW2fphfpKAc9Tfzu2xwxdeBggWCBaTwR_K3vLUwezXWi54xNVAEbuUpmEo3-BE3gf6Y6wwBg3WCBkqBFWNStfElNNkscqIcc11lABlutHWNgwfF8dCixDJQZYINeqesfYofU5NHBqgL8b92dY4BxX1IAcKboJUQLDgjqlGChYILwZn-_93OybOROl2V2ArfcwERaSVQXju_Rl2Wps-qOBA1gg4ehfNKqnuRYJ1gW-1D5gOF9rYLlPR1kGpBRhH4tZQacYIVggL2xWR964Dyp1rgYSVhb8XPeH9V41T3DcG8vFj8mpyMUEWCC1H53yNkBNRujdChlNvcdGarPFIa9TkeFadwyO3wYRsBg6WCCe9XbS07jad-QnUx4ET_z2afSIPPycJ4qhQUn28Q3izBg0WCCWOiwEyVYTMe6quGkTBNv1ULfh3Ymkq2fUKwtdrKvWVgJYIMzirj9xLIzRVBBd6m2S_D4djAOJvfgEkbGuT3a5Vy7lGCVYIA7NpE_RLoHArQEgS10Oxyb66q6fVYzCfnaK8hq4_XROGDlYINjnDBwlHFpd2jUQcN9gvF1x7wUTJ6o0sV6zSIPNMR99EFgg7gPO4i3qK_6Knqk8pGunyK9peWZ8dWoy3RAW5I_VNoltZGV2aWNlS2V5SW5mb6FpZGV2aWNlS2V5pAECIAEhWCD3Po2C1fy6lR42h5pgc3fpLkQ_0SjE3ut-Bf1HDA9hvSJYIFqsA8JUONmJo81dBTBq4YiEqw9yz_-ayiW9GUazOePLbHZhbGlkaXR5SW5mb6Nmc2lnbmVkwHQyMDI1LTA0LTA5VDA5OjE2OjE0Wml2YWxpZEZyb23AdDIwMjUtMDQtMDlUMDk6MTY6MTRaanZhbGlkVW50aWzAdDIwMjUtMDUtMDlUMDk6MTY6MTRaZnN0YXR1c6Frc3RhdHVzX2xpc3SjY2lkeAxjdXJpeFFodHRwczovL3ByZGN2LW1zb3Jldm9jYXRpb24tc3RhdHVzbGlzdHMuczMuZXUtY2VudHJhbC0xLmFtYXpvbmF3cy5jb20vc3RhdHVzMS5jd3RrY2VydGlmaWNhdGVZAj0wggI5MIIBv6ADAgECAhQSZemtJ-Kjc9gCk9N25XcHI1xnpDAKBggqhkjOPQQDAzAmMRcwFQYDVQQDDA5QYW5hc29uaWMgSUFDQTELMAkGA1UEBhMCSlAwHhcNMjUwMjE1MDIwOTQyWhcNMzAwNjE4MDIwOTQxWjAmMRcwFQYDVQQDDA5QYW5hc29uaWMgSUFDQTELMAkGA1UEBhMCSlAwdjAQBgcqhkjOPQIBBgUrgQQAIgNiAAQ6ImCd4mrop3EHskDxaOTID5OZkUv3Kv3EbCyfVrhudJ7GA0HB-J2qNbjvoZSWbiKF992WzLwmSvB2U0fEonIvTPQi2aN-FT74QscslWGaBeeIjtPG1dh4BNjXSjLAKiCjga0wgaowEgYDVR0TAQH_BAgwBgEB_wIBADAqBgNVHRIEIzAhhh9odHRwczovL21kb2MucGFuYXNvbmljLmdvdi9tZG9jMDkGA1UdHwQyMDAwLqAsoCqGKGh0dHBzOi8vbWRvYy5wYW5hc29uaWMuZ292L0NSTHMvbWRvYy5jcmwwHQYDVR0OBBYEFIXz6R7leI5PpKPIhulNN1EpBi8wMA4GA1UdDwEB_wQEAwIBBjAKBggqhkjOPQQDAwNoADBlAjAMZzPMrON0hPLnL_LsLdSgUiF8swVgg_8iOvs6YD01sSqK9dtxuHruAItpxk_F828CMQCJ2uzzf0M3Qmj-lQJ_4W8IiqBTud2jYr6uUEB81s5xXXUKSDVGhJv89-1_DTicByJYQPjIJvRz-3lsEeqyVAh_05W7H7ovOSAcusDIQcuQq0wO11KEU7Cz_6pQ49hKiZOmpU38Mfk3ee6EbwI1WAvU4lVsZGV2aWNlU2lnbmVkompuYW1lU3BhY2Vz2BhBoGpkZXZpY2VBdXRooW9kZXZpY2VTaWduYXR1cmWEQ6EBJqD2WECIQA1r9B6cqQOVnDl9fVJwk5oRIZ62p7EoLWoKlyJDlZEDwjBt10y95K2OkW3mzNF2KLpBknRyX0KwZNRW_x_Go2dkb2NUeXBld2V1LmV1cm9wYS5lYy5ldWRpLnBpZC4xbGlzc3VlclNpZ25lZKJqbmFtZVNwYWNlc6F3ZXUuZXVyb3BhLmVjLmV1ZGkucGlkLjGC2BhYWqRoZGlnZXN0SUQYGmZyYW5kb21Q1YSWDmsS79W2Wc4yJWlZ3HFlbGVtZW50SWRlbnRpZmllcmtmYW1pbHlfbmFtZWxlbGVtZW50VmFsdWVqTXVzdGVybWFubtgYWFOkaGRpZ2VzdElECmZyYW5kb21QsrbGD64sRwj7_g_2g6fGVnFlbGVtZW50SWRlbnRpZmllcmpnaXZlbl9uYW1lbGVsZW1lbnRWYWx1ZWVFcmlrYWppc3N1ZXJBdXRohEOhASahGCFZAkMwggI_MIIBxKADAgECAhQMUvEHyYecwWPL8gZJAf7JfNnxRTAKBggqhkjOPQQDAzAmMRcwFQYDVQQDDA5QYW5hc29uaWMgSUFDQTELMAkGA1UEBhMCSlAwHhcNMjUwMjE1MDIzODM5WhcNMjUwNjE3MDIzODM4WjAkMRUwEwYDVQQDDAxQYW5hc29uaWMgRFMxCzAJBgNVBAYTAkpQMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEgpOS_oKDpnxaQScHHejq1wxpbtOv0ocR_ByWd5QpPumoJwS7g-MZoHye8SnxJtsSBcurgVZ0VultChK9Pd3eaqOB0TCBzjAfBgNVHSMEGDAWgBSF8-ke5XiOT6SjyIbpTTdRKQYvMDAVBgNVHSUBAf8ECzAJBgcogYxdBQECMDkGA1UdHwQyMDAwLqAsoCqGKGh0dHBzOi8vbWRvYy5wYW5hc29uaWMuZ292L0NSTHMvbWRvYy5jcmwwHQYDVR0OBBYEFIaR9JQORnhTgGNlRhfVL1KvGYGdMA4GA1UdDwEB_wQEAwIHgDAqBgNVHRIEIzAhhh9odHRwczovL21kb2MucGFuYXNvbmljLmdvdi9tZG9jMAoGCCqGSM49BAMDA2kAMGYCMQCuykFQmp6OGghVhm74fxdpWmSJdeVWOV58sGfMuBmbr7g9vzIIIW36XSwKO8c7RRQCMQC-8rvqNNY1lhf-nWyY9e0Z4ZW3mhGJnd_5LbC8QNClIbONplfjMj0S2rYVsUu8e5lZB7PYGFkHrqdndmVyc2lvbmMxLjBvZGlnZXN0QWxnb3JpdGhtZ1NIQS0yNTZnZG9jVHlwZXdldS5ldXJvcGEuZWMuZXVkaS5waWQuMWx2YWx1ZURpZ2VzdHOhd2V1LmV1cm9wYS5lYy5ldWRpLnBpZC4xuBsYGlggpMCxCPLrqGLVEOvYM0IQHu6-rNwHfZwXGNLOIT0hlasKWCBaqh4DdCQ6qxSRZG79jmsheukZ77t-5hd9q7om6lZvqBgYWCDlbxr826w78LujTnFHCv-6B7OsOpPzvH-L--f3z81oRhFYIFqvcccf8kDiuByS0vvvuAj5Nsf7Zs-EOiUjjSWE9rp9GBlYIOYMba1OBnqKF8YALj3fnfKTP1qPt7lYPi1luwD-MquRFVggswNmRoOVnAoKBv6J2vLk27PYFIM3FzkRXHJJ2AUOjqIFWCBuaMIWwBqUJfCTsJce4rIYwRwozqrYXTI3jLkD-47itQFYIGKi0ZtMLhiUFfghwO8V4Z9UpaNFLpbmIzT4WQtPNuzRFlggesM-LYdOipSWHOjF13XhJums8c8McPZNf_xd8TJSUj8TWCBLIl1Ym8OAD_BLZKerpFwow391z-v75m7yfj2j5TUvRAdYILjg_INbPVxje4ZxeRFjROaIb_SJZDN44z4DQFZ5vB-9CFggo4SZsazSEAYGV6qvdjyCHyIrwo6EvSSdjPDeg3PCyWYOWCC723cUlQkKRgnEtGPqtLpQvWc9Latbn-DI77vblmIvRBdYIFUBLC0JDTbhcNzZgufFkKKwxSkib2z1spSbwPp5lCsqC1ggbg4a-ENrKt1_OCH8b49Bbu6Bk873VxD4G9Ct7dZI5HEPWCDvH91FS5Ue2V5b8N4w6-D1XV5WkbshtW_oCOckj5YwDAZYIPgG6o78Fg6_g3BuLoDA32yM1Z6lgVzOWZB1xuX3mv4SDVggnRpMJNGRuHAIDJMBgQCPoHON3ZTwtYy9zhbvDZ2bdvIMWCA32wgoYuiv6lSmWQFGBmF2UcgXusJCtZDMYxoEdbtVdgJYIFcRIfPZ5lyBAwpV5I6FOoTbQlatHgvYMGOaKMPyiSlAA1gg29GgABR8vXwjp6Z1EJaGUH5pQNOkVJXGdTGXJJLfEx8QWCCitLkmm1zVOL4dRKmZGZMcCemj8t-pP5jpiJ_g2XLdtglYIIUHgvXvZkGSn6cRxJbVAF4UlXO_lzD3DMtNwlBSuBWpBFggGSB9uF6Jd41SQtBb2N0AOwjKNqkelh8dmjX5--7X3f0AWCC2JfDKnjCG4kV7HYlKIfa1dsV65bZ7C8qEWl_jw13jXhJYIEVymRECA89Vrp1RDz8B2LtL__733vK7_TFlxy_pkZ2gFFggaV5smOmzn8nxXKdOJOZ_vDlnelzIA30TDyjsc7GcC4ttZGV2aWNlS2V5SW5mb6FpZGV2aWNlS2V5pAECIAEhWCBsGaolq6lxU1spYc6-9GuI-QxxTk8p0Y0kAPhxSKMF7iJYIBZ4LDxFG1GK1vI4DN8Or0wVOv--v3hvgJeWvXglS3fvbHZhbGlkaXR5SW5mb6Nmc2lnbmVkwHQyMDI1LTA0LTA5VDA5OjE2OjI0Wml2YWxpZEZyb23AdDIwMjUtMDQtMDlUMDk6MTY6MjRaanZhbGlkVW50aWzAdDIwMjUtMDUtMDlUMDk6MTY6MjRaZnN0YXR1c6Frc3RhdHVzX2xpc3SjY2lkeAxjdXJpeFFodHRwczovL3ByZGN2LW1zb3Jldm9jYXRpb24tc3RhdHVzbGlzdHMuczMuZXUtY2VudHJhbC0xLmFtYXpvbmF3cy5jb20vc3RhdHVzMS5jd3RrY2VydGlmaWNhdGVZAj0wggI5MIIBv6ADAgECAhQSZemtJ-Kjc9gCk9N25XcHI1xnpDAKBggqhkjOPQQDAzAmMRcwFQYDVQQDDA5QYW5hc29uaWMgSUFDQTELMAkGA1UEBhMCSlAwHhcNMjUwMjE1MDIwOTQyWhcNMzAwNjE4MDIwOTQxWjAmMRcwFQYDVQQDDA5QYW5hc29uaWMgSUFDQTELMAkGA1UEBhMCSlAwdjAQBgcqhkjOPQIBBgUrgQQAIgNiAAQ6ImCd4mrop3EHskDxaOTID5OZkUv3Kv3EbCyfVrhudJ7GA0HB-J2qNbjvoZSWbiKF992WzLwmSvB2U0fEonIvTPQi2aN-FT74QscslWGaBeeIjtPG1dh4BNjXSjLAKiCjga0wgaowEgYDVR0TAQH_BAgwBgEB_wIBADAqBgNVHRIEIzAhhh9odHRwczovL21kb2MucGFuYXNvbmljLmdvdi9tZG9jMDkGA1UdHwQyMDAwLqAsoCqGKGh0dHBzOi8vbWRvYy5wYW5hc29uaWMuZ292L0NSTHMvbWRvYy5jcmwwHQYDVR0OBBYEFIXz6R7leI5PpKPIhulNN1EpBi8wMA4GA1UdDwEB_wQEAwIBBjAKBggqhkjOPQQDAwNoADBlAjAMZzPMrON0hPLnL_LsLdSgUiF8swVgg_8iOvs6YD01sSqK9dtxuHruAItpxk_F828CMQCJ2uzzf0M3Qmj-lQJ_4W8IiqBTud2jYr6uUEB81s5xXXUKSDVGhJv89-1_DTicByJYQAD9O_jyPB16JTnfHzmcL9avHP2SE3aiZXNLhkMAtxtwsNhrewkLPyz7hxWpbdW8KmbUI19Z_K8bRbQRanxYzaRsZGV2aWNlU2lnbmVkompuYW1lU3BhY2Vz2BhBoGpkZXZpY2VBdXRooW9kZXZpY2VTaWduYXR1cmWEQ6EBJqD2WEAbIUKrOTg0hHon6NklvLaIKeEZfCLf5NfGBeyPE4CTXbqxvUL4iPjCbdWWXli-QrKaTjiJgQLb-TlNuf-YVVTmZnN0YXR1cwA'
        ),
        {
          definition_id: 'random',
          descriptor_map: [
            {
              format: 'mso_mdoc',
              id: 'eu.europa.ec.eudi.pid.1',
              path: '$',
            },
            {
              format: 'mso_mdoc',
              id: 'org.iso.18013.5.1.mDL',
              path: '$',
            },
          ],
          id: 'something',
        }
      )
    ).toThrow('Invalid presentation')
  })

  test('validate w3c presentation', () => {
    pexService.validatePresentation(
      {
        id: '5591656f-5b5d-40f8-ab5c-9041c8e3a6a0',
        name: 'Age Verification',
        purpose: 'We need to verify your age before entering a bar',
        input_descriptors: [
          {
            id: 'age-verification',
            name: 'A specific type of VC + Issuer',
            purpose: 'We want a VC of this type generated by this issuer',
            schema: [
              {
                uri: 'https://www.w3.org/2018/credentials/v1',
              },
            ],
            constraints: {
              limit_disclosure: 'required',
              fields: [
                {
                  path: ['$.issuer'],
                  filter: {
                    type: 'string',
                    const: 'did:indy:local:LjgpST2rjsoxYegQDRm7EL',
                  },
                },
                {
                  path: ['$.credentialSubject.name'],
                },
                {
                  path: ['$.credentialSubject.height'],
                },
                {
                  path: ['$.credentialSubject.age'],
                  predicate: 'required',
                  filter: {
                    type: 'number',
                    minimum: 18,
                  },
                },
              ],
            },
          },
        ],
      },
      JsonTransformer.fromJSON(
        {
          '@context': [
            'https://www.w3.org/2018/credentials/v1',
            'https://w3id.org/security/data-integrity/v2',
            {
              '@vocab': 'https://www.w3.org/ns/credentials/issuer-dependent#',
            },
          ],
          type: ['VerifiablePresentation'],
          verifiableCredential: [
            {
              '@context': [
                'https://www.w3.org/2018/credentials/v1',
                'https://w3id.org/security/data-integrity/v2',
                {
                  '@vocab': 'https://www.w3.org/ns/credentials/issuer-dependent#',
                },
              ],
              type: ['VerifiableCredential'],
              issuer: 'did:indy:local:LjgpST2rjsoxYegQDRm7EL',
              credentialSubject: {
                height: 173,
                age: true,
                name: 'John',
              },
              proof: {
                cryptosuite: 'anoncreds-2023',
                type: 'DataIntegrityProof',
                proofPurpose: 'assertionMethod',
                verificationMethod: 'did:indy:local:LjgpST2rjsoxYegQDRm7EL/anoncreds/v0/CLAIM_DEF/82229/default',
                proofValue:
                  'ukgKDqXNjaGVtYV9pZNlpZGlkOmluZHk6bG9jYWw6TGpncFNUMnJqc294WWVnUURSbTdFTC9hbm9uY3JlZHMvdjAvU0NIRU1BL1NjaGVtYSBmZGJlN2NlOS1kYjE1LTQyZjktYTg2My1lOTVhOTgwOWEyMTIvMS4wq2NyZWRfZGVmX2lk2UpkaWQ6aW5keTpsb2NhbDpMamdwU1Qycmpzb3hZZWdRRFJtN0VML2Fub25jcmVkcy92MC9DTEFJTV9ERUYvODIyMjkvZGVmYXVsdKlzdWJfcHJvb2aCrXByaW1hcnlfcHJvb2aCqGVxX3Byb29mhq5yZXZlYWxlZF9hdHRyc4KmaGVpZ2h0kcytpG5hbWXcACDMqMzPzM10zIMgBMyVG0QIzM3MsMylzNvMzcyMflLM1D9_zOJEzL9yBcyCzOBSQczap2FfcHJpbWXcAQECzMfM58yCKwLMwcyQzP_Mqi3Mtl7MwxdfzM7M5TvM83xizJ3MwsyxFjtszKHM8xFONcyROszhSlDM78z5zPHMijfM4czVzIwvzLluzPbM8szVQcyYzNHMnj8lOipNzMTM3MzvWTTMgszLBTJCAkvM-cz7ZMzzzN7MpMyFNMyozPvMpszrdm83SMzTzI_Mkw1nzMxVzK7MqXFqZMzDzP1GzPrMqTTMm8y6zJk3zJ7MzwoNzKNUbMyNdAZfzKjMi8yyzL8zzLg2zKbMlszxzM_MscyIMMy_zKTMvF3MxMyxzNbM7kwqFFISzO7Mrz9kzJ1QbsynzI3M5MzDzMDMhwcczPzMpczHzPbMjMyHbczVzJzM23HM4Cx6AnIQTcz-RUF7asyOe0AUzKw2KczOMcz4zPjMpVDM9MyPbczXzIXM8gHMoXzMshfMlhAzYQTM-cyNzP46zIjM6jDMm3VsF25PzLzMojTMlsyRf8yEzPE9zKnMkl8-Kzd6BMzszLkDAWfM2Xw3zI4Ra6Fl3AA5eTJ6zOTM2AMrzPLM8My4zIHM5lFQFiVYzPJ7c8yWzNTM6isbCQRhzNfMhiHMyGHMlkA4CXsJzJZmzJjM9MynbgQgzN93dsz-PczZLczaEczwoXbcAX8DUcy7zP1uP31xO3N5zOzM3WLMoczezP7MxMzBzNRhEsz0zLdwZcyOF8z1zI7MhMy6zMfMo0HMx3Usd2bMkszZzOTMmAAQzP59zLsBzJbMkszDzIFoEWLMvsz1zJ_MlcyMR2XMicyuKMyIfMyLI1HMlMyeKcy_DMz7zJnMysyCN0rM68znzKVEzNnMxljMtMz_aMzEzNxhC8zcDQgaTcz-zMfMy8zmzNhYzOxrzLV-zKPMvjZbU8zLzPRMzNLMsMyXMMyTPcz9zOpLRW4SzLHM6czrQ2Ioc8zMcyDMr3U4zM8xzLnM7S3Mo8y6zKpPBlIwzLlsKQsyzIDMrsyHzKzM0MzSzIDMr8zbI8yCQC3M6cyDUTJELFJ8zP_Mj8zaNg1lzNHMvW8vzJFGzMsYdHBOzPPM5WzMvszrWiELI8yEbDHMh1fM6wxKzInMoMyuzKpycMzqRiFLzNXMncyoX8zIUMzyzL82Y3dazOHMjCIkFHjMuczWIQ3M9cy_AjpnzIvMzMz5zPLM9MzSXMzKPCNezNPM3Mz8FcyrQnbM7MzmzNfMlszczOrM7kHM1syBzJnM0syrzPHM0AfM81RwTMzAzJHMyxHM58yCTUpOPiVpzJLMqCs4zKBGQCfMjsy2zPTMyczuesykUj7MlszKCmFQzOxxzJDMt8yDVsykXszRFQLM_cyYzIrMpjbMgMznzJNqzK0AJDjM6k3M8syQYDvMjBrMtyskcszcYCrMmknMw8zgW8yOdnJUzK4bzJ3M9cyOzJPM_m3M6KFtg61tYXN0ZXJfc2VjcmV03ABKATHMzMzRzKzMjcy-MczKe8yAXirM_H3MgXLM-8zzPy1WGFw5OU_M_8y9zPslzP1hHWfMn0QoVczeKBTM08ygbHbMiGdMOjZDXToLzLvMpDYeBsyKKGY2zMXMtQPMsjTM8mt0HGiiaWTcAEoBzLFbaczmzKfMvQx3zOrM_8ziS8ytRszGzJDM6AbMq8y9zJ_MpczcM38sCczVGszQQMz8D8z2zJnMhA7Mu8yiGEMTzIJEGszwLMy9dQLM6cyazNDM7EcezOpizM9cS8yrzIDMo8zCK8y7zL_M8TgAV8zVo2FnZdwASszqzKHMzjwPIczsCnjMkszRbE03H2TM7g8pWS3M1MynzK4TzPjMrk5YdmIgzNHM7hXMnEt9M1IuHDYqzO3MtsybzI0WXEkEC8yHzOvMinVYzLTM42AzzNgyzJMHYMy4zIPM6TtrUMylom0y3AEwzJsUzMlocz3MjE9BDgdGzJ8rzIhZLsyazOXM4szRzKR0zPTM80cdeE3Mi1w4I8zfzKIizJVbzL8xzJ9uzJTMjHBaNszhf8ygzMnMiDVeTszqzKnMs8yzzJA0zMPM7MzlzMzM28y7FMyXzLhPzMXM1MyAzJDM5mnM2Myab8yKF0ljzKHM_sy_zMnMjczuzI_M0Mzva8zmIHLMhsyhzO8gzNvM28yPzN0mzLxazMgbzJDMtCQrzO3MqQzM0czzzIMSJGQzzLbM5MygJArM48z7zKzMzi5Afcy0zI5tE8yqzIgazKRBEszwzN_M9syYPmcgzP4bzJl7a8ysUczMDB8cGMyozL9izN3M3gRSDD5kZznM3FQJzIDMpCgtzM_M8MyJzMnMsR1iQMztzM3MqMzQzJnMtsymzMHM_RBZZMyWzIlczOxmzPTMnW7MsxFPZ0pPZTLMmsyAzItBBTjM6cyAX8zGzOvMwxbM2sy_YczozNsdzMYfzOo7J8yczObMxczVVsyeZszkYcyddcyjzIvM9GPM28z_Vw9-zLXMn8z7zI1OCFgUzIFazNjMsszzXszszPwvJMzjzNvMwGrM5TcszOfMlxLMz3YWzJLMnsz0zNtXcBFtzNOpZ2VfcHJvb2ZzkYahdYShMdwASgrM4G0NzNQ_GQnM8syRKEbM7HULJMzpzOZDzJhyzIfMk8zkISwWzPY2EcyszMt6zOZQzP7Mmn0NQ1HMncziK8y7zKHM_cySOMyeY8ysGDPMiXbMu8yQKszUzLlSOl_MoszLzN_MwjvMscyLzLrM6CGhMtwASl8JJXVsCB4MzPAhDxPM4sy7Rz0BXEXM11ZbzK3MhWLMyGfMiczqzPIwzM7M9UXM5My2bnfMugVTbx7MtMyWzOfMlsy1zOVLzMhASy_M28y0DGAmzLlTzMbMpCVnXX7M6cynBsywzNjMlcy1oTDcAEoVzI9HYczzzOR0zJ5VzKBKzIzM5szZNwRCzO_M78zsCczzzL0szIDMiFQdzPrMkMyczN3Mv8yqzMvMw8zHW8zFzNM-ajRdDMzhzLfM5lPMtMy3MgvM_sz4zNkWzKt6zNwoYsywzOTMilI2e3EqIgPM40yhM9wASiwJzPhQzIcAGsyLK31zPmHM9jVKF3ZRXMy0GV3MgMyaMcy3PczbdTAwzJzM_DjM0zPM0mvM9FLMmszFYczOzNkWzLFLD8ylzNMtzKzMyznMxWHMwjFTMMySzN3MtBtkJ03M-nvMuT84oXKFpURFTFRB3AEqGg_Mj8zszNTM91MfCsylzOLMisy7zLzMjcyIzJ7M7n7M9kgBzOXMlcy9GcyOMcz3L8z-dxMPOUTM1sypcn3MmFHMrwPMlEBDPszJzIHMl8zVWxwszK7MpsyyzLpDcczYzOtkZ3TMoszrzJtwzOgxCszTUsz8zMrM1MzAzJM_PVnMlsyYzPwAbszUzNzM_wctfcz_RRPM4czRzK7MqMz0zOnM8xTMrznMv2EqT8y1zJt5zJxdzP3MqMyazLDMysz9zNvMxV1SfMyfzNMzzJlSzLhYzMZIzI8XMABWzLBSzN_M4xvM8n7M9cyfNszrzOLM_syZzJ4gzPEwzLhCzJTMw8ykzMfMpMyfzJrMgVbMoMz9PMyhIcz2zL8lYDFAf8yXRQ8RzL4wzJNqzN1_zL_M_QdrzLFvSczmGszRV0DMpszNzMrM6czabMyNOT09zJNGX8zqzKbM6HM0zPQgNszTRczfKzpbzLxJP0BHzJZtzMIPzM_MlcyRaA_MkczFzMnM3sz6zMwXJ8yhzJZIzI_M28yxzLvM-DzM6sz1zL_Mg3_MiMy6zLtvzO8oZcynasz7DsztzPN7LUHM4UXMsk0GzNLMnszPzNA7zMXMtMyDzOhJoTLcASpHzLbM9MyhzMlNzIkfzJXMx8yXzOnMz250CcyQG37MlAMSzK4ezJQLzLHMwMyazKBuc1PM9QUwzKhia8y_zOQhzOPMgMzuA8zZzIwtzJsTzK_Mk2TM48zrzPQozKAeIVsFzIHM5MzHbcymzMg0PUHM8xbM0VpazMw4zNgvY8y0dcz7GTfM2sz-zJfMm07MyR1yzN5IzN7M0xLMk8yrzN5iTkXMoczXPFx0TMy0zKTM68zXZcyrSETMssyIC0_M6QfMxms6zOjMxszkVszPb8yezLFkzJk2bjHMwS82eszmMVAFb8zFzItyzNM0PS9rCh8cWczrzNdLzPzMxMzazKgjzMsnAC0mzN_Mj8zqYGdkzK8izPt6TgUNzIgKG3DM48zCYX_M8UrMkMzBQSR7BiLM1V_MtANZexDMkcyszP3M2szje8zIzIU-zIXMx8yIY1LMkMySIGo6zMfM9S7MvczZUwhzST9QzMQwfMzRzIQpJjRDzIjMln_M4TxOS8yxfsyhzIHM-hNPzPE8enjM-h87P8ykAsy8zO9SDczHzNRUWsyazIXMnMzDzJDM1DVHzJHMq2fMuMyzQqEz3AEqH3nM1lXMrsyPzKHM0sz1zPxQQcyLzKjM62pRzM3M63gCzPvMlMyDCcyaUXDMmsyWfHESzOTM4jQrMUgOzKDMj8yczPvM6MykGyFXzPBtzPNvKg7Mq3fMicy_zMAYajLMiArMqczZRMzuzOrM9iPMmV17zOHM2cy3AMy3Lsy5AGbM_Mz6zLtLzJ_MxczxzKHMmRsHLMzCzM7Mw2Y0zITMsEFPzIHM4jzMlMzBX2RKFjHMi8zJzPkIPsyjzMgkzMk1OcyZzLA9QTIzZXUYV8yJzLXM6My0zP7M58z8Zx42LcyZzL0tXgUDzIvMmsyCzIXM28zuzL44dMzDa8zSWALMoczrYlHMkMzOKcyLXsy_zPNNzPs2zJTMs8zTzODM7cyCU0_MhczAC8zZSG5kQsybURs6zKojdcyezMAxacytzLxaP0NSzIfMocybzNxXcg9hzKPM0UrM5cyGJA5TzJM3RVN1zPdLUMzazNU9zN_M5syzzPLMjSDM78zNMszPzPDMzG_M-My_LDdcC0sFzKTM3lRUG8zHbsyszPZFzN7Mscz_K8ygQcz2Dj48zPFTf8zOzKMFzJ4mUFQozOEdzJBRLqEw3AEqEDXMjszzMyQPzLbM1kLMxzV1asyKzIs5TMzSzMbM6xrM0nPMkszlR3vMjsyIzLFYzIQWYMz8zN7M1szBNMzQecybVwcVzOzMuCt_zLJvzMnM5z3M8kDMtnMzHyUtEgk1dMzQzMI9zPpZzKR_zPZEfsyvzIANzPIxYzTMh8yczOo4zOLMwGlcKQgSzMjMnszYzPQBzO9qzJYVzOcjEMzrdcyBJyp9IcyVeszEBHp-zNQXzOjM7nkuU8yXXl3M1cyEOczlzMLM4MzdMnYiTQ1URMyIzMrMsxfM3szIzPt4JhzMhDJzBczuPhbMjSjMhz7Mgsz_UszcNszxzJHMiCAzLMymzPLMoszHMMzwzNbMtcyBWszjzOAIzO_MvjgGzIlbWszTzOcyF8yLzMELY8yqzKAdzLnM9syJzKglZEVHBszZcl7M6BlePU7MmSNwXjkrzOXMwsyNS8zuEnbMvMy-KszdKGPM_syYzMHM3syzzL0RzN0vN8y_zJbM5EHMrMz2WncPdszzM8yKY8ySaSZ0zMgpYsz1Z8zLCXrM5MzcUBXM7cyNzMTMicy4QjLMtMyvzMnMrczDXE_M4aEx3AEqHlTMyczPzJbMo8y1T8yPAUk0XsySCXUEzKhTzPIDMThnzN_Mhsz0IcyAzNLMjHjMkAsvzLXMq8zTVhzM3szuzPN_zK_MpkzMshM6zLHMyczWzPXMtMysXcyYd8zVzLlXI0rMyszszKJQzI_MlmXM7n1gzKUpO8y3KkXM78zgF8y_zPXMmDzM3MzEDCrMwMzWNA5HzIvM4i7MiMzYzLjMpCAqMsyIfHrMu8y-zOfM8i3M9CvM839jzOImzPTM28zQzMdwzL3Mnj7MtMzkzKzMz1bM52xOD8y0NGZnzP3M6czmzMIzzIvMxUfM_zLMrUo6Dh1UzKx1AkDMi3bM8DZJzIvMmn1UzPXM4cygNcz2zJjMwgwmzMrM-szxzMjM9EIlKcyMzJjMtsyrzLoXzI3MgBTMuRrM6QzM1wlhzIsOPx9-zI_M7mDMw1rMwT7MkTjMsMy2zJxWKUPMosyAfkdtAQbMmyTMmMyXWQ7M1czCzI1iQsync242zK3M9sz_zOvMj3F0zLDMzTAZdszZCChNIGTMy8y8zO49P0JTOh5YzMbMvsydJMzuzLUpzPPMv8z9zIDMhszQzIA4CsztzLTM4Xx0TMyMzPaibWrcAErM6syhzM48DyHM7Ap4zJLM0WxNNx9kzO4PKVktzNTMp8yuE8z4zK5OWHZiIMzRzO4VzJxLfTNSLhw2KsztzLbMm8yNFlxJBAvMh8zrzIp1WMy0zONgM8zYMsyTB2DMuMyDzOk7a1DMpaVhbHBoYdwBXQZTTszGe8z6zKXMo0FWIzvMjsyEHmZObHMpAmE_zNDMg2B-KxzMjcyezJHM6cyazL4fzJXMnkpDzL7MzcyLzN5GzNtgGsyyzL7M119rX8ztbh0azMHMw8zeI3zMm8ySXxIHzOPMk1UibRB_BMyaTTfMmMzuLHdjzLFyTcyozLfMqQsIU0_M2yLMqMzhzJRWN3EXRxnMiSVSBxPMisz7zIbM-3nMr8yANVnMtszTRVzM71PMuszSzJDMt8yeGkABGsycGMy3zKjM3nzMusyqzJY9TMz-zMnMvH8XzOZMf8zMzILM5WrM5wIvzPgDLczGzJrMyMzHZSzM6TTMny1rzLU4zIPMxB7M-8z1Tcy7zJLM4MzsNDt7zJHMlcyaP8ykzLZpzP3M4FZkaszAzORgzMDMscysIMz-XcyczOAdSFDMwMzMPBQ_zPzM2czqzMDMiD3MtcyxB8yrX8zZzOJNKDjMt0wKKcz3V8ytAQ5PzIHM7nhrzNLMzczEzITM28yAzLxbansozODMpczozN3MzU3Mr3LM9czie8yuF3hyzNh6zP_MzmxhDknM2mnM18z-zOrM8UMZZAnM-mHMoFjMv8ygzMfMt3xmzMHMqsyJbsyFXMyNdVfMkXV8zN0hzMhiDczydlnM0MznzOfM7H7Mwx8HGjwRfszwG8yqzJPMuk8qzIMVzK3Mlsz_zPehdIWhMtwBAQLM1A5oSQNBb8yWc8zBzIbM_lMoHnnMwcyEzOIizJLMscz8fcy-zIvMmRN1zL7Mxg5nzLNGdE_M5mPMpcyezK7MmDrMoj_M5xogzPImzOAAzNYCzITMsThsDcy5Bcy_zJV7zNnMsMyAGnYHb8yjzMzM-3bM60zMi8z8zNbMuy7Mw8z_zI7MyczzV8yjVTF-zNVkKsyyHczazJ3MllbMwDvMlBATzIJjzIcQzJ_M32AIzKJ-A8zHzK7MwTNFzNBaIEjMrsyFIMzlMXZ3zPMLzM5MzPHM6MzBzPxHB8yzNEgIaszmzJLM0cydzMxnO8yBWcz0zKVlzPYbzOjMpxrMhXhuzKsPM8yhQmzMuszMzObMlEHM2ELMmMyMQ8zOzIUdBsydHGNwT8yne394zPLM98zSzLnM4EzM8jheNTN1EczlzMRIN1rM68yQAT3MlgtZRAbMkMz9AczrzMPMsHpvzNUVzIHMx8y4zM4pzMYFb3hAGczVelTMrFbMqQbMpGAUoTHcAQDMs8z3zIAadsyrZyVEHVkKSMzHzPLMqcyDzNYnzPPMwsyTzMxOzIxZRk3MqW4ZzOrMinHM48yzC3jMzczKMC4YzKzMpcyNzI_M3WLM8krM2QEyLBXMuE4ZzLXMjMySzOjM6TjM-DTM_QkRfh3M6MyozN5lbMyBCTVgcMyNzPwKzPPM5cyTMcyezKF2PszCzM9aWB3MuMzZzNVDIB_MmMyxBy53QjEozJ5AJjdpzKk7zL7My8y-zNR4TszRzPxnEwrM0szAK11JMR_MsGnMhczFV8zhzJbMv8yiWXc-eMyczL5UKsyKzMHM_1EvzMZ2zN0HzOsxzNrMn8z_zJMyzODMs8zBMsyezJ_MwDINzN4yzN8pzLbMkMyhzLrMwDDM1wnMiirMvk8LccyFzI9azMLMp3XMzMzxzN44zPDMiszCIcz2zNgVzMHM4syaYcz5AMzDzOlJEszHzK_M08zoIsy4zKjM2cy1Q1lzzJnM68zEzNhIzLcVzKnMvcyWzJBIzNvM7ifM78zUUMyHbqVERUxUQdwBAMy7zLFDaE0aG8y0zMgUKGTM_lN2N2g6VszkzJg2JUHMqHN6zNfM7FPMj8yaCn86bMzcCTVzzKDMqMykCCbMmjjMkk_Mucz3I1PM7nDMyQjM7mc_CcybE8zPbQ_M22pvKz_Mgsy3zLcVzJXM0syDIszlzMrMsczJMcykf8z9zNF6B1BjzLXMvszzSsy9zKDMm3DMtcy0BEIVzOBezN3MiHfM6szfb8ybKw_MpifMksy6NkFnzOrMs1MMH8z1zNLMlszezKRTzLMbzLXMmsyszOhczJLMqMyTzK3MoW1ozIsGzIHMihpfzKnM4XJicMzFfcy-V8y3eDbM98zLMWzMqcySMF3MvsyMAGZbAmTMhMyyzItoQ8z8Dcy4AFjM0MzgQkTMnCvM98zoYcykzN9_zNrM5AzMxczwYczzzJRBAcy-zPQezKwOVsy0EGkYHFnM7cy5zO4PzM10QszBRczEHMz_SsyczPYuTkxYzIQwDMzcNzxuzNLMhcytFMy-oTPcAQEBd8ysf8yAzJLM2GvMmUnMkkcizMHMlsyvzPA2zJYqzN0uzLXMgcymzMMBGsy6SnHMiVbM6czOPcywzLbMv8yDUyLMp0kvSMyGNk93zKFIBS1kS8yBYlnMlWpQDMyPA1bM8kp8LSnMlhcsT8zBFGrMn8yAzLfM6Mz2zJ8_zLkFcSw2zLpqzKQ3ACrMqczXWXfM6MzIzNNLVszEzLXMx3R5QMzzzJ3MiRxLzJ4azNl8zI4NJHHM2sySzKfMm8zMzPPM0szfVH7Mn2bM2cyGzJQvblAGSMyszILM8cz4EczEzKsxJWYiMcy8zKXMg8zILMzYb0PM8cy1zK9SCMyGS8zqzPrMoRbM7szeWAINzL4pRzgyzMjM-3HMv8ztEifM_QPM-MzfTszAzOtiZcyszIxBzJzM9WAtzLHMxszjzMnM1jvMtMyTQ37MoMyRzPMEzOE1KQHMoMyEMczEXzVZzNZezPItBsy9fszzZQ5xzNFCzLbMusyrAMzHzKLMpczazJECDqEw3AEBAgYLa8yazLYwEMzCXzcmCcyizPJyzK3MlwUsb8zWzLULzKTMgW3MuRjMlEoZHcyuzNnMpRTMw2PM2UZ0zPLMn0TM_8y8zOXM3j9czI_M0sz3zKbM28zmDxYbzPPM1lfMzgcJzLdAzM_M7jDMoszzzIvMsFxpzM3MlczUeMy-zIRAzLUzzI_M3MzEbgQazJ5KzKHMiTgLKQHMs8zXzLIOzKXMt3oEaDNDa8zvJsytzLEPzJDMr1dkbMzXVS1_PRsXzNDMzczxfsz4EBwLIMybKsy7zJ_M4MzKzM_MvszOzOTMlMyUazrM58ywNcz9zM_M9mgJzPR9zKXMgVpszJQhM8yQCczlzPs5A8yszOJLaczwe8zdzKTMm3l5Lyh9HWHM7gxyzMvMqSoIF2rMrczFRczfzNMgzKkAFMyhzKhscsyyzM3M72DM78zFzIM2zMXMpsy8zJhXSszBdczNzJMvExoJOszLXgbMzGLMpMyLMszRzMsBFVAwFczGZQvMpVZtqXByZWRpY2F0ZYOpYXR0cl9uYW1lo2FnZaZwX3R5cGWiR0WldmFsdWUSr25vbl9yZXZvY19wcm9vZsA',
              },
              issuanceDate: '2025-04-10T09:58:01.373519Z',
            },
          ],
          proof: {
            cryptosuite: 'anoncreds-2023',
            type: 'DataIntegrityProof',
            proofPurpose: 'authentication',
            verificationMethod: 'did:indy:local:LjgpST2rjsoxYegQDRm7EL/anoncreds/v0/CLAIM_DEF/82229/default',
            proofValue:
              'ukgOBqmFnZ3JlZ2F0ZWSCpmNfaGFzaNwAIFrMyWLM-8yhzNd7MMzrzL3MoSXMzRfM_nbMgHbM6VjMxMybzK_MtmzM_MzJzKRfdczqUqZjX2xpc3SW3AEBAszHzOfMgisCzMHMkMz_zKotzLZezMMXX8zOzOU7zPN8YsydzMLMsRY7bMyhzPMRTjXMkTrM4UpQzO_M-czxzIo3zOHM1cyML8y5bsz2zPLM1UHMmMzRzJ4_JToqTczEzNzM71k0zILMywUyQgJLzPnM-2TM88zezKTMhTTMqMz7zKbM63ZvN0jM08yPzJMNZ8zMVcyuzKlxamTMw8z9Rsz6zKk0zJvMusyZN8yezM8KDcyjVGzMjXQGX8yozIvMssy_M8y4NsymzJbM8czPzLHMiDDMv8ykzLxdzMTMsczWzO5MKhRSEszuzK8_ZMydUG7Mp8yNzOTMw8zAzIcHHMz8zKXMx8z2zIzMh23M1cyczNtxzOAsegJyEE3M_kVBe2rMjntAFMysNinMzjHM-Mz4zKVQzPTMj23M18yFzPIBzKF8zLIXzJYQM2EEzPnMjcz-OsyIzOowzJt1bBduT8y8zKI0zJbMkX_MhMzxPcypzJJfPis3egTM7My5AwFnzNl8N8yOEWvcAQECBgtrzJrMtjAQzMJfNyYJzKLM8nLMrcyXBSxvzNbMtQvMpMyBbcy5GMyUShkdzK7M2cylFMzDY8zZRnTM8syfRMz_zLzM5czeP1zMj8zSzPfMpszbzOYPFhvM88zWV8zOBwnMt0DMz8zuMMyizPPMi8ywXGnMzcyVzNR4zL7MhEDMtTPMj8zczMRuBBrMnkrMocyJOAspAcyzzNfMsg7Mpcy3egRoM0NrzO8mzK3MsQ_MkMyvV2RszNdVLX89GxfM0MzNzPF-zPgQHAsgzJsqzLvMn8zgzMrMz8y-zM7M5MyUzJRrOsznzLA1zP3Mz8z2aAnM9H3MpcyBWmzMlCEzzJAJzOXM-zkDzKzM4ktpzPB7zN3MpMybeXkvKH0dYczuDHLMy8ypKggXasytzMVFzN_M0yDMqQAUzKHMqGxyzLLMzczvYMzvzMXMgzbMxcymzLzMmFdKzMF1zM3Mky8TGgk6zMteBszMYsykzIsyzNHMywEVUDAVzMZlC8ylVm3cAQDMs8z3zIAadsyrZyVEHVkKSMzHzPLMqcyDzNYnzPPMwsyTzMxOzIxZRk3MqW4ZzOrMinHM48yzC3jMzczKMC4YzKzMpcyNzI_M3WLM8krM2QEyLBXMuE4ZzLXMjMySzOjM6TjM-DTM_QkRfh3M6MyozN5lbMyBCTVgcMyNzPwKzPPM5cyTMcyezKF2PszCzM9aWB3MuMzZzNVDIB_MmMyxBy53QjEozJ5AJjdpzKk7zL7My8y-zNR4TszRzPxnEwrM0szAK11JMR_MsGnMhczFV8zhzJbMv8yiWXc-eMyczL5UKsyKzMHM_1EvzMZ2zN0HzOsxzNrMn8z_zJMyzODMs8zBMsyezJ_MwDINzN4yzN8pzLbMkMyhzLrMwDDM1wnMiirMvk8LccyFzI9azMLMp3XMzMzxzN44zPDMiszCIcz2zNgVzMHM4syaYcz5AMzDzOlJEszHzK_M08zoIsy4zKjM2cy1Q1lzzJnM68zEzNhIzLcVzKnMvcyWzJBIzNvM7ifM78zUUMyHbtwBAQLM1A5oSQNBb8yWc8zBzIbM_lMoHnnMwcyEzOIizJLMscz8fcy-zIvMmRN1zL7Mxg5nzLNGdE_M5mPMpcyezK7MmDrMoj_M5xogzPImzOAAzNYCzITMsThsDcy5Bcy_zJV7zNnMsMyAGnYHb8yjzMzM-3bM60zMi8z8zNbMuy7Mw8z_zI7MyczzV8yjVTF-zNVkKsyyHczazJ3MllbMwDvMlBATzIJjzIcQzJ_M32AIzKJ-A8zHzK7MwTNFzNBaIEjMrsyFIMzlMXZ3zPMLzM5MzPHM6MzBzPxHB8yzNEgIaszmzJLM0cydzMxnO8yBWcz0zKVlzPYbzOjMpxrMhXhuzKsPM8yhQmzMuszMzObMlEHM2ELMmMyMQ8zOzIUdBsydHGNwT8yne394zPLM98zSzLnM4EzM8jheNTN1EczlzMRIN1rM68yQAT3MlgtZRAbMkMz9AczrzMPMsHpvzNUVzIHMx8y4zM4pzMYFb3hAGczVelTMrFbMqQbMpGAU3AEBAXfMrH_MgMySzNhrzJlJzJJHIszBzJbMr8zwNsyWKszdLsy1zIHMpszDARrMukpxzIlWzOnMzj3MsMy2zL_Mg1MizKdJL0jMhjZPd8yhSAUtZEvMgWJZzJVqUAzMjwNWzPJKfC0pzJYXLE_MwRRqzJ_MgMy3zOjM9syfP8y5BXEsNsy6asykNwAqzKnM11l3zOjMyMzTS1bMxMy1zMd0eUDM88ydzIkcS8yeGszZfMyODSRxzNrMksynzJvMzMzzzNLM31R-zJ9mzNnMhsyUL25QBkjMrMyCzPHM-BHMxMyrMSVmIjHMvMylzIPMyCzM2G9DzPHMtcyvUgjMhkvM6sz6zKEWzO7M3lgCDcy-KUc4MszIzPtxzL_M7RInzP0DzPjM307MwMzrYmXMrMyMQcyczPVgLcyxzMbM48zJzNY7zLTMk0N-zKDMkczzBMzhNSkBzKDMhDHMxF81WczWXszyLQbMvX7M82UOcczRQsy2zLrMqwDMx8yizKXM2syRAg7cAQDMu8yxQ2hNGhvMtMzIFChkzP5TdjdoOlbM5MyYNiVBzKhzeszXzOxTzI_Mmgp_OmzM3Ak1c8ygzKjMpAgmzJo4zJJPzLnM9yNTzO5wzMkIzO5nPwnMmxPMz20PzNtqbys_zILMt8y3FcyVzNLMgyLM5czKzLHMyTHMpH_M_czRegdQY8y1zL7M80rMvcygzJtwzLXMtARCFczgXszdzIh3zOrM32_MmysPzKYnzJLMujZBZ8zqzLNTDB_M9czSzJbM3sykU8yzG8y1zJrMrMzoXMySzKjMk8ytzKFtaMyLBsyBzIoaX8ypzOFyYnDMxX3MvlfMt3g2zPfMyzFszKnMkjBdzL7MjABmWwJkzITMssyLaEPM_A3MuABYzNDM4EJEzJwrzPfM6GHMpMzff8zazOQMzMXM8GHM88yUQQHMvsz0HsysDlbMtBBpGBxZzO3MuczuD8zNdELMwUXMxBzM_0rMnMz2Lk5MWMyEMAzM3Dc8bszSzIXMrRTMvg',
            challenge: '71274858652825095395',
          },
          presentation_submission: {
            id: 'yv4krfh8tIMF73h_82RrM',
            definition_id: '5591656f-5b5d-40f8-ab5c-9041c8e3a6a0',
            descriptor_map: [
              {
                id: 'age-verification',
                format: 'di_vp',
                path: '$.verifiableCredential[0]',
              },
            ],
          },
        },
        W3cJsonLdVerifiablePresentation
      )
    )
  })
})
