import {
  type CredentialMismatch,
  type FormatDesignation,
  type JsonObject,
  type ParsedPresentationDefinition,
  type PexCredential,
  type PexPresentation,
  type PresentationSubmission,
  resolveDescriptorCredential,
  runPresentationSubmission,
} from 'presentation-exchange'
import { Mdoc, MdocDeviceResponse, MdocRecord } from '../../mdoc'
import { mdocNameSpacesForQuery } from '../../mdoc/mdocUtil'
import type { SdJwtVc } from '../../sd-jwt-vc'
import { SdJwtVcRecord } from '../../sd-jwt-vc'
import {
  ClaimFormat,
  W3cCredentialRecord,
  type W3cJsonLdVerifiableCredential,
  W3cJsonLdVerifiablePresentation,
  type W3cJwtVerifiableCredential,
  W3cJwtVerifiablePresentation,
} from '../../vc'
import { ANONCREDS_W3C_CREDENTIAL_CRYPTOSUITE } from '../../vc/anoncreds-w3c-credential'
import { DifPresentationExchangeError } from '../DifPresentationExchangeError'
import type { VerifiablePresentation } from '../models'

/**
 * The format designations a credential is matched under, most preferred first.
 *
 * The SD-JWT VC media type was renamed from `vc+sd-jwt` to `dc+sd-jwt`, and JWT VCs are designated
 * both `jwt_vc` and `jwt_vc_json`. Presentation definitions use either, but the presentation exchange
 * library matches designations exactly. So a credential is offered to it under each designation, and
 * presented under the first one that satisfies the input descriptor. The first one is what `@animo-id/pex` used.
 */
const sdJwtVcDesignations = ['vc+sd-jwt', 'dc+sd-jwt'] as const satisfies FormatDesignation[]
const jwtVcDesignations = ['jwt_vc', 'jwt_vc_json'] as const satisfies FormatDesignation[]

type CredentialRecord = W3cCredentialRecord | SdJwtVcRecord | MdocRecord

/**
 * Copies JSON claims, so what Credo passes is plain JSON, independent of the credential instance.
 */
function copyClaims<T>(claims: T): JsonObject {
  return JSON.parse(JSON.stringify(claims))
}

function getSdJwtVcPexCredentials(sdJwtVc: SdJwtVc): PexCredential[] {
  const claims = copyClaims(sdJwtVc.prettyClaims)
  const keyBindingAlgorithm = sdJwtVc.kbJwt?.header.alg

  return sdJwtVcDesignations.map((credential_format) => ({
    credential_format,
    claims,
    issuer: typeof sdJwtVc.payload.iss === 'string' ? sdJwtVc.payload.iss : undefined,
    subject: typeof sdJwtVc.payload.sub === 'string' ? sdJwtVc.payload.sub : undefined,
    algorithms: typeof sdJwtVc.header.alg === 'string' ? [sdJwtVc.header.alg] : undefined,
    key_binding_algorithms: typeof keyBindingAlgorithm === 'string' ? [keyBindingAlgorithm] : undefined,
  }))
}

function getW3cPexCredentials(
  credential: W3cJwtVerifiableCredential | W3cJsonLdVerifiableCredential,
  { presentation }: { presentation: boolean }
): PexCredential[] {
  const subject = credential.credentialSubjectIds.length === 1 ? credential.credentialSubjectIds[0] : undefined

  if (credential.claimFormat === ClaimFormat.JwtVc) {
    // The JWT payload, with the credential under `vc`, which is what definitions address
    const claims = copyClaims(credential.jwt.payload.toJson())

    return jwtVcDesignations.map((credential_format) => ({
      credential_format,
      claims,
      issuer: credential.issuerId,
      subject,
      algorithms: credential.jwt.header.alg ? [credential.jwt.header.alg] : undefined,
    }))
  }

  // Verifying a credential with several proofs only needs one of them to verify, so for a presented credential a proof
  // type or cryptosuite is only known to be verified when there is one proof. Without it, a `proof_type` or
  // `cryptosuite` restriction can't be satisfied.
  const isProofVerified = !presentation || credential.proofTypes.length === 1
  const [firstProofType, ...proofTypes] = isProofVerified ? credential.proofTypes : []
  const [firstCryptosuite, ...cryptosuites] = isProofVerified ? credential.anonCredsW3cCredentialCryptosuites : []
  const isAnonCreds = isAnonCredsW3cCredential(credential)

  return [
    {
      credential_format: 'ldp_vc',
      claims: copyClaims(credential.toJson()),
      issuer: credential.issuerId,
      subject,
      proof_types: firstProofType ? [firstProofType, ...proofTypes] : undefined,
      cryptosuites: firstCryptosuite ? [firstCryptosuite, ...cryptosuites] : undefined,
      // An AnonCreds credential discloses selectively and proves predicates in zero knowledge, and Credo
      // checks its status through the non-revocation proof of the presentation.
      ...(isAnonCreds && {
        selectively_disclosable: true,
        predicate_results: presentation,
        evaluated_constraints: ['statuses'],
      }),
    },
  ]
}

