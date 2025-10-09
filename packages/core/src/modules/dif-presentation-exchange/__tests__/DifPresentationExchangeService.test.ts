import type { DifPresentationExchangeDefinitionV2 } from '../models'

import { Subject } from 'rxjs'

import { InMemoryStorageService } from '../../../../../../tests/InMemoryStorageService'
import { InMemoryWallet } from '../../../../../../tests/InMemoryWallet'
import { agentDependencies, getAgentContext } from '../../../../tests'
import { AgentContext } from '../../../agent'
import { InjectionSymbols } from '../../../constants'
import { Mdoc, MdocRecord, MdocRepository } from '../../mdoc'
import { sprindFunkeTestVectorBase64Url } from '../../mdoc/__tests__/mdoc.fixtures'
import { SdJwtVcRecord, SdJwtVcRepository } from '../../sd-jwt-vc'
import { SignatureSuiteToken, W3cCredentialService, W3cCredentialsModuleConfig } from '../../vc'
import { DifPresentationExchangeService } from '../DifPresentationExchangeService'

const agentContext = getAgentContext({
  registerInstances: [
    [InjectionSymbols.StorageService, new InMemoryStorageService()],
    [InjectionSymbols.AgentDependencies, agentDependencies],
    [InjectionSymbols.Stop$, new Subject<boolean>()],
    [SignatureSuiteToken, 'default'],
    [W3cCredentialsModuleConfig, new W3cCredentialsModuleConfig()],
  ],
  wallet: new InMemoryWallet(),
})
agentContext.dependencyManager.registerInstance(AgentContext, agentContext)
const sdJwtVcRecord = new SdJwtVcRecord({
  compactSdJwtVc:
    'eyJ4NWMiOlsiTUlJQ2REQ0NBaHVnQXdJQkFnSUJBakFLQmdncWhrak9QUVFEQWpDQmlERUxNQWtHQTFVRUJoTUNSRVV4RHpBTkJnTlZCQWNNQmtKbGNteHBiakVkTUJzR0ExVUVDZ3dVUW5WdVpHVnpaSEoxWTJ0bGNtVnBJRWR0WWtneEVUQVBCZ05WQkFzTUNGUWdRMU1nU1VSRk1UWXdOQVlEVlFRRERDMVRVRkpKVGtRZ1JuVnVhMlVnUlZWRVNTQlhZV3hzWlhRZ1VISnZkRzkwZVhCbElFbHpjM1ZwYm1jZ1EwRXdIaGNOTWpRd05UTXhNRGd4TXpFM1doY05NalV3TnpBMU1EZ3hNekUzV2pCc01Rc3dDUVlEVlFRR0V3SkVSVEVkTUJzR0ExVUVDZ3dVUW5WdVpHVnpaSEoxWTJ0bGNtVnBJRWR0WWtneENqQUlCZ05WQkFzTUFVa3hNakF3QmdOVkJBTU1LVk5RVWtsT1JDQkdkVzVyWlNCRlZVUkpJRmRoYkd4bGRDQlFjbTkwYjNSNWNHVWdTWE56ZFdWeU1Ga3dFd1lIS29aSXpqMENBUVlJS29aSXpqMERBUWNEUWdBRU9GQnE0WU1LZzR3NWZUaWZzeXR3QnVKZi83RTdWaFJQWGlObTUyUzNxMUVUSWdCZFh5REsza1Z4R3hnZUhQaXZMUDN1dU12UzZpREVjN3FNeG12ZHVLT0JrRENCalRBZEJnTlZIUTRFRmdRVWlQaENrTEVyRFhQTFcyL0owV1ZlZ2h5dyttSXdEQVlEVlIwVEFRSC9CQUl3QURBT0JnTlZIUThCQWY4RUJBTUNCNEF3TFFZRFZSMFJCQ1l3SklJaVpHVnRieTV3YVdRdGFYTnpkV1Z5TG1KMWJtUmxjMlJ5ZFdOclpYSmxhUzVrWlRBZkJnTlZIU01FR0RBV2dCVFVWaGpBaVRqb0RsaUVHTWwyWXIrcnU4V1F2akFLQmdncWhrak9QUVFEQWdOSEFEQkVBaUFiZjVUemtjUXpoZldvSW95aTFWTjdkOEk5QnNGS20xTVdsdVJwaDJieUdRSWdLWWtkck5mMnhYUGpWU2JqVy9VLzVTNXZBRUM1WHhjT2FudXNPQnJvQmJVPSIsIk1JSUNlVENDQWlDZ0F3SUJBZ0lVQjVFOVFWWnRtVVljRHRDaktCL0gzVlF2NzJnd0NnWUlLb1pJemowRUF3SXdnWWd4Q3pBSkJnTlZCQVlUQWtSRk1ROHdEUVlEVlFRSERBWkNaWEpzYVc0eEhUQWJCZ05WQkFvTUZFSjFibVJsYzJSeWRXTnJaWEpsYVNCSGJXSklNUkV3RHdZRFZRUUxEQWhVSUVOVElFbEVSVEUyTURRR0ExVUVBd3d0VTFCU1NVNUVJRVoxYm10bElFVlZSRWtnVjJGc2JHVjBJRkJ5YjNSdmRIbHdaU0JKYzNOMWFXNW5JRU5CTUI0WERUSTBNRFV6TVRBMk5EZ3dPVm9YRFRNME1EVXlPVEEyTkRnd09Wb3dnWWd4Q3pBSkJnTlZCQVlUQWtSRk1ROHdEUVlEVlFRSERBWkNaWEpzYVc0eEhUQWJCZ05WQkFvTUZFSjFibVJsYzJSeWRXTnJaWEpsYVNCSGJXSklNUkV3RHdZRFZRUUxEQWhVSUVOVElFbEVSVEUyTURRR0ExVUVBd3d0VTFCU1NVNUVJRVoxYm10bElFVlZSRWtnVjJGc2JHVjBJRkJ5YjNSdmRIbHdaU0JKYzNOMWFXNW5JRU5CTUZrd0V3WUhLb1pJemowQ0FRWUlLb1pJemowREFRY0RRZ0FFWUd6ZHdGRG5jNytLbjVpYkF2Q09NOGtlNzdWUXhxZk1jd1pMOElhSUErV0NST2NDZm1ZL2dpSDkycU1ydTVwL2t5T2l2RTBSQy9JYmRNT052RG9VeWFObU1HUXdIUVlEVlIwT0JCWUVGTlJXR01DSk9PZ09XSVFZeVhaaXY2dTd4WkMrTUI4R0ExVWRJd1FZTUJhQUZOUldHTUNKT09nT1dJUVl5WFppdjZ1N3haQytNQklHQTFVZEV3RUIvd1FJTUFZQkFmOENBUUF3RGdZRFZSMFBBUUgvQkFRREFnR0dNQW9HQ0NxR1NNNDlCQU1DQTBjQU1FUUNJR0VtN3drWktIdC9hdGI0TWRGblhXNnlybndNVVQydTEzNmdkdGwxMFk2aEFpQnVURnF2Vll0aDFyYnh6Q1AweFdaSG1RSzlrVnl4bjhHUGZYMjdFSXp6c3c9PSJdLCJraWQiOiJNSUdVTUlHT3BJR0xNSUdJTVFzd0NRWURWUVFHRXdKRVJURVBNQTBHQTFVRUJ3d0dRbVZ5YkdsdU1SMHdHd1lEVlFRS0RCUkNkVzVrWlhOa2NuVmphMlZ5WldrZ1IyMWlTREVSTUE4R0ExVUVDd3dJVkNCRFV5QkpSRVV4TmpBMEJnTlZCQU1NTFZOUVVrbE9SQ0JHZFc1clpTQkZWVVJKSUZkaGJHeGxkQ0JRY205MGIzUjVjR1VnU1hOemRXbHVaeUJEUVFJQkFnPT0iLCJ0eXAiOiJ2YytzZC1qd3QiLCJhbGciOiJFUzI1NiJ9.eyJwbGFjZV9vZl9iaXJ0aCI6eyJfc2QiOlsiVS01ZlVXLU5EM1laajZTcUdyQXV4NXJWYWZOalhqZ2hvMmRUUmpQX3hOTSJdfSwiX3NkIjpbIjlFaUpQNEw2NDI0bEtTVGs5NHpIOWhaWVc5UjNuS1R3V0V5TVBJN2dvWHciLCJHVlhRWEtFMmpWR1d0VEF6T1d5ck85TTZySW1qYkZJWGFnRkMyWElMbGhJIiwiUUV2bHpNd0ozZS1tOEtpWEk5bGx2bnVQblh5UHRXN2VCSF9GcXFVTnk3WSIsImljWkpTRkFqLVg3T29Sam5vRFRReXFwU1dNQUVuaTcydWZDZmFFWC1uQkUiLCJsUHJqb3BqbEN5bFdHWVo0cmh4S1RUTUsxS3p1Sm5ISUtybzNwUUhlUXF3IiwicjJORHZtRFY3QmU3TlptVFR0VE9fekdZX3RTdWdYVXoxeDJBXzZuOFhvdyIsInJPbjFJUkpUQWtEV1pSTGc3MUYzaDVsbFpPc1ZPMl9aemlOUy1majNEUFUiXSwiYWRkcmVzcyI6eyJfc2QiOlsiQnI1aVZtZnZlaTloQ01mMktVOGRFVjFER2hrdUtsQ1pUeGFEQ0FMb3NJbyIsIkx6czJpR09SNHF0clhhYmdwMzFfcjFFUFNmazlaUDJQRElJUTRQaHlPT00iLCJadUV5cG41Y0s0WVpWdHdkeGFoWXJqMjZ1MFI2UmxpOVVJWlNjUGhoWTB3Iiwidi1rMzl2VGI5NFI5a25VWTZtbzlXUVdEQkNJS3lya0J4bExTQVl3T2MyNCJdfSwiaXNzdWluZ19jb3VudHJ5IjoiREUiLCJ2Y3QiOiJodHRwczovL2V4YW1wbGUuYm1pLmJ1bmQuZGUvY3JlZGVudGlhbC9waWQvMS4wIiwiaXNzdWluZ19hdXRob3JpdHkiOiJERSIsIl9zZF9hbGciOiJzaGEtMjU2IiwiaXNzIjoiaHR0cHM6Ly9kZW1vLnBpZC1pc3N1ZXIuYnVuZGVzZHJ1Y2tlcmVpLmRlL2MxIiwiY25mIjp7Imp3ayI6eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6IkhzS194Tl95SVU4eWlqdW9BWlhsbndFRU00ZlhZenVNRmd5TTE5SmRYMUkiLCJ5IjoiQUR2NnplVDl3YmgxU0ZxMG14TkcxMUZueC05eFdSRFcwR18xN1dSRXpRSSJ9fSwiZXhwIjoxNzMzNTcxMzI3LCJpYXQiOjE3MzIzNjE3MjcsImFnZV9lcXVhbF9vcl9vdmVyIjp7Il9zZCI6WyJLRDF0U0hnYWotZi1qbkZURkRDMW1sZ0RwNzhMZE1KcHlqWnRRU0k4a1ZnIiwiTDRjTTMtZU1mRHg0Znc2UEw3OVRTVFBnM042VXdzOGNPc3JOYmNqaEEtYyIsImRYUFBQX2lmNFM3XzBzcXZXNTBwZEdlMWszbS1wMnM3M1JicDlncThGaDAiLCJtYnllcU05YUkzRkVvWmFoODA5eTN0dlRCV1NvZTBMSlRUYTlONGNjdmlZIiwicm1zd0dEZnhvS0ZFYlFsNzZ4S1ZVT0hrX0MyQlVpVnQ5RDlvMTFrMmZNSSIsInZsY2Y4WTNhQnNTeEZBeVZfYk9NTndvX3FTT1pHc3ViSVZiY0FVSWVBSGMiXX19.gruqjNOuJBgHXEnG9e60wOoqiyEaL1K9pdL215a0ffZCjtIZ_kICDrO5vBiTrEmvjjd6w_N_thEYLhzob77Epg~WyJWRXlWQWF0LXoyNU8tbkQ0MVBaOGdnIiwiZmFtaWx5X25hbWUiLCJNVVNURVJNQU5OIl0~WyJLcnRPei1lRk9hMU9JYmpmUHUxcHRBIiwiZ2l2ZW5fbmFtZSIsIkVSSUtBIl0~WyJQQUVjSHp0NWk5bFFzNUZlRmFGUS1RIiwiYmlydGhkYXRlIiwiMTk2NC0wOC0xMiJd~',
})
const mdocRecord = new MdocRecord({
  mdoc: Mdoc.fromBase64Url(sprindFunkeTestVectorBase64Url),
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
            path: ["$['org.iso.18013.5.1']['given_name']"],
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
                  type: 'vc+sd-jwt',
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
                  type: 'mso_mdoc',
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
                  type: 'vc+sd-jwt',
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
                  type: 'mso_mdoc',
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
})
