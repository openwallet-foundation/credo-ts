import type { VerifyCredentialResult, W3cCredential, W3cVerifyCredentialResult } from './models'
import type { VerifyPresentationResult } from './models/presentation/VerifyPresentationResult'
import type { W3cPresentation } from './models/presentation/W3Presentation'

import { W3cVerifiableCredential } from './models'
import { W3cCredentialRecord } from './models/credential/W3cCredentialRecord'
import { W3cVerifiablePresentation } from './models/presentation/W3cVerifiablePresentation'

export class W3cCredentialService {
  /**
   * Signs a credential
   *
   * @param credential the credential to be signed
   * @returns the signed credential
   */
  public async signCredential(credential: W3cCredential): Promise<W3cVerifiableCredential> {
    // MOCK
    return new W3cVerifiableCredential({
      ...credential,
      proof: {
        type: 'Ed25519Signature2020',
        created: '2022-02-25T14:58:43Z',
        verificationMethod: 'https://example.edu/issuers/14#key-1',
        proofPurpose: 'assertionMethod',
        proofValue: 'z3BXsFfx1qJ5NsTkKqREjQ3AGh6RAmCwvgu1HcDSzK3P5QEg2TAw8ufktJBw8QkAQRciMGyBf5T2AHyRg2w13Uvhp',
      },
    })
  }

  /**
   * Verifies the signature(s) of a credential
   *
   * @param credential the credential to be verified
   * @returns the verification result
   */
  public async verifyCredential(credential: W3cVerifiableCredential): Promise<W3cVerifyCredentialResult> {
    // MOCK
    return {
      verified: true,
      statusResult: {},
      results: [
        {
          credential: new W3cVerifiableCredential(credential),
          verified: true,
        },
      ],
    }
  }

  /**
   * Verifies a presentation including the credentials it includes
   *
   * @param presentation the presentation to be verified
   * @returns the verification result
   */
  public async verifyPresentation(presentation: W3cVerifiablePresentation): Promise<VerifyPresentationResult> {
    // MOCK
    let results: Array<VerifyCredentialResult> = []
    if (Array.isArray(presentation.verifiableCredential)) {
      results = await Promise.all(
        presentation.verifiableCredential.map(async (credential) => {
          return {
            credential,
            verified: true,
          }
        })
      )
    } else {
      results = [
        {
          credential: new W3cVerifiableCredential(presentation.verifiableCredential),
          verified: true,
        },
      ]
    }

    return {
      verified: true,
      presentationResult: {},
      credentialResults: results,
      // error?:
    }
  }

  /**
   * Writes a credential to storage
   *
   * @param record the credential to be stored
   * @returns the credential record that was written to storage
   */
  public async storeCredential(record: W3cVerifiableCredential): Promise<W3cCredentialRecord> {
    // MOCK
    return new W3cCredentialRecord({
      credential: record,
    })
  }

  /**
   * Signs a presentation including the credentials it includes
   *
   * @param presentation the presentation to be signed
   * @returns the signed presentation
   */
  public async signPresentation(presentation: W3cPresentation): Promise<W3cVerifiablePresentation> {
    // MOCK
    return new W3cVerifiablePresentation({
      ...presentation,
      proof: {
        type: 'Ed25519Signature2020',
        created: '2022-02-25T14:58:43Z',
        verificationMethod: 'https://example.edu/issuers/14#key-1',
        proofPurpose: 'assertionMethod',
        proofValue: 'z3BXsFfx1qJ5NsTkKqREjQ3AGh6RAmCwvgu1HcDSzK3P5QEg2TAw8ufktJBw8QkAQRciMGyBf5T2AHyRg2w13Uvhp',
      },
    })
  }

  /**
   * K-TODO: make sure this method validates that all given credential attributes are also in the JSON-LD context
   * @see https://github.com/gjgd/jsonld-checker
   * NOTE: the library above has NodeJS specific dependencies. We should consider copying it into this codebase
   * @param jsonLd
   */
  public validateCredential(jsonLd: string): Promise<any> {
    throw new Error('Method not implemented.')
  }
}
