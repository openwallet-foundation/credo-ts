import {
  Agent,
  ClaimFormat,
  Kms,
  W3cV2Credential,
  W3cV2CredentialRecord,
  W3cV2CredentialSubject,
  W3cV2DataIntegrityVerifiableCredential,
  W3cV2EnvelopedVerifiableCredential,
  W3cV2Issuer,
  W3cV2JwtVerifiableCredential,
  W3cV2Presentation,
  W3cV2SdJwtVerifiableCredential,
} from '@credo-ts/core'
import { DrizzleStorageModule } from '@credo-ts/drizzle-storage'
import { anoncredsBundle } from '@credo-ts/drizzle-storage/anoncreds'
import { coreBundle } from '@credo-ts/drizzle-storage/core'
import { didcommBundle } from '@credo-ts/drizzle-storage/didcomm'

import { createDidKidVerificationMethod, getAgentOptions } from '../packages/core/tests/helpers'
import {
  createDrizzlePostgresTestDatabase,
  type DrizzlePostgresTestDatabase,
  pushDrizzleSchema,
} from '../packages/drizzle-storage/tests/testDatabase'

type IssuanceCase = {
  name: string
  credentialFormat: ClaimFormat.JwtW3cVc | ClaimFormat.SdJwtW3cVc | ClaimFormat.DiVc
  presentationFormat: ClaimFormat.JwtW3cVp | ClaimFormat.SdJwtW3cVp | ClaimFormat.DiVp
}

type DidRef = Awaited<ReturnType<typeof createDidKidVerificationMethod>>

const _issuanceCases: IssuanceCase[] = [
  {
    name: 'jwt-vc / jwt-vp',
    credentialFormat: ClaimFormat.JwtW3cVc,
    presentationFormat: ClaimFormat.JwtW3cVp,
  },
  {
    name: 'sd-jwt-vc / sd-jwt-vp',
    credentialFormat: ClaimFormat.SdJwtW3cVc,
    presentationFormat: ClaimFormat.SdJwtW3cVp,
  },
  {
    name: 'di-vc / di-vp',
    credentialFormat: ClaimFormat.DiVc,
    presentationFormat: ClaimFormat.DiVp,
  },
]

function buildCredentialToSign(issuerDid: string, holderDid: string) {
  return new W3cV2Credential({
    type: ['VerifiableCredential', 'ExampleCredential'],
    issuer: new W3cV2Issuer({ id: issuerDid }),
    credentialSubject: new W3cV2CredentialSubject({
      id: holderDid,
      name: 'Jane Doe',
      employeeId: 'E-1001',
    }),
    validFrom: new Date().toISOString(),
  })
}

function tamperCompactJwtSignature(compact: string) {
  const parts = compact.split('.')
  if (parts.length !== 3 || parts[2].length === 0) {
    throw new Error('Expected compact JWT with 3 segments')
  }

  const signature = parts[2]
  const tamperIndex = Math.floor(signature.length / 2)
  const replacement = signature[tamperIndex] === 'A' ? 'B' : 'A'
  parts[2] = `${signature.slice(0, tamperIndex)}${replacement}${signature.slice(tamperIndex + 1)}`

  return parts.join('.')
}