function getMdocPexCredential(mdoc: Mdoc): PexCredential {
  return {
    credential_format: 'mso_mdoc',
    doctype: mdoc.docType,
    // The element values are CBOR values, which the presentation exchange library compares as JSON values
    // Paths can go into a data element, so the values inside it are converted too
    namespaces: mdocNameSpacesForQuery(mdoc.issuerSignedNamespaces, { nested: true }),
    algorithms: [mdoc.alg],
  }
}

/**
 * The credentials to query the presentation exchange library with, and for each the index of the record it
 * was made from. A record can be offered under more than one format designation, see {@link sdJwtVcDesignations}.
 */
export function getPexCredentialsForRecords(records: CredentialRecord[]) {
  const credentials: PexCredential[] = []
  const recordIndexes: number[] = []

  for (const [recordIndex, record] of records.entries()) {
    let recordCredentials: PexCredential[]
    if (record instanceof SdJwtVcRecord) {
      recordCredentials = getSdJwtVcPexCredentials(record.firstCredential)
    } else if (record instanceof MdocRecord) {
      recordCredentials = [getMdocPexCredential(record.firstCredential)]
    } else if (record instanceof W3cCredentialRecord) {
      recordCredentials = getW3cPexCredentials(record.firstCredential, { presentation: false })
    } else {
      throw new DifPresentationExchangeError('Unsupported credential record type for presentation exchange')
    }

    credentials.push(...recordCredentials)
    recordIndexes.push(...recordCredentials.map(() => recordIndex))
  }

  return { credentials, recordIndexes }
}

/**
 * Per presentation a verifier received, the credentials a `descriptor_map` path addresses, each under every
 * format designation it has, most preferred first. Those are the credentials of a W3C presentation, the
 * documents of an mdoc device response, and an SD-JWT VC itself.
 */
function getPexCredentialsForPresentations(presentations: VerifiablePresentation[]): PexCredential[][][] {
  return presentations.map((presentation) => {
    if (presentation instanceof MdocDeviceResponse) {
      return (presentation.deviceResponse.documents ?? []).map((document) => [
        getMdocPexCredential(new Mdoc(document.issuerSigned)),
      ])
    }

    if (
      presentation instanceof W3cJwtVerifiablePresentation ||
      presentation instanceof W3cJsonLdVerifiablePresentation
    ) {
      const credentials = Array.isArray(presentation.verifiableCredential)
        ? presentation.verifiableCredential
        : [presentation.verifiableCredential]

      return credentials.map((credential) => getW3cPexCredentials(credential, { presentation: true }))
    }

    if (presentation.claimFormat === ClaimFormat.SdJwtDc) {
      return [getSdJwtVcPexCredentials(presentation)]
    }

    throw new DifPresentationExchangeError(
      `Presentation format '${presentation.claimFormat}' is not supported with DIF Presentation Exchange`
    )
  })
}

/**
 * Checks that the presentations a verifier received answer the presentation definition, see
 * `runPresentationSubmission` of the presentation exchange library.
 *
 * A credential with more than one format designation is evaluated for each `descriptor_map` entry under the
 * designation that entry names, so two entries can name different designations for the same credential. The
 * library evaluates the credential a path points at, so each entry is passed with a presentation of its own
 * that holds only its credential, under its designation. The library doesn't take the designation as evidence
 * of the format, it only picks between equivalent ones.
 */
