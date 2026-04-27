import { MdocRecord } from '../../mdoc'
import { SdJwtVcRecord } from '../../sd-jwt-vc'
import { ClaimFormat } from '../../vc'
import type { DifPexInputDescriptorToCredentials } from '../models'
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
      "Claim format SdJwtDc requires SdJwtVcRecord"
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
      "Claim format MsoMdoc requires MdocRecord"
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
      "Claim format JwtVc/LdpVc requires W3cCredentialRecord"
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
      "Claim format JwtVc/LdpVc requires W3cCredentialRecord"
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
