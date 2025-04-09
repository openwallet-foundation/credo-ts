import { Subject } from 'rxjs'

import { InMemoryStorageService } from '../../../../../../tests/InMemoryStorageService'
import { InMemoryWallet } from '../../../../../../tests/InMemoryWallet'
import { agentDependencies, getAgentContext } from '../../../../tests'
import { AgentContext } from '../../../agent'
import { InjectionSymbols } from '../../../constants'
import { Buffer } from '../../../utils'
import { Mdoc, MdocDeviceResponse, MdocRecord, MdocRepository } from '../../mdoc'
import { sprindFunkeTestVectorBase64Url } from '../../mdoc/__tests__/mdoc.fixtures'
import { SdJwtVcRecord, SdJwtVcRepository } from '../../sd-jwt-vc'
import { SignatureSuiteToken, W3cCredentialService, W3cCredentialsModuleConfig } from '../../vc'
import { DifPresentationExchangeService } from '../DifPresentationExchangeService'
import { type DifPresentationExchangeDefinitionV2, DifPresentationExchangeSubmissionLocation } from '../models'

const wallet = new InMemoryWallet()
const agentContext = getAgentContext({
  registerInstances: [
    [InjectionSymbols.StorageService, new InMemoryStorageService()],
    [InjectionSymbols.AgentDependencies, agentDependencies],
    [InjectionSymbols.Stop$, new Subject<boolean>()],
    [SignatureSuiteToken, 'default'],
    [W3cCredentialsModuleConfig, new W3cCredentialsModuleConfig()],
  ],
  wallet,
})
agentContext.dependencyManager.registerInstance(AgentContext, agentContext)
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
                filter: {
                  type: 'number',
                  minimum: 18,
                },
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

    jest.spyOn(wallet, 'sign').mockImplementation(async () => Buffer.from('signed'))

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
                filter: {
                  type: 'number',
                  minimum: 18,
                },
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

    jest.spyOn(wallet, 'sign').mockImplementation(async () => Buffer.from('signed'))

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
                filter: {
                  type: 'number',
                  minimum: 18,
                },
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

    jest.spyOn(wallet, 'sign').mockImplementation(async () => Buffer.from('signed'))

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
    expect(() => {})
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
})
