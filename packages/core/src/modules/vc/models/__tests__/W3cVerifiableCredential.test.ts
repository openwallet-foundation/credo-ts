import type { W3cVerifiableCredentialOptions } from '../credential/W3cVerifiableCredential'

import { validate } from 'class-validator'

import { W3cVerifiableCredential } from '../credential/W3cVerifiableCredential'

describe('W3cVerifiableCredential', () => {
  it('correctly parses the proof value', () => {
    const credentialJson: W3cVerifiableCredentialOptions = {
      context: [
        'https://www.w3.org/2018/credentials/v1',
        'https://www.w3.org/2018/credentials/examples/v1',
        'https://w3id.org/security/suites/ed25519-2020/v1',
      ],
      id: 'http://example.edu/credentials/3732',
      type: ['VerifiableCredential', 'UniversityDegreeCredential'],
      issuer: 'https://example.edu/issuers/565049',
      issuanceDate: '2010-01-01T00:00:00Z',
      credentialSubject: {
        id: 'did:example:ebfeb1f712ebc6f1c276e12ec21',
        degree: {
          type: 'BachelorDegree',
          name: 'Bachelor of Science and Arts',
        },
      },
      proof: [
        {
          type: 'Ed25519Signature2020',
          created: '2022-03-08T15:14:23Z',
          verificationMethod: 'https://example.edu/issuers/565049#key-1',
          proofPurpose: 'assertionMethod',
          proofValue: 'z5jk8GknF97u6NfgDyDAaz9FehqhuPUcBvARyqXVzxWGECcJEWbm6RENQD3q1QPFFUefzi321XV2sAw1mMG98NGGL',
        },
      ],
    }
    const verifiableCredential = new W3cVerifiableCredential(credentialJson)

    console.log(verifiableCredential)
    console.log(verifiableCredential.proof)
    console.log(verifiableCredential.proof.constructor.name)

    validate(verifiableCredential).then((errors) => {
      // errors is an array of validation errors
      if (errors.length > 0) {
        console.log('validation failed. errors: ', errors)
      } else {
        console.log('validation succeed')
      }
    })
  })
})
