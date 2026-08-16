import { beforeAll, describe, expect, test, vi } from 'vitest'

import { type DifPresentationExchangeDefinitionV2, DifPresentationExchangeSubmissionLocation } from '../models'
import {
  createDifPresentationExchangeTestContext,
  createMdocRecord,
  createRandomMdocRecord,
  presentationDefinition,
} from './fixtures'

const { agentContext, kms, mdocRepository, pexService } = createDifPresentationExchangeTestContext()
const mdocRecord = createMdocRecord()
const randomMdoc = createRandomMdocRecord()

beforeAll(async () => {
  await mdocRepository.save(agentContext, mdocRecord)
})

describe('DifPresentationExchangeService presentation creation', () => {
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

    vi.spyOn(kms, 'sign').mockResolvedValue({ signature: new Uint8Array([1]) })
    const presentation = await pexService.createPresentation(agentContext, {
      credentialsForInputDescriptor: selectedCredentials,
      challenge: 'something',
      presentationDefinition,
      domain: 'hello',
      presentationSubmissionLocation: DifPresentationExchangeSubmissionLocation.EXTERNAL,
      mdocSessionTranscript: {
        type: 'openId4VpDraft18',
        clientId: 'hello',
        mdocGeneratedNonce: 'something',
        verifierGeneratedNonce: 'something',
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

    vi.spyOn(kms, 'sign').mockResolvedValue({ signature: new Uint8Array([1]) })

    const presentation = await pexService.createPresentation(agentContext, {
      credentialsForInputDescriptor: selectedCredentials,
      challenge: 'something',
      presentationDefinition,
      domain: 'hello',
      presentationSubmissionLocation: DifPresentationExchangeSubmissionLocation.EXTERNAL,
      mdocSessionTranscript: {
        type: 'openId4VpDraft18',
        clientId: 'hello',
        mdocGeneratedNonce: 'something',
        verifierGeneratedNonce: 'something',
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

    vi.spyOn(kms, 'sign').mockResolvedValue({ signature: new Uint8Array([1]) })

    const presentation = await pexService.createPresentation(agentContext, {
      credentialsForInputDescriptor: selectedCredentials,
      challenge: 'something',
      presentationDefinition,
      domain: 'hello',
      presentationSubmissionLocation: DifPresentationExchangeSubmissionLocation.EXTERNAL,
      mdocSessionTranscript: {
        type: 'openId4VpDraft18',
        clientId: 'hello',
        verifierGeneratedNonce: 'something',
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
  test('preserves input descriptor order when creating multiple presentations', async () => {
    await mdocRepository.save(agentContext, randomMdoc)

    const mdocPresentationDefinition = {
      ...presentationDefinition,
      input_descriptors: presentationDefinition.input_descriptors.filter((inputDescriptor) =>
        ['eu.europa.ec.eudi.pid.1', 'org.iso.18013.5.1.mDL'].includes(inputDescriptor.id)
      ),
    }

    const credentialsForRequest = await pexService.getCredentialsForRequest(agentContext, mdocPresentationDefinition)
    const selectedCredentials = pexService.selectCredentialsForRequest(credentialsForRequest)
    const reversedSelectedCredentials = Object.fromEntries(Object.entries(selectedCredentials).reverse())

    vi.spyOn(kms, 'sign').mockResolvedValue({ signature: new Uint8Array([1]) })

    const presentation = await pexService.createPresentation(agentContext, {
      credentialsForInputDescriptor: reversedSelectedCredentials,
      challenge: 'something',
      presentationDefinition: mdocPresentationDefinition,
      domain: 'hello',
      presentationSubmissionLocation: DifPresentationExchangeSubmissionLocation.EXTERNAL,
      mdocSessionTranscript: {
        type: 'openId4VpDraft18',
        clientId: 'hello',
        verifierGeneratedNonce: 'something',
        mdocGeneratedNonce: 'something',
        responseUri: 'https://response.com',
      },
    })

    expect(presentation.presentationSubmission.descriptor_map.map((descriptor) => descriptor.id)).toEqual([
      'eu.europa.ec.eudi.pid.1',
      'org.iso.18013.5.1.mDL',
    ])

    await mdocRepository.deleteById(agentContext, randomMdoc.id)
  })
})
