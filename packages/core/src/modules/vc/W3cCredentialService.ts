import type {
  VerifyCredentialResult,
  W3cCredentialOptions,
  W3cVerifiableCredentialOptions,
  W3cVerifyCredentialResult,
} from './models'
import type { W3cCredentialRecord } from './models/credential/W3cCredentialRecord'
import type { VerifyPresentationResult } from './models/presentation/VerifyPresentationResult'
import type { W3cPresentation } from './models/presentation/W3Presentation'

import { W3cVerifiableCredential } from './models'
import { W3cVerifiablePresentation } from './models/presentation/W3cVerifiablePresentation'

export class W3cCredentialService {
  // Should this be a submission or manifest?
  public async signCredential(credential: W3cCredentialOptions): Promise<W3cVerifiableCredential> {
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

  // verifies only the credential (proof-set) signatures
  public async verifyCredential(credential: W3cVerifiableCredentialOptions): Promise<W3cVerifyCredentialResult> {
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

  // verifies the entire presentation (signature, proof purposes, etc.)
  public async verifyPresentation(presentation: W3cVerifiablePresentation): Promise<VerifyPresentationResult> {
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

  // Do we store records or submissions?
  public storeCredential(record: W3cVerifiableCredential): Promise<W3cCredentialRecord> {
    throw new Error('Method not implemented.')
  }

  public async signPresentation(presentation: W3cPresentation): Promise<W3cVerifiablePresentation> {
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
}