function tamperSignedCredential(
  credentialFormat: IssuanceCase['credentialFormat'],
  signedCredential: unknown
): W3cV2JwtVerifiableCredential | W3cV2SdJwtVerifiableCredential | W3cV2DataIntegrityVerifiableCredential {
  if (credentialFormat === ClaimFormat.JwtW3cVc) {
    const jwtCredential = signedCredential as W3cV2JwtVerifiableCredential
    return W3cV2JwtVerifiableCredential.fromCompact(tamperCompactJwtSignature(jwtCredential.encoded))
  }

  if (credentialFormat === ClaimFormat.SdJwtW3cVc) {
    const sdJwtCredential = signedCredential as W3cV2SdJwtVerifiableCredential
    const sdJwtParts = sdJwtCredential.encoded.split('~')
    sdJwtParts[0] = tamperCompactJwtSignature(sdJwtParts[0])
    return W3cV2SdJwtVerifiableCredential.fromCompact(sdJwtParts.join('~'))
  }

  const diCredential = signedCredential as W3cV2DataIntegrityVerifiableCredential
  const credentialObject = structuredClone(diCredential.securedCredential) as Record<string, unknown>
  const credentialSubject = credentialObject.credentialSubject as Record<string, unknown>
  credentialObject.credentialSubject = {
    ...credentialSubject,
    name: 'Mallory',
  }

  return W3cV2DataIntegrityVerifiableCredential.fromObject(
    credentialObject as W3cV2DataIntegrityVerifiableCredential['securedCredential']
  )
}

function buildSignCredentialOptions(params: {
  credentialFormat: IssuanceCase['credentialFormat']
  issuerDidRef: DidRef
  holderDidRef: DidRef
  credentialSubjectDid?: string
}) {
  const { credentialFormat, issuerDidRef, holderDidRef, credentialSubjectDid } = params
  const credential = buildCredentialToSign(issuerDidRef.did, credentialSubjectDid ?? holderDidRef.did)

  if (credentialFormat === ClaimFormat.JwtW3cVc) {
    return {
      format: ClaimFormat.JwtW3cVc,
      credential,
      alg: Kms.KnownJwaSignatureAlgorithms.EdDSA,
      verificationMethod: issuerDidRef.kid,
    }
  }

  if (credentialFormat === ClaimFormat.SdJwtW3cVc) {
    return {
      format: ClaimFormat.SdJwtW3cVc,
      credential,
      alg: Kms.KnownJwaSignatureAlgorithms.EdDSA,
      verificationMethod: issuerDidRef.kid,
      disclosureFrame: {
        credentialSubject: {
          _sd: ['name'],
        },
      },
      holder: {
        method: 'did',
        didUrl: holderDidRef.kid,
      },
    }
  }

  return {
    format: ClaimFormat.DiVc,
    credential: {
      '@context': ['https://www.w3.org/ns/credentials/v2'],
      type: ['VerifiableCredential', 'ExampleCredential'],
      issuer: issuerDidRef.did,
      validFrom: new Date().toISOString(),
      credentialSubject: {
        id: credentialSubjectDid ?? holderDidRef.did,
        name: 'Jane Doe',
      },
    },
    cryptosuite: 'eddsa-jcs-2022',
    verificationMethod: issuerDidRef.kid,
  }
}

function buildSignPresentationOptions(params: {
  presentationFormat: IssuanceCase['presentationFormat']
  holderDidRef: DidRef
  signedCredential: unknown
  challenge: string
  domain: string
}) {
  const { presentationFormat, holderDidRef, signedCredential, challenge, domain } = params

  if (presentationFormat === ClaimFormat.JwtW3cVp) {
    const jwtCredential = signedCredential as W3cV2JwtVerifiableCredential

    return {
      format: ClaimFormat.JwtW3cVp,
      challenge,
      domain,
      verificationMethod: holderDidRef.kid,
      alg: Kms.KnownJwaSignatureAlgorithms.EdDSA,
      presentation: new W3cV2Presentation({
        holder: holderDidRef.did,
        verifiableCredential: [W3cV2EnvelopedVerifiableCredential.fromVerifiableCredential(jwtCredential)],
      }),
    }
  }

  if (presentationFormat === ClaimFormat.SdJwtW3cVp) {
    const sdJwtCredential = signedCredential as W3cV2SdJwtVerifiableCredential

    return {
      format: ClaimFormat.SdJwtW3cVp,
      challenge,
      domain,
      verificationMethod: holderDidRef.kid,
      alg: Kms.KnownJwaSignatureAlgorithms.EdDSA,
      presentation: new W3cV2Presentation({
        holder: holderDidRef.did,
        verifiableCredential: [W3cV2EnvelopedVerifiableCredential.fromVerifiableCredential(sdJwtCredential)],
      }),
    }
  }

  const diCredential = signedCredential as W3cV2DataIntegrityVerifiableCredential

  return {
    format: ClaimFormat.DiVp,
    challenge,
    domain,
    verificationMethod: holderDidRef.kid,
    cryptosuite: 'eddsa-jcs-2022',
    presentation: new W3cV2Presentation({
      holder: holderDidRef.did,
      verifiableCredential: [diCredential],
    }),
  }
}

