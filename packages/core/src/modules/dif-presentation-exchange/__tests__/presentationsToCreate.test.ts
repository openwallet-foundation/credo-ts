import { MdocRecord } from '../../mdoc'
import { SdJwtVcRecord } from '../../sd-jwt-vc'
import { ClaimFormat } from '../../vc'
import type { DifPexInputDescriptorToCredentials, DifPresentationExchangeDefinition } from '../models'
import { getPresentationsToCreate } from '../utils/presentationsToCreate'

const mdocRecord = () =>
  new MdocRecord({
    credentialInstances: [
      {
        issuerSignedBase64Url: 'test-mdoc',
      },
    ],
  })

const sdJwtRecord = () =>
  new SdJwtVcRecord({
    credentialInstances: [
      {
        compactSdJwtVc: 'test-sd-jwt',
      },
    ],
  })

const minimalPresentationDefinition = (options?: {
  pdFormat?: Record<string, unknown>
  descriptorFormat?: Record<string, unknown>
}) =>
  ({
    id: 'pd-id',
    input_descriptors: [
      {
        id: 'inputDescriptor',
        ...(options?.descriptorFormat ? { format: options.descriptorFormat } : {}),
      },
    ],
    ...(options?.pdFormat ? { format: options.pdFormat } : {}),
  }) as unknown as DifPresentationExchangeDefinition

describe('getPresentationsToCreate failure paths', () => {
  test('throws when SdJwtDc claim format has non-SdJwtVcRecord', () => {
    const credentialsForInputDescriptor = {
      inputDescriptor: [
        {
          claimFormat: ClaimFormat.SdJwtDc,
          credentialRecord: mdocRecord(),
          disclosedPayload: {},
        },
      ],
    } as unknown as DifPexInputDescriptorToCredentials

    expect(() => getPresentationsToCreate(credentialsForInputDescriptor)).toThrow(
      'Claim format SdJwtDc requires SdJwtVcRecord'
    )
  })

  test('throws when MsoMdoc claim format has non-MdocRecord', () => {
    const credentialsForInputDescriptor = {
      inputDescriptor: [
        {
          claimFormat: ClaimFormat.MsoMdoc,
          credentialRecord: sdJwtRecord(),
          disclosedPayload: {},
        },
      ],
    } as unknown as DifPexInputDescriptorToCredentials

    expect(() => getPresentationsToCreate(credentialsForInputDescriptor)).toThrow(
      'Claim format MsoMdoc requires MdocRecord'
    )
  })

  test('throws when JwtVc claim format has non-W3cCredentialRecord', () => {
    const credentialsForInputDescriptor = {
      inputDescriptor: [
        {
          claimFormat: ClaimFormat.JwtVc,
          credentialRecord: sdJwtRecord(),
        },
      ],
    } as unknown as DifPexInputDescriptorToCredentials

    expect(() => getPresentationsToCreate(credentialsForInputDescriptor)).toThrow(
      'Claim format JwtVc/LdpVc requires W3cCredentialRecord'
    )
  })

  test('throws when LdpVc claim format has non-W3cCredentialRecord', () => {
    const credentialsForInputDescriptor = {
      inputDescriptor: [
        {
          claimFormat: ClaimFormat.LdpVc,
          credentialRecord: sdJwtRecord(),
        },
      ],
    } as unknown as DifPexInputDescriptorToCredentials

    expect(() => getPresentationsToCreate(credentialsForInputDescriptor)).toThrow(
      'Claim format JwtVc/LdpVc requires W3cCredentialRecord'
    )
  })

  test('throws when claim format is unsupported', () => {
    const credentialsForInputDescriptor = {
      inputDescriptor: [
        {
          claimFormat: 'unsupported-claim-format' as unknown as ClaimFormat,
          credentialRecord: sdJwtRecord(),
        },
      ],
    } as unknown as DifPexInputDescriptorToCredentials

    expect(() => getPresentationsToCreate(credentialsForInputDescriptor)).toThrow(
      "Unsupported claim format for input descriptor 'inputDescriptor'"
    )
  })
})

