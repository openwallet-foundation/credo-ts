import { Agent } from '../../..'
import { getInMemoryAgentOptions } from '../../../../tests'
import { Mdoc } from '../Mdoc'

import { sprindFunkeX509TrustedCertificate, sprindFunkeTestVectorBase64Url } from './mdoc.fixtures'

const agent = new Agent(getInMemoryAgentOptions('mdoc-test-agent', {}))

describe('mdoc service test', () => {
  test('can get issuer-auth protected-header alg', async () => {
    const mdoc = Mdoc.fromIssuerSignedBase64(sprindFunkeTestVectorBase64Url)
    expect(mdoc.jwaSignatureAlgorithm).toBe('ES256')
  })

  test('can get doctype', async () => {
    const mdoc = Mdoc.fromIssuerSignedBase64(sprindFunkeTestVectorBase64Url)
    expect(mdoc.docType).toBe('eu.europa.ec.eudi.pid.1')
  })

  test('can decode claims from namespaces', async () => {
    const mdoc = Mdoc.fromIssuerSignedBase64(sprindFunkeTestVectorBase64Url)
    const namespaces = mdoc.namespaces
    expect(Object.entries(namespaces)).toHaveLength(1)

    expect(namespaces).toBeDefined()
    const eudiPidNamespace = namespaces['eu.europa.ec.eudi.pid.1']
    expect(eudiPidNamespace).toBeDefined()
    expect(eudiPidNamespace).toStrictEqual({
      resident_country: 'DE',
      age_over_12: true,
      family_name_birth: 'GABLER',
      given_name: 'ERIKA',
      age_birth_year: 1984,
      age_over_18: true,
      age_over_21: true,
      resident_city: 'KÖLN',
      nationality: undefined,
      family_name: 'MUSTERMANN',
      birth_place: 'BERLIN',
      expiry_date: '2024-08-26T14:49:42.124Z',
      issuing_country: 'DE',
      age_over_65: false,
      issuance_date: '2024-08-12T14:49:42.124Z',
      resident_street: 'HEIDESTRASSE 17',
      age_over_16: true,
      resident_postal_code: '51147',
      birth_date: '1984-01-26',
      issuing_authority: 'DE',
      age_over_14: true,
      age_in_years: 40,
    })
  })

  test('can verify sprindFunkeTestVector Issuer Signed structure', async () => {
    const mdoc = Mdoc.fromIssuerSignedBase64(sprindFunkeTestVectorBase64Url)
    const verify = await mdoc.verifyCredential(agent.context, {
      trustedCertificates: [sprindFunkeX509TrustedCertificate],
    })
    expect(verify.isValid).toBeTruthy()
  })
})