describe('W3C VC 2.0 format e2e matrix (transport-agnostic)', () => {
  let issuerAgent: Agent
  let holderAgent: Agent
  let issuerDidRef: DidRef
  let holderDidRef: DidRef
  let issuerPostgresDatabase: DrizzlePostgresTestDatabase
  let holderPostgresDatabase: DrizzlePostgresTestDatabase

  beforeEach(async () => {
    issuerPostgresDatabase = await createDrizzlePostgresTestDatabase()
    holderPostgresDatabase = await createDrizzlePostgresTestDatabase()

    const issuerOptions = getAgentOptions('VC2 E2E Issuer', undefined, {}, undefined, {
      requireDidcomm: true,
      drizzle: issuerPostgresDatabase.drizzle,
    })
    const holderOptions = getAgentOptions('VC2 E2E Holder', undefined, {}, undefined, {
      requireDidcomm: true,
      drizzle: holderPostgresDatabase.drizzle,
    })

    const issuerDrizzle = new DrizzleStorageModule({
      database: issuerPostgresDatabase.drizzle,
      bundles: [coreBundle, didcommBundle, anoncredsBundle],
    })
    const holderDrizzle = new DrizzleStorageModule({
      database: holderPostgresDatabase.drizzle,
      bundles: [coreBundle, didcommBundle, anoncredsBundle],
    })

    await pushDrizzleSchema(issuerDrizzle)
    await pushDrizzleSchema(holderDrizzle)

    issuerAgent = new Agent({
      ...issuerOptions,
      modules: {
        ...issuerOptions.modules,
        drizzle: issuerDrizzle,
      },
    })
    holderAgent = new Agent({
      ...holderOptions,
      modules: {
        ...holderOptions.modules,
        drizzle: holderDrizzle,
      },
    })

    await issuerAgent.initialize()
    await holderAgent.initialize()

    issuerDidRef = await createDidKidVerificationMethod(issuerAgent.context)
    holderDidRef = await createDidKidVerificationMethod(holderAgent.context)
  })

  afterEach(async () => {
    await issuerAgent?.shutdown()
    await holderAgent?.shutdown()
    await issuerPostgresDatabase?.teardown()
    await holderPostgresDatabase?.teardown()
  })

  describe('jwt-vc / jwt-vp', () => {
    const credentialFormat = ClaimFormat.JwtW3cVc
    const presentationFormat = ClaimFormat.JwtW3cVp
    const challenge = 'challenge-jwt-vc-jwt-vp'
    const domain = 'example.org'

    test('issues, stores, presents, and verifies', async () => {
      const signCredentialOptions = buildSignCredentialOptions({
        credentialFormat,
        issuerDidRef,
        holderDidRef,
      })

      const signedCredential = await issuerAgent.w3cV2Credentials.signCredential(signCredentialOptions as never)

      const verifyCredentialResult = await holderAgent.w3cV2Credentials.verifyCredential({
        credential: signedCredential,
      } as never)

      expect(verifyCredentialResult.isValid).toBe(true)

      await holderAgent.w3cV2Credentials.store({
        record: W3cV2CredentialRecord.fromCredential(signedCredential as never),
      })

      const signPresentationOptions = buildSignPresentationOptions({
        presentationFormat,
        holderDidRef,
        signedCredential,
        challenge,
        domain,
      })

      const signedPresentation = await holderAgent.w3cV2Credentials.signPresentation(signPresentationOptions as never)

      const verifyPresentationResult = await issuerAgent.w3cV2Credentials.verifyPresentation({
        presentation: signedPresentation,
        challenge,
        domain,
      } as never)

      expect(verifyPresentationResult.presentation.isValid).toBe(true)
      expect(verifyPresentationResult.isValid).toBe(true)
    })

    test('negative: tampered credential fails verification', async () => {
      const signCredentialOptions = buildSignCredentialOptions({
        credentialFormat,
        issuerDidRef,
        holderDidRef,
      })

      const signedCredential = await issuerAgent.w3cV2Credentials.signCredential(signCredentialOptions as never)
      const tamperedCredential = tamperSignedCredential(credentialFormat, signedCredential)

      const verifyCredentialResult = await holderAgent.w3cV2Credentials.verifyCredential({
        credential: tamperedCredential,
      } as never)

      expect(verifyCredentialResult.isValid).toBe(false)
    })

    test('negative: wrong challenge/domain fails VP verification', async () => {
      const signCredentialOptions = buildSignCredentialOptions({
        credentialFormat,
        issuerDidRef,
        holderDidRef,
      })

      const signedCredential = await issuerAgent.w3cV2Credentials.signCredential(signCredentialOptions as never)

      const signPresentationOptions = buildSignPresentationOptions({
        presentationFormat,
        holderDidRef,
        signedCredential,
        challenge,
        domain,
      })

      const signedPresentation = await holderAgent.w3cV2Credentials.signPresentation(signPresentationOptions as never)

      const verifyPresentationResult = await issuerAgent.w3cV2Credentials.verifyPresentation({
        presentation: signedPresentation,
        challenge: `${challenge}-wrong`,
        domain: `${domain}-wrong`,
      } as never)

      expect(verifyPresentationResult.presentation.isValid).toBe(false)
      expect(verifyPresentationResult.isValid).toBe(false)
    })

    test('negative: VP signer must match VC credentialSubject.id', async () => {
      const signCredentialOptions = buildSignCredentialOptions({
        credentialFormat,
        issuerDidRef,
        holderDidRef,
        credentialSubjectDid: issuerDidRef.did,
      })

      const signedCredential = await issuerAgent.w3cV2Credentials.signCredential(signCredentialOptions as never)

      const signPresentationOptions = buildSignPresentationOptions({
        presentationFormat,
        holderDidRef,
        signedCredential,
        challenge,
        domain,
      })

      const signedPresentation = await holderAgent.w3cV2Credentials.signPresentation(signPresentationOptions as never)

      const verifyPresentationResult = await issuerAgent.w3cV2Credentials.verifyPresentation({
        presentation: signedPresentation,
        challenge,
        domain,
      } as never)

      expect(verifyPresentationResult.isValid).toBe(false)
      expect(
        verifyPresentationResult.credentialEntries.some(
          (entry) =>
            (entry as { validations?: { credentialSubjectAuthentication?: { isValid?: boolean } } }).validations
              ?.credentialSubjectAuthentication?.isValid === false
        )
      ).toBe(true)
    })
  })

  describe('sd-jwt-vc / sd-jwt-vp', () => {
    const credentialFormat = ClaimFormat.SdJwtW3cVc
    const presentationFormat = ClaimFormat.SdJwtW3cVp
    const challenge = 'challenge-sd-jwt-vc-sd-jwt-vp'
    const domain = 'example.org'

    test('issues, stores, presents, and verifies', async () => {
      const signCredentialOptions = buildSignCredentialOptions({
        credentialFormat,
        issuerDidRef,
        holderDidRef,
      })

      const signedCredential = await issuerAgent.w3cV2Credentials.signCredential(signCredentialOptions as never)

      const verifyCredentialResult = await holderAgent.w3cV2Credentials.verifyCredential({
        credential: signedCredential,
      } as never)

      expect(verifyCredentialResult.isValid).toBe(true)

      await holderAgent.w3cV2Credentials.store({
        record: W3cV2CredentialRecord.fromCredential(signedCredential as never),
      })

      const signPresentationOptions = buildSignPresentationOptions({
        presentationFormat,
        holderDidRef,
        signedCredential,
        challenge,
        domain,
      })

      const signedPresentation = await holderAgent.w3cV2Credentials.signPresentation(signPresentationOptions as never)

      const verifyPresentationResult = await issuerAgent.w3cV2Credentials.verifyPresentation({
        presentation: signedPresentation,
        challenge,
        domain,
      } as never)

      expect(verifyPresentationResult.presentation.isValid).toBe(true)
      expect(verifyPresentationResult.isValid).toBe(true)
    })

    test('negative: tampered credential fails verification', async () => {
      const signCredentialOptions = buildSignCredentialOptions({
        credentialFormat,
        issuerDidRef,
        holderDidRef,
      })

      const signedCredential = await issuerAgent.w3cV2Credentials.signCredential(signCredentialOptions as never)
      const tamperedCredential = tamperSignedCredential(credentialFormat, signedCredential)

      const verifyCredentialResult = await holderAgent.w3cV2Credentials.verifyCredential({
        credential: tamperedCredential,
      } as never)

      expect(verifyCredentialResult.isValid).toBe(false)
    })

    test('negative: wrong challenge/domain fails VP verification', async () => {
      const signCredentialOptions = buildSignCredentialOptions({
        credentialFormat,
        issuerDidRef,
        holderDidRef,
      })

      const signedCredential = await issuerAgent.w3cV2Credentials.signCredential(signCredentialOptions as never)

      const signPresentationOptions = buildSignPresentationOptions({
        presentationFormat,
        holderDidRef,
        signedCredential,
        challenge,
        domain,
      })

      const signedPresentation = await holderAgent.w3cV2Credentials.signPresentation(signPresentationOptions as never)

      const verifyPresentationResult = await issuerAgent.w3cV2Credentials.verifyPresentation({
        presentation: signedPresentation,
        challenge: `${challenge}-wrong`,
        domain: `${domain}-wrong`,
      } as never)

      expect(verifyPresentationResult.presentation.isValid).toBe(false)
      expect(verifyPresentationResult.isValid).toBe(false)
    })

    test('negative: VP signer must match VC credentialSubject.id', async () => {
      const signCredentialOptions = buildSignCredentialOptions({
        credentialFormat,
        issuerDidRef,
        holderDidRef,
        credentialSubjectDid: issuerDidRef.did,
      })

      const signedCredential = await issuerAgent.w3cV2Credentials.signCredential(signCredentialOptions as never)

      const signPresentationOptions = buildSignPresentationOptions({
        presentationFormat,
        holderDidRef,
        signedCredential,
        challenge,
        domain,
      })

      const signedPresentation = await holderAgent.w3cV2Credentials.signPresentation(signPresentationOptions as never)

      const verifyPresentationResult = await issuerAgent.w3cV2Credentials.verifyPresentation({
        presentation: signedPresentation,
        challenge,
        domain,
      } as never)

      expect(verifyPresentationResult.isValid).toBe(false)
      expect(
        verifyPresentationResult.credentialEntries.some(
          (entry) =>
            (entry as { validations?: { credentialSubjectAuthentication?: { isValid?: boolean } } }).validations
              ?.credentialSubjectAuthentication?.isValid === false
        )
      ).toBe(true)
    })
  })

  describe('di-vc / di-vp', () => {
    const credentialFormat = ClaimFormat.DiVc
    const presentationFormat = ClaimFormat.DiVp
    const challenge = 'challenge-di-vc-di-vp'
    const domain = 'example.org'

    test('issues, stores, presents, and verifies', async () => {
      const signCredentialOptions = buildSignCredentialOptions({
        credentialFormat,
        issuerDidRef,
        holderDidRef,
      })

      const signedCredential = await issuerAgent.w3cV2Credentials.signCredential(signCredentialOptions as never)

      const verifyCredentialResult = await holderAgent.w3cV2Credentials.verifyCredential({
        credential: signedCredential,
      } as never)

      expect(verifyCredentialResult.isValid).toBe(true)

      await holderAgent.w3cV2Credentials.store({
        record: W3cV2CredentialRecord.fromCredential(signedCredential as never),
      })

      const signPresentationOptions = buildSignPresentationOptions({
        presentationFormat,
        holderDidRef,
        signedCredential,
        challenge,
        domain,
      })

      const signedPresentation = await holderAgent.w3cV2Credentials.signPresentation(signPresentationOptions as never)

      const verifyPresentationResult = await issuerAgent.w3cV2Credentials.verifyPresentation({
        presentation: signedPresentation,
        challenge,
        domain,
      } as never)

      expect(verifyPresentationResult.presentation.isValid).toBe(true)
      expect(verifyPresentationResult.isValid).toBe(true)
    })

    test('negative: tampered credential fails verification', async () => {
      const signCredentialOptions = buildSignCredentialOptions({
        credentialFormat,
        issuerDidRef,
        holderDidRef,
      })

      const signedCredential = await issuerAgent.w3cV2Credentials.signCredential(signCredentialOptions as never)
      const tamperedCredential = tamperSignedCredential(credentialFormat, signedCredential)

      const verifyCredentialResult = await holderAgent.w3cV2Credentials.verifyCredential({
        credential: tamperedCredential,
      } as never)

      expect(verifyCredentialResult.isValid).toBe(false)
    })

    test('negative: wrong challenge/domain fails VP verification', async () => {
      const signCredentialOptions = buildSignCredentialOptions({
        credentialFormat,
        issuerDidRef,
        holderDidRef,
      })

      const signedCredential = await issuerAgent.w3cV2Credentials.signCredential(signCredentialOptions as never)

      const signPresentationOptions = buildSignPresentationOptions({
        presentationFormat,
        holderDidRef,
        signedCredential,
        challenge,
        domain,
      })

      const signedPresentation = await holderAgent.w3cV2Credentials.signPresentation(signPresentationOptions as never)

      const verifyPresentationResult = await issuerAgent.w3cV2Credentials.verifyPresentation({
        presentation: signedPresentation,
        challenge: `${challenge}-wrong`,
        domain: `${domain}-wrong`,
      } as never)

      expect(verifyPresentationResult.presentation.isValid).toBe(false)
      expect(verifyPresentationResult.isValid).toBe(false)
    })

    test('negative: VP signer must match VC credentialSubject.id', async () => {
      const signCredentialOptions = buildSignCredentialOptions({
        credentialFormat,
        issuerDidRef,
        holderDidRef,
        credentialSubjectDid: issuerDidRef.did,
      })

      const signedCredential = await issuerAgent.w3cV2Credentials.signCredential(signCredentialOptions as never)

      const signPresentationOptions = buildSignPresentationOptions({
        presentationFormat,
        holderDidRef,
        signedCredential,
        challenge,
        domain,
      })

      const signedPresentation = await holderAgent.w3cV2Credentials.signPresentation(signPresentationOptions as never)

      const verifyPresentationResult = await issuerAgent.w3cV2Credentials.verifyPresentation({
        presentation: signedPresentation,
        challenge,
        domain,
      } as never)

      expect(verifyPresentationResult.isValid).toBe(false)
      expect(
        verifyPresentationResult.credentialEntries.some(
          (entry) =>
            (entry as { validations?: { credentialSubjectAuthentication?: { isValid?: boolean } } }).validations
              ?.credentialSubjectAuthentication?.isValid === false
        )
      ).toBe(true)
    })
  })
})