describe('getPresentationsToCreate format capability checks', () => {
  test('allows presentation format declared on presentation definition', () => {
    const credentialsForInputDescriptor = {
      inputDescriptor: [
        {
          claimFormat: ClaimFormat.MsoMdoc,
          credentialRecord: mdocRecord(),
          disclosedPayload: {},
        },
      ],
    } as unknown as DifPexInputDescriptorToCredentials

    expect(() =>
      getPresentationsToCreate(credentialsForInputDescriptor, {
        presentationDefinition: minimalPresentationDefinition({ pdFormat: { mso_mdoc: { alg: ['EdDSA'] } } }),
      })
    ).not.toThrow()
  })

  test('allows descriptor credential format independently from presentation format', () => {
    const credentialsForInputDescriptor = {
      inputDescriptor: [
        {
          claimFormat: ClaimFormat.MsoMdoc,
          credentialRecord: mdocRecord(),
          disclosedPayload: {},
        },
      ],
    } as unknown as DifPexInputDescriptorToCredentials

    expect(() =>
      getPresentationsToCreate(credentialsForInputDescriptor, {
        presentationDefinition: minimalPresentationDefinition({
          pdFormat: { mso_mdoc: { alg: ['EdDSA'] } },
          descriptorFormat: { mso_mdoc: { alg: ['EdDSA'] } },
        }),
      })
    ).not.toThrow()
  })

  test('hard fails when PEX declares dc+sd-jwt', () => {
    const credentialsForInputDescriptor = {
      inputDescriptor: [
        {
          claimFormat: ClaimFormat.SdJwtDc,
          credentialRecord: sdJwtRecord(),
          disclosedPayload: {},
        },
      ],
    } as unknown as DifPexInputDescriptorToCredentials

    expect(() =>
      getPresentationsToCreate(credentialsForInputDescriptor, {
        presentationDefinition: minimalPresentationDefinition({
          pdFormat: { 'dc+sd-jwt': { sd_jwt_alg_values: ['EdDSA'] } },
          descriptorFormat: { 'vc+sd-jwt': { sd_jwt_alg_values: ['EdDSA'] } },
        }),
      })
    ).toThrow("PEX format 'dc+sd-jwt' is not currently supported by the PEX integration.")
  })

  test('throws when selected presentation format is not declared on presentation definition', () => {
    const credentialsForInputDescriptor = {
      inputDescriptor: [
        {
          claimFormat: ClaimFormat.MsoMdoc,
          credentialRecord: mdocRecord(),
          disclosedPayload: {},
        },
      ],
    } as unknown as DifPexInputDescriptorToCredentials

    expect(() =>
      getPresentationsToCreate(credentialsForInputDescriptor, {
        presentationDefinition: minimalPresentationDefinition({ pdFormat: { jwt_vp: { alg: ['EdDSA'] } } }),
      })
    ).toThrow("Presentation format 'mso_mdoc' is not supported by verifier constraints")
  })

  test('validates descriptor format as a credential constraint', () => {
    const credentialsForInputDescriptor = {
      inputDescriptor: [
        {
          claimFormat: ClaimFormat.MsoMdoc,
          credentialRecord: mdocRecord(),
          disclosedPayload: {},
        },
      ],
    } as unknown as DifPexInputDescriptorToCredentials

    expect(() =>
      getPresentationsToCreate(credentialsForInputDescriptor, {
        presentationDefinition: minimalPresentationDefinition({
          pdFormat: { mso_mdoc: { alg: ['EdDSA'] }, jwt_vp: { alg: ['EdDSA'] } },
          descriptorFormat: { jwt_vp: { alg: ['EdDSA'] } },
        }),
      })
    ).toThrow("Credential format 'mso_mdoc' is not supported by input descriptor 'inputDescriptor'")
  })

  test('allows all formats when no format constraints are present', () => {
    const credentialsForInputDescriptor = {
      inputDescriptor: [
        {
          claimFormat: ClaimFormat.MsoMdoc,
          credentialRecord: mdocRecord(),
          disclosedPayload: {},
        },
      ],
    } as unknown as DifPexInputDescriptorToCredentials

    expect(() =>
      getPresentationsToCreate(credentialsForInputDescriptor, {
        presentationDefinition: minimalPresentationDefinition(),
      })
    ).not.toThrow()
  })

  test('formatOverride bypasses only presentation definition format constraints', () => {
    const credentialsForInputDescriptor = {
      inputDescriptor: [
        {
          claimFormat: ClaimFormat.MsoMdoc,
          credentialRecord: mdocRecord(),
          disclosedPayload: {},
        },
      ],
    } as unknown as DifPexInputDescriptorToCredentials

    expect(() =>
      getPresentationsToCreate(credentialsForInputDescriptor, {
        presentationDefinition: minimalPresentationDefinition({
          pdFormat: { jwt_vp: { alg: ['EdDSA'] } },
          descriptorFormat: { jwt_vp: { alg: ['EdDSA'] } },
        }),
        formatOverride: { mso_mdoc: { alg: ['EdDSA'] } },
      })
    ).toThrow("Credential format 'mso_mdoc' is not supported by input descriptor 'inputDescriptor'")
  })
})
