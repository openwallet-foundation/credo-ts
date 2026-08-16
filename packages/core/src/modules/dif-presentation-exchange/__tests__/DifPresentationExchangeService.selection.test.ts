import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'

import { JsonTransformer } from '../../../utils'
import { SdJwtVcApi } from '../../sd-jwt-vc'
import { ClaimFormat, W3cCredentialRepository, W3cJsonLdVerifiableCredential } from '../../vc'
import type { DifPresentationExchangeDefinitionV2 } from '../models'
import {
  createDifPresentationExchangeTestContext,
  createMdocRecord,
  createSdJwtVcRecord,
  presentationDefinition,
} from './fixtures'

const makeDefinition = (options: {
  fields?: Array<{ path: string[]; filter?: Record<string, unknown> }>
  format?: Record<string, unknown>
}): DifPresentationExchangeDefinitionV2 => ({
  id: 'pre-query-test',
  ...(options.format ? { format: options.format } : {}),
  input_descriptors: [{ id: 'descriptor', constraints: { fields: options.fields ?? [] } }],
})

describe('DifPresentationExchangeService credential selection', () => {
  const context = createDifPresentationExchangeTestContext()
  const { agentContext, pexService, sdJwtVcRepository, mdocRepository } = context
  const sdJwtVcRecord = createSdJwtVcRecord()
  const mdocRecord = createMdocRecord()

  beforeAll(async () => {
    await sdJwtVcRepository.save(agentContext, sdJwtVcRecord)
    await mdocRepository.save(agentContext, mdocRecord)
  })

  afterEach(() => vi.restoreAllMocks())

  describe('credential pre-querying for presentation definitions', () => {
    const spyQueryMethods = () => ({
      w3cFindByQuery: vi.spyOn(W3cCredentialRepository.prototype, 'findByQuery').mockResolvedValue([]),
      w3cGetAll: vi.spyOn(W3cCredentialRepository.prototype, 'getAll').mockResolvedValue([]),
      sdJwtFindAllByQuery: vi.spyOn(SdJwtVcApi.prototype, 'findAllByQuery').mockResolvedValue([]),
      sdJwtGetAll: vi.spyOn(SdJwtVcApi.prototype, 'getAll').mockResolvedValue([]),
    })

    test('scopes W3C credential queries from a PEX v2 type filter', async () => {
      const spies = spyQueryMethods()
      await pexService.getCredentialsForRequest(
        agentContext,
        makeDefinition({ fields: [{ path: ['$.type'], filter: { type: 'string', const: 'EmployeeCredential' } }] })
      )
      expect(spies.w3cFindByQuery).toHaveBeenCalledWith(agentContext, { $or: [{ types: ['EmployeeCredential'] }] })
      expect(spies.w3cGetAll).not.toHaveBeenCalled()
    })

    test('scopes SD-JWT queries from a PEX v2 vct filter', async () => {
      const spies = spyQueryMethods()
      await pexService.getCredentialsForRequest(
        agentContext,
        makeDefinition({
          fields: [
            { path: ['$.vct'], filter: { type: 'string', enum: ['EmployeeCredential', 'EmployeeCredentialV2'] } },
          ],
        })
      )
      expect(spies.sdJwtFindAllByQuery).toHaveBeenCalledWith({
        $or: [{ vct: 'EmployeeCredential' }, { vct: 'EmployeeCredentialV2' }],
      })
      expect(spies.sdJwtGetAll).not.toHaveBeenCalled()
    })

    test('uses broad queries when a PEX v2 definition has no extractable hints', async () => {
      const spies = spyQueryMethods()
      await pexService.getCredentialsForRequest(
        agentContext,
        makeDefinition({ fields: [{ path: ['$.credentialSubject'] }] })
      )
      expect(spies.w3cGetAll).toHaveBeenCalled()
      expect(spies.sdJwtGetAll).toHaveBeenCalled()
    })

    test('scopes LDP-VC queries by a supported proof type when safe', async () => {
      const spies = spyQueryMethods()
      await pexService.getCredentialsForRequest(
        agentContext,
        makeDefinition({ format: { ldp_vc: { proof_type: ['Ed25519Signature2018'] } } })
      )
      expect(spies.w3cFindByQuery).toHaveBeenCalledWith(agentContext, {
        $or: [{ claimFormat: ClaimFormat.LdpVc, proofTypes: ['Ed25519Signature2018'] }],
      })
      expect(spies.w3cGetAll).not.toHaveBeenCalled()
    })

    test('uses a broad W3C query for ambiguous proof-type constraints', async () => {
      const spies = spyQueryMethods()
      await pexService.getCredentialsForRequest(
        agentContext,
        makeDefinition({ format: { ldp_vc: { proof_type: ['Ed25519Signature2018', 'BbsBlsSignature2020'] } } })
      )
      expect(spies.w3cGetAll).toHaveBeenCalled()
      expect(spies.w3cFindByQuery).not.toHaveBeenCalled()
    })
  })

  describe('nested submission requirements', () => {
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
                    claimFormat: 'dc+sd-jwt',
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
                    disclosedPayload: { 'eu.europa.ec.eudi.pid.1': { birth_date: '1984-01-26' } },
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
          { rule: 'pick', count: 1, from: 'A' },
          { rule: 'all', from: 'B' },
          { rule: 'pick', count: 1, from: 'C' },
          { rule: 'all', from: 'D' },
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
                    claimFormat: 'dc+sd-jwt',
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
                    disclosedPayload: { 'eu.europa.ec.eudi.pid.1': { birth_date: '1984-01-26' } },
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

    test('supports from_nested with rule all', async () => {
      const definition = {
        ...presentationDefinition,
        submission_requirements: [
          {
            rule: 'all' as const,
            from_nested: [
              { rule: 'pick' as const, count: 1, from: 'B' },
              { rule: 'pick' as const, count: 1, from: 'C' },
            ],
          },
        ],
      }
      const result = await pexService.getCredentialsForRequest(agentContext, definition)
      expect(result.areRequirementsSatisfied).toBe(true)
      expect(result.requirements[0]).toMatchObject({ rule: 'all', needsCount: 2, isRequirementSatisfied: true })
      expect(result.requirements[0].submissionEntry.map((entry) => entry.inputDescriptorId).sort()).toEqual(
        ['99fce09b-a0d3-415b-b8a7-3eab8829babc', 'eu.europa.ec.eudi.pid.1'].sort()
      )
    })

    test('supports from_nested with rule pick and count', async () => {
      const definition = {
        ...presentationDefinition,
        submission_requirements: [
          {
            rule: 'pick' as const,
            count: 2,
            from_nested: [
              { rule: 'pick' as const, count: 1, from: 'B' },
              { rule: 'all' as const, from: 'D' },
            ],
          },
        ],
      }
      const result = await pexService.getCredentialsForRequest(agentContext, definition)
      expect(result.areRequirementsSatisfied).toBe(false)
      expect(result.requirements[0]).toMatchObject({ rule: 'pick', needsCount: 2, isRequirementSatisfied: false })
      expect(result.requirements[0].submissionEntry.map((entry) => entry.inputDescriptorId).sort()).toEqual(
        ['99fce09b-a0d3-415b-b8a7-3eab8829babc', 'org.iso.18013.5.1.mDL'].sort()
      )
    })

    test('throws when both from and from_nested are present on one submission requirement', async () => {
      const definition = {
        ...presentationDefinition,
        submission_requirements: [
          { rule: 'pick' as const, count: 1, from: 'B', from_nested: [{ rule: 'pick' as const, count: 1, from: 'C' }] },
        ],
      }
      await expect(pexService.getCredentialsForRequest(agentContext, definition)).rejects.toThrow()
    })

    test('supports nested from_nested trees', async () => {
      const definition = {
        ...presentationDefinition,
        submission_requirements: [
          {
            rule: 'all' as const,
            from_nested: [
              { rule: 'pick' as const, count: 1, from_nested: [{ rule: 'pick' as const, count: 1, from: 'B' }] },
              { rule: 'pick' as const, count: 1, from: 'C' },
            ],
          },
        ],
      }
      const result = await pexService.getCredentialsForRequest(agentContext, definition)
      expect(result.areRequirementsSatisfied).toBe(true)
      expect(result.requirements[0].isRequirementSatisfied).toBe(true)
      expect(result.requirements[0].submissionEntry.map((entry) => entry.inputDescriptorId).sort()).toEqual(
        ['99fce09b-a0d3-415b-b8a7-3eab8829babc', 'eu.europa.ec.eudi.pid.1'].sort()
      )
    })
  })

  describe('relational constraints during credential selection', () => {
    const queryDefinition = (constraints: Record<string, unknown>): DifPresentationExchangeDefinitionV2 => ({
      id: 'relational-test',
      input_descriptors: [{ id: 'pid', constraints }],
    })

    test('subject_is_issuer: required is processed without error during credential selection', async () => {
      const result = await pexService.getCredentialsForRequest(
        agentContext,
        queryDefinition({
          subject_is_issuer: 'required',
          limit_disclosure: 'required',
          fields: [
            { path: ['$.vct'], filter: { type: 'string', const: 'https://example.bmi.bund.de/credential/pid/1.0' } },
          ],
        })
      )
      expect(result.requirements[0].submissionEntry[0].verifiableCredentials).toHaveLength(1)
    })

    test('is_holder: required is processed without error during credential selection', async () => {
      const result = await pexService.getCredentialsForRequest(
        agentContext,
        queryDefinition({
          is_holder: [{ field_id: ['vct-field'], directive: 'required' }],
          limit_disclosure: 'required',
          fields: [
            {
              id: 'vct-field',
              path: ['$.vct'],
              filter: { type: 'string', const: 'https://example.bmi.bund.de/credential/pid/1.0' },
            },
          ],
        })
      )
      expect(result.requirements[0].submissionEntry[0].verifiableCredentials).toHaveLength(1)
    })

    test('same_subject: required is processed without error during credential selection', async () => {
      const result = await pexService.getCredentialsForRequest(
        agentContext,
        queryDefinition({
          same_subject: [{ field_id: ['given-name-field', 'family-name-field'], directive: 'required' }],
          limit_disclosure: 'required',
          fields: [
            { id: 'given-name-field', path: ['$.given_name'] },
            { id: 'family-name-field', path: ['$.family_name'] },
            { path: ['$.vct'], filter: { type: 'string', const: 'https://example.bmi.bund.de/credential/pid/1.0' } },
          ],
        })
      )
      expect(result.requirements[0].submissionEntry[0].verifiableCredentials).toHaveLength(1)
    })
  })

  test('selects the anoncreds W3C credential only for LDP presentations', () => {
    const anoncredsCredentialCredential = JsonTransformer.fromJSON(
      {
        '@context': ['https://www.w3.org/2018/credentials/v1', 'https://w3id.org/security/data-integrity/v2'],
        id: 'did:example:vc-1',
        type: ['VerifiableCredential'],
        issuer: 'did:example:issuer',
        issuanceDate: '2025-01-01T00:00:00Z',
        credentialSubject: { id: 'did:example:subject' },
        proof: {
          type: 'DataIntegrityProof',
          cryptosuite: 'anoncreds-2023',
          proofPurpose: 'assertionMethod',
          verificationMethod: 'did:example:issuer#keys-1',
          proofValue: 'zProofValue',
        },
      },
      W3cJsonLdVerifiableCredential
    )
    const bridgeEligiblePresentationToCreate = {
      claimFormat: ClaimFormat.LdpVp,
      verifiableCredentials: [{ credential: { firstCredential: anoncredsCredentialCredential } }],
    }
    expect(
      (
        pexService as unknown as {
          shouldSignWithAnonCredsW3cService: (
            presentationToCreate: typeof bridgeEligiblePresentationToCreate
          ) => boolean
        }
      ).shouldSignWithAnonCredsW3cService(bridgeEligiblePresentationToCreate)
    ).toBe(true)
    expect(
      (
        pexService as unknown as {
          shouldSignWithAnonCredsW3cService: (
            presentationToCreate: typeof bridgeEligiblePresentationToCreate
          ) => boolean
        }
      ).shouldSignWithAnonCredsW3cService({ ...bridgeEligiblePresentationToCreate, claimFormat: ClaimFormat.DiVp })
    ).toBeUndefined()
  })
})