export function runPexPresentationSubmission(
  parsedDefinition: ParsedPresentationDefinition,
  submission: PresentationSubmission,
  presentations: VerifiablePresentation[]
): ReturnType<typeof runPresentationSubmission> {
  const credentials = getPexCredentialsForPresentations(presentations)
  const pexPresentations = credentials.map((designations) => ({
    credentials: designations.map(([preferred]) => preferred),
  }))
  const inputDescriptorIds = new Set(parsedDefinition.definition.input_descriptors.map(({ id }) => id))

  const issues: string[] = []
  // Per entry passed to the library, the entry of the submission and the credential it points at
  const entries: Array<{ descriptorIndex: number; presentationIndex: number; credentialIndex: number }> = []
  const entryPresentations: PexPresentation[] = []
  const entryDescriptors: PresentationSubmission['descriptor_map'] = []

  for (const [descriptorIndex, descriptor] of submission.descriptor_map.entries()) {
    const label = `Descriptor ${descriptorIndex} ('${shorten(descriptor.id)}')`
    if (!inputDescriptorIds.has(descriptor.id)) {
      issues.push(`${label} claims an input descriptor which the definition does not declare`)
      continue
    }

    const resolved = resolveDescriptorCredential(descriptor, pexPresentations)
    if (!resolved.success) {
      issues.push(`${label}: ${resolved.message}`)
      continue
    }

    const { presentation_index: presentationIndex, credential_index: credentialIndex } = resolved.location
    const designations = credentials[presentationIndex][credentialIndex]
    const declaredFormat = descriptor.path_nested?.format ?? descriptor.format

    entries.push({ descriptorIndex, presentationIndex, credentialIndex })
    entryDescriptors.push({ id: descriptor.id, format: descriptor.format, path: `$[${entryPresentations.length}]` })
    entryPresentations.push({
      credentials: [
        designations.find(({ credential_format }) => credential_format === declaredFormat) ?? designations[0],
      ],
    })
  }

  const result = runPresentationSubmission(
    parsedDefinition,
    { ...submission, descriptor_map: entryDescriptors },
    { presentations: entryPresentations }
  )

  return {
    ...result,
    valid: result.valid && issues.length === 0,
    issues: [...issues, ...result.issues],
    // Back to the entries of the submission, and the credentials they point at
    descriptors: result.descriptors.map((descriptor, index) => ({
      ...descriptor,
      descriptor_index: entries[index].descriptorIndex,
      presentation_index: entries[index].presentationIndex,
      credential_index: entries[index].credentialIndex,
    })),
  }
}

/**
 * The presentations a verifier received, as the presentation exchange library takes them, with each credential
 * under its most preferred format designation. Use it to find the credential a `descriptor_map` entry points at,
 * which doesn't depend on the designation. To check a submission, use {@link runPexPresentationSubmission}.
 */
export function getPexPresentations(presentations: VerifiablePresentation[]): PexPresentation[] {
  return getPexCredentialsForPresentations(presentations).map((credentials) => ({
    credentials: credentials.map(([preferred]) => preferred),
  }))
}

/**
 * Shortens a string of the submission for a message, so a huge submission can't make a huge message.
 */
function shorten(text: string, max = 100) {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

export function isAnonCredsW3cCredential(credential: W3cJwtVerifiableCredential | W3cJsonLdVerifiableCredential) {
  if (credential.claimFormat !== ClaimFormat.LdpVc) return false
  return credential.anonCredsW3cCredentialCryptosuites.includes(ANONCREDS_W3C_CREDENTIAL_CRYPTOSUITE)
}

/**
 * Human readable reasons why a credential did not satisfy an input descriptor, for error messages.
 */
export function formatMismatchReasons(mismatch: Pick<CredentialMismatch, 'reasons'>) {
  return mismatch.reasons.map((reason) => `${reason.type}: ${reason.message}`)
}
