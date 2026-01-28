import {
  DcqlCredential,
  DcqlCredentialQuery,
  DcqlMdocCredential,
  DcqlPresentationResult,
  DcqlQuery,
  DcqlSdJwtVcCredential,
  DcqlW3cVcCredential,
} from 'dcql'
import { injectable } from 'tsyringe'
import type { AgentContext } from '../../agent'
import { isNonEmptyArray, type JsonObject, type JsonValue, mapNonEmptyArray } from '../../types'
import { asArray, TypedArrayEncoder } from '../../utils'
import {
  CredentialMultiInstanceUseMode,
  canUseInstanceFromCredentialRecord,
  useInstanceFromCredentialRecord,
} from '../../utils/credentialUse'
import { DidsApi, getPublicJwkFromVerificationMethod, VerificationMethod } from '../dids'
import type { VerifiableCredential, VerifiablePresentation } from '../dif-presentation-exchange/index'
import {
  MdocApi,
  MdocDeviceResponse,
  type MdocNameSpaces,
  MdocRecord,
  type MdocSessionTranscriptOptions,
} from '../mdoc'
import { SdJwtVcApi, SdJwtVcRecord, SdJwtVcService } from '../sd-jwt-vc'
import { buildDisclosureFrameForPayload } from '../sd-jwt-vc/disclosureFrame'
import {
  ClaimFormat,
  SignatureSuiteRegistry,
  W3cCredentialRecord,
  W3cCredentialRepository,
  W3cCredentialService,
  W3cJsonLdCredentialService,
  W3cJsonLdVerifiableCredential,
  W3cPresentation,
  W3cV2CredentialRecord,
  W3cV2CredentialRepository,
  W3cV2CredentialService,
  W3cV2EnvelopedVerifiableCredential,
  W3cV2Presentation,
} from '../vc'
import { purposes } from '../vc/data-integrity/libraries/jsonld-signatures'
import { W3cV2SdJwtCredentialService, W3cV2SdJwtVerifiableCredential } from '../vc/sd-jwt-vc'
import { X509Certificate } from '../x509'
import { DcqlError } from './DcqlError'
import type {
  DcqlCredentialsForRequest,
  DcqlEncodedPresentations,
  DcqlFailedCredential,
  DcqlPresentation,
  DcqlQueryResult,
  DcqlValidCredential,
} from './models'
import { dcqlGetPresentationsToCreate as getDcqlVcPresentationsToCreate } from './utils'

export interface DcqlSelectCredentialsForRequestOptions {
  /**
   * The usage mode to apply to the credentials when selecting credentials.
   *
   * If and usage mode is selected that require a new instance to be used, and there's no
   * new instances available, an error will be thrown.
   *
   * It does not actually select the credential from the record yet, it just filters
   *  out records that don't match the filter.
   */
  useMode?: CredentialMultiInstanceUseMode
}

@injectable()
export class DcqlService {
  /**
   * Queries the wallet for credentials that match the given dcql query. This only does an initial query based on the
   * schema of the input descriptors. It does not do any further filtering based on the constraints in the input descriptors.
   */
  private async queryCredentialsForDcqlQuery(
    agentContext: AgentContext,
    dcqlQuery: DcqlQuery
  ): Promise<Array<SdJwtVcRecord | W3cCredentialRecord | W3cV2CredentialRecord | MdocRecord>> {
    const formats = new Set(dcqlQuery.credentials.map((c) => c.format))
    const allRecords: Array<SdJwtVcRecord | W3cCredentialRecord | W3cV2CredentialRecord | MdocRecord> = []

    const mdocDoctypes = dcqlQuery.credentials
      .filter((credentialQuery) => credentialQuery.format === 'mso_mdoc')
      .map((c) => c.meta?.doctype_value)

    const mdocApi = this.getMdocApi(agentContext)
    if (mdocDoctypes.every((doctype) => doctype !== undefined)) {
      const mdocRecords = await mdocApi.findAllByQuery({
        $or: mdocDoctypes.map((docType) => ({
          docType: docType,
        })),
      })
      allRecords.push(...mdocRecords)
    } else if (formats.has('mso_mdoc')) {
      const mdocRecords = await mdocApi.getAll()
      allRecords.push(...mdocRecords)
    }

    const sdJwts = dcqlQuery.credentials.filter(
      (credentialQuery): credentialQuery is DcqlCredentialQuery.SdJwtVc =>
        (credentialQuery.format === 'vc+sd-jwt' && !(credentialQuery.meta && 'type_values' in credentialQuery.meta)) ||
        credentialQuery.format === 'dc+sd-jwt'
    )

    const sdJwtVctValues = sdJwts.flatMap((c) => c.meta?.vct_values)

    const sdJwtVcApi = this.getSdJwtVcApi(agentContext)
    if (sdJwtVctValues.every((vct) => vct !== undefined)) {
      const sdjwtVcRecords = await sdJwtVcApi.findAllByQuery({
        $or: sdJwtVctValues.map((vct) => ({
          vct: vct as string,
        })),
      })
      allRecords.push(...sdjwtVcRecords)
    } else if (sdJwts.length > 0) {
      const sdJwtVcRecords = await sdJwtVcApi.getAll()
      allRecords.push(...sdJwtVcRecords)
    }

    const w3cCredentialRepository = agentContext.dependencyManager.resolve(W3cCredentialRepository)
    if (formats.has('jwt_vc_json')) {
      const w3cRecords = await w3cCredentialRepository.findByQuery(agentContext, {
        claimFormat: ClaimFormat.JwtVc,

        // For jwt_vc_json we query the non-expanded types
        $or: dcqlQuery.credentials
          .flatMap((c) => (c.format === 'jwt_vc_json' ? c.meta.type_values : []))
          .map((typeValues) => ({
            types: typeValues,
          })),
      })
      allRecords.push(...w3cRecords)
    }

    if (formats.has('ldp_vc')) {
      const w3cRecords = await w3cCredentialRepository.findByQuery(agentContext, {
        claimFormat: ClaimFormat.LdpVc,

        // For LDP_VC we query the expanded types
        $or: dcqlQuery.credentials
          .flatMap((c) => (c.format === 'jwt_vc_json' ? c.meta.type_values : []))
          .map((typeValues) => ({
            expandedTypes: typeValues,
          })),
      })
      allRecords.push(...w3cRecords)
    }

    const w3cSdJwts = dcqlQuery.credentials.filter(
      (credentialQuery): credentialQuery is DcqlCredentialQuery.W3cVc & { format: 'vc+sd-jwt' } =>
        credentialQuery.format === 'vc+sd-jwt' && !!credentialQuery.meta && 'type_values' in credentialQuery.meta
    )

    if (w3cSdJwts.length > 0) {
      const w3cV2CredentialRepository = agentContext.dependencyManager.resolve(W3cV2CredentialRepository)

      const w3cV2Records = await w3cV2CredentialRepository.findByQuery(agentContext, {
        claimFormat: ClaimFormat.SdJwtW3cVc,
        $or: dcqlQuery.credentials
          .flatMap((c) => (c.format === 'vc+sd-jwt' && c.meta && 'type_values' in c.meta ? c.meta.type_values : []))
          .map((typeValues) => ({
            types: typeValues,
          })),
      })

      allRecords.push(...w3cV2Records)
    }

    return allRecords
  }

  private getAuthorityForCredential(
    credential: VerifiableCredential | W3cV2EnvelopedVerifiableCredential
  ): DcqlCredential['authority'] {
    if (credential.claimFormat === ClaimFormat.SdJwtDc) {
      const akiValues = (credential.header.x5c as string[] | undefined)
        ?.map((c) => {
          const akiHex = X509Certificate.fromEncodedCertificate(c).authorityKeyIdentifier
          return akiHex ? TypedArrayEncoder.toBase64URL(TypedArrayEncoder.fromHex(akiHex)) : undefined
        })
        .filter((aki) => aki !== undefined)

      return akiValues && isNonEmptyArray(akiValues)
        ? ({
            type: 'aki',
            values: akiValues,
          } as const)
        : undefined
    }

    if (credential.claimFormat === ClaimFormat.MsoMdoc) {
      const akiValues = credential.issuerSignedCertificateChain
        .map((c) => {
          const akiHex = X509Certificate.fromRawCertificate(c).authorityKeyIdentifier
          return akiHex ? TypedArrayEncoder.toBase64URL(TypedArrayEncoder.fromHex(akiHex)) : undefined
        })
        .filter((aki) => aki !== undefined)

      return akiValues && isNonEmptyArray(akiValues)
        ? ({
            type: 'aki',
            values: akiValues,
          } as const)
        : undefined
    }

    return undefined
  }

  public async getDcqlCredentialRepresentation(
    agentContext: AgentContext,
    presentation: VerifiablePresentation,
    queryCredential: DcqlQuery['credentials'][number]
  ): Promise<DcqlCredential> {
    // SD-JWT credential can be used as both dc+sd-jwt and vc+sd-jwt
    // At some point we might want to look at the header value of the sd-jwt (vc+sd-jwt vc dc+sd-jwt)
    if (presentation.claimFormat === ClaimFormat.SdJwtDc) {
      return {
        credential_format: queryCredential.format === 'dc+sd-jwt' ? 'dc+sd-jwt' : 'vc+sd-jwt',
        authority: this.getAuthorityForCredential(presentation),
        cryptographic_holder_binding: true,
        vct: presentation.prettyClaims.vct as string,
        claims: presentation.prettyClaims as DcqlSdJwtVcCredential.Claims,
      } satisfies DcqlSdJwtVcCredential
    }
    if (presentation.claimFormat === ClaimFormat.MsoMdoc) {
      if (presentation.documents.length !== 1) {
        throw new DcqlError('MDOC presentations must contain exactly one document')
      }

      return {
        cryptographic_holder_binding: true,
        credential_format: 'mso_mdoc',
        authority: this.getAuthorityForCredential(presentation.documents[0]),
        doctype: presentation.documents[0].docType,
        namespaces: presentation.documents[0].issuerSignedNamespaces,
      } satisfies DcqlMdocCredential
    }
    if (presentation.claimFormat === ClaimFormat.JwtVp) {
      const vc = Array.isArray(presentation.verifiableCredential)
        ? presentation.verifiableCredential[0]
        : presentation.verifiableCredential

      return {
        cryptographic_holder_binding: true,
        credential_format: 'jwt_vc_json',
        authority: this.getAuthorityForCredential(vc),
        claims: vc.jsonCredential as { [key: string]: JsonValue },
        type: vc.type,
      } satisfies DcqlW3cVcCredential
    }
    if (presentation.claimFormat === ClaimFormat.LdpVp) {
      const vc = Array.isArray(presentation.verifiableCredential)
        ? (presentation.verifiableCredential[0] as W3cJsonLdVerifiableCredential)
        : (presentation.verifiableCredential as W3cJsonLdVerifiableCredential)

      const w3cJsonLdCredentialService = agentContext.dependencyManager.resolve(W3cJsonLdCredentialService)
      const expandedTypes = await w3cJsonLdCredentialService.getExpandedTypesForCredential(agentContext, vc)

      return {
        cryptographic_holder_binding: true,
        credential_format: 'ldp_vc',
        authority: this.getAuthorityForCredential(vc),
        claims: vc.jsonCredential as DcqlW3cVcCredential.Claims,
        type: expandedTypes,
      } satisfies DcqlW3cVcCredential
    }
    if (presentation.claimFormat === ClaimFormat.SdJwtW3cVp) {
      const envelopedVc = Array.isArray(presentation.resolvedPresentation.verifiableCredential)
        ? presentation.resolvedPresentation.verifiableCredential[0]
        : presentation.resolvedPresentation.verifiableCredential

      return {
        cryptographic_holder_binding: true,
        credential_format: 'vc+sd-jwt',
        authority: this.getAuthorityForCredential(envelopedVc),
        type: asArray(envelopedVc.resolvedCredential.type),
        claims: envelopedVc.resolvedCredential.toJSON() as { [key: string]: JsonValue },
      } satisfies DcqlW3cVcCredential
    }

    throw new DcqlError('Unsupported claim format for presentation')
  }

  public async getCredentialsForRequest(agentContext: AgentContext, dcqlQuery: DcqlQuery): Promise<DcqlQueryResult> {
    const credentialRecords = await this.queryCredentialsForDcqlQuery(agentContext, dcqlQuery)
    const credentialRecordsWithFormatDuplicates: typeof credentialRecords = []
    const parsedQuery = DcqlQuery.parse(dcqlQuery)

    const dcqlCredentials: DcqlCredential[] = credentialRecords.flatMap((record): DcqlCredential | DcqlCredential[] => {
      if (record.type === 'MdocRecord') {
        credentialRecordsWithFormatDuplicates.push(record)

        // We always extract the first mdoc for querying
        const mdoc = record.firstCredential

        return {
          authority: this.getAuthorityForCredential(mdoc),
          credential_format: 'mso_mdoc',
          doctype: mdoc.docType,
          namespaces: mdoc.issuerSignedNamespaces,
          cryptographic_holder_binding: true,
        } satisfies DcqlCredential
      }

      if (record.type === 'SdJwtVcRecord') {
        const sdJwtVc = record.firstCredential
        const claims = sdJwtVc.prettyClaims as DcqlSdJwtVcCredential.Claims

        // To keep correct mapping of input credential index, we add it twice here (for dc+sd-jwt and vc+sd-jwt)
        credentialRecordsWithFormatDuplicates.push(record, record)
        return [
          {
            authority: this.getAuthorityForCredential(sdJwtVc),
            credential_format: 'dc+sd-jwt',
            vct: record.getTags().vct,
            claims,
            cryptographic_holder_binding: true,
          } satisfies DcqlSdJwtVcCredential,
          {
            authority: this.getAuthorityForCredential(sdJwtVc),
            credential_format: 'vc+sd-jwt',
            vct: record.getTags().vct,
            claims,
            cryptographic_holder_binding: true,
          } satisfies DcqlSdJwtVcCredential,
        ] satisfies [DcqlSdJwtVcCredential, DcqlSdJwtVcCredential]
      }

      if (record.type === 'W3cCredentialRecord') {
        const firstCredential = record.firstCredential
        credentialRecordsWithFormatDuplicates.push(record)
        if (firstCredential.claimFormat === ClaimFormat.LdpVc) {
          return {
            credential_format: 'ldp_vc',
            authority: this.getAuthorityForCredential(firstCredential),
            type: record.getTags().expandedTypes ?? [],
            claims: firstCredential.jsonCredential as DcqlW3cVcCredential.Claims,
            cryptographic_holder_binding: true,
          } satisfies DcqlW3cVcCredential
        }

        return {
          credential_format: 'jwt_vc_json',
          authority: this.getAuthorityForCredential(firstCredential),
          type: firstCredential.type,
          claims: firstCredential.jsonCredential as DcqlW3cVcCredential.Claims,
          cryptographic_holder_binding: true,
        } satisfies DcqlW3cVcCredential
      }

      if (record.type === 'W3cV2CredentialRecord') {
        credentialRecordsWithFormatDuplicates.push(record)
        const firstCredential = record.firstCredential

        return {
          credential_format: 'vc+sd-jwt',
          authority: this.getAuthorityForCredential(firstCredential),
          type: asArray(firstCredential.resolvedCredential.type),
          claims: firstCredential.resolvedCredential.toJSON() as DcqlW3cVcCredential.Claims,
          cryptographic_holder_binding: true,
        } satisfies DcqlW3cVcCredential
      }

      throw new DcqlError('Unsupported record type')
    })

    const queryResult = DcqlQuery.query(parsedQuery, dcqlCredentials)

    const matchesWithRecord = Object.fromEntries(
      Object.entries(queryResult.credential_matches).map(([credential_query_id, result]) => {
        const failedCredentials = result.failed_credentials
          ? mapNonEmptyArray(result.failed_credentials, (credential) => {
              const record = credentialRecordsWithFormatDuplicates[credential.input_credential_index]
              const updatedCredential: DcqlFailedCredential = {
                ...credential,
                record,
                claims: credential.claims.success
                  ? {
                      ...credential.claims,
                      success: true,
                      valid_claim_sets: mapNonEmptyArray(credential.claims.valid_claim_sets, (claimSet) => ({
                        ...claimSet,
                        ...(record.type === 'SdJwtVcRecord'
                          ? // NOTE: we cast from SdJwtVcPayload (which is Record<string, unknown> to { [key: string]: JsonValue })
                            // Otherwise TypeScript explains, but I'm not sure why Record<string, unknown> wouldn't be applicable to { [key: string]: JsonValue }
                            {
                              output: agentContext.dependencyManager
                                .resolve(SdJwtVcService)
                                .applyDisclosuresForPayload(record.encoded, claimSet.output as JsonObject)
                                .prettyClaims as { [key: string]: JsonValue },
                            }
                          : record.type === 'W3cV2CredentialRecord' &&
                              record.firstCredential instanceof W3cV2SdJwtVerifiableCredential
                            ? {
                                output: agentContext.dependencyManager
                                  .resolve(SdJwtVcService)
                                  .applyDisclosuresForPayload(
                                    record.firstCredential.encoded,
                                    claimSet.output as JsonObject
                                  ).prettyClaims as { [key: string]: JsonValue },
                              }
                            : {}),
                      })),
                    }
                  : credential.claims,
              }
              return updatedCredential
            })
          : undefined

        // If not success, valid_credentials will be undefined, so we only have to map failed_credentials
        if (!result.success) {
          return [
            credential_query_id,
            {
              ...result,
              failed_credentials: failedCredentials,
            },
          ]
        }

        return [
          credential_query_id,
          {
            ...result,
            failed_credentials: failedCredentials,
            valid_credentials: mapNonEmptyArray(result.valid_credentials, (credential) => {
              const record = credentialRecordsWithFormatDuplicates[credential.input_credential_index]
              const updatedCredential: DcqlValidCredential = {
                ...credential,
                record,
                claims: {
                  ...credential.claims,
                  valid_claim_sets: mapNonEmptyArray(credential.claims.valid_claim_sets, (claimSet) => ({
                    ...claimSet,
                    ...(record.type === 'SdJwtVcRecord'
                      ? // NOTE: we cast from SdJwtVcPayload (which is Record<string, unknown> to { [key: string]: JsonValue })
                        // Otherwise TypeScript explains, but I'm not sure why Record<string, unknown> wouldn't be applicable to { [key: string]: JsonValue }
                        {
                          output: agentContext.dependencyManager
                            .resolve(SdJwtVcService)
                            .applyDisclosuresForPayload(record.encoded, claimSet.output as JsonObject).prettyClaims as {
                            [key: string]: JsonValue
                          },
                        }
                      : record.type === 'W3cV2CredentialRecord' &&
                          record.firstCredential instanceof W3cV2SdJwtVerifiableCredential
                        ? {
                            output: agentContext.dependencyManager
                              .resolve(SdJwtVcService)
                              .applyDisclosuresForPayload(record.firstCredential.encoded, claimSet.output as JsonObject)
                              .prettyClaims as { [key: string]: JsonValue },
                          }
                        : {}),
                  })),
                },
              }
              return updatedCredential
            }),
          },
        ]
      })
    )

    return {
      ...queryResult,
      credential_matches: matchesWithRecord,
    }
  }

  public async assertValidDcqlPresentation(
    agentContext: AgentContext,
    dcqlPresentation: DcqlPresentation,
    dcqlQuery: DcqlQuery
  ) {
    const internalDcqlPresentation = Object.fromEntries(
      await Promise.all(
        Object.entries(dcqlPresentation).map(async ([credentialId, presentations]) => {
          const queryCredential = dcqlQuery.credentials.find((c) => c.id === credentialId)
          if (!queryCredential) {
            throw new DcqlError(
              `DCQL presentation contains presentation entry for credential id '${credentialId}', but this id is not present in the DCQL query`
            )
          }

          return [
            credentialId,
            await Promise.all(
              presentations.map((presentation) =>
                this.getDcqlCredentialRepresentation(agentContext, presentation, queryCredential)
              )
            ),
          ]
        })
      )
    )

    const presentationResult = DcqlPresentationResult.fromDcqlPresentation(internalDcqlPresentation, { dcqlQuery })

    if (!presentationResult.can_be_satisfied) {
      throw new DcqlError('Presentations do not satisfy the DCQL query.', {
        additionalMessages: Object.entries(presentationResult.credential_matches ?? {})
          .flatMap(([queryId, match]) =>
            match.success
              ? undefined
              : !match.failed_credentials
                ? `Unable to match query credential '${queryId}'. No prsentations provided`
                : match.failed_credentials.map(
                    (failedCredential) =>
                      `Presentation at index ${failedCredential.input_credential_index} does not match query credential '${queryId}'. ${JSON.stringify(
                        {
                          ...(failedCredential.claims.success
                            ? {}
                            : { claims: failedCredential.claims.failed_claim_sets.map((cs) => cs.issues) }),
                          ...(failedCredential.trusted_authorities.success
                            ? {}
                            : {
                                trusted_authorities:
                                  failedCredential.trusted_authorities.failed_trusted_authorities.map(
                                    (ta) => ta.issues
                                  ),
                              }),
                          ...(failedCredential.meta.success ? {} : { meta: failedCredential.meta.issues }),
                        },
                        null,
                        2
                      )}`
                  )
          )
          .filter((message) => message !== undefined),
      })
    }

    return presentationResult
  }

  private dcqlCredentialForRequestForValidCredential(validCredential: DcqlValidCredential) {
    if (validCredential.record.type === 'MdocRecord') {
      return {
        claimFormat: ClaimFormat.MsoMdoc,
        credentialRecord: validCredential.record,
        disclosedPayload: validCredential.claims.valid_claim_sets[0].output as MdocNameSpaces,
      } as const
    }
    if (validCredential.record.type === 'SdJwtVcRecord') {
      return {
        claimFormat: ClaimFormat.SdJwtDc,
        credentialRecord: validCredential.record,
        disclosedPayload: validCredential.claims.valid_claim_sets[0].output as JsonObject,
      } as const
    }

    if (validCredential.record.type === 'W3cCredentialRecord') {
      return {
        claimFormat: validCredential.record.firstCredential.claimFormat,
        credentialRecord: validCredential.record,
        disclosedPayload: validCredential.record.firstCredential.jsonCredential as JsonObject,
      } as const
    }

    if (validCredential.record.type === 'W3cV2CredentialRecord') {
      return {
        claimFormat: validCredential.record.firstCredential.claimFormat,
        credentialRecord: validCredential.record,
        disclosedPayload: validCredential.claims.valid_claim_sets[0].output as JsonObject,
      } as const
    }

    throw new DcqlError('Unsupported record type for DCQL')
  }

  /**
   * Selects the credentials to use based on the output from `getCredentialsForRequest`
   * Use this method if you don't want to manually select the credentials yourself.
   */
  public selectCredentialsForRequest(
    dcqlQueryResult: DcqlQueryResult,
    { useMode = CredentialMultiInstanceUseMode.NewOrFirst }: DcqlSelectCredentialsForRequestOptions = {}
  ): DcqlCredentialsForRequest {
    if (!dcqlQueryResult.can_be_satisfied) {
      throw new DcqlError(
        'Cannot select the credentials for the dcql query presentation if the request cannot be satisfied'
      )
    }

    const credentials: DcqlCredentialsForRequest = {}

    if (dcqlQueryResult.credential_sets) {
      credentialSetLoop: for (const credentialSet of dcqlQueryResult.credential_sets) {
        // undefined defaults to true
        if (credentialSet.required === false) continue
        const fullfillableOptions = credentialSet.matching_options

        if (!fullfillableOptions) {
          throw new DcqlError('Invalid dcql query result. No option is fullfillable')
        }

        for (const fullfillableOption of fullfillableOptions) {
          const optionMatches = fullfillableOption.map((credentialQueryId) => {
            const credentialMatch = dcqlQueryResult.credential_matches[credentialQueryId]
            if (!credentialMatch.success) return undefined
            const match = credentialMatch.valid_credentials.find((match: DcqlValidCredential) =>
              canUseInstanceFromCredentialRecord({ credentialRecord: match.record, useMode })
            )

            if (!match) return undefined
            return {
              match,
              credentialQueryId,
            }
          })

          if (optionMatches.every((c) => c !== undefined)) {
            for (const { match, credentialQueryId } of optionMatches) {
              credentials[credentialQueryId] = [this.dcqlCredentialForRequestForValidCredential(match)]
            }

            continue credentialSetLoop
          }
        }

        throw new DcqlError(
          'Unable to select credentials for credential set. No new credential instance available on any of the available credentials.'
        )
      }
    } else {
      for (const credentialQuery of dcqlQueryResult.credentials) {
        const credentialMatch = dcqlQueryResult.credential_matches[credentialQuery.id]
        if (!credentialMatch.success) {
          throw new DcqlError(
            `Invalid dcql query result for credential query id '${credentialQuery.id}'. Cannot auto-select credentials`
          )
        }

        const credential = credentialMatch.valid_credentials.find((match: DcqlValidCredential) =>
          canUseInstanceFromCredentialRecord({ credentialRecord: match.record, useMode })
        )
        if (!credential) {
          throw new DcqlError(
            `Unable to select credential for credential query id '${credentialQuery.id}'. No new credential instance available on any of the available credentials.`
          )
        }

        credentials[credentialQuery.id] = [this.dcqlCredentialForRequestForValidCredential(credential)]
      }
    }

    return credentials
  }

  public validateDcqlQuery(dcqlQuery: DcqlQuery | DcqlQuery.Input | unknown): DcqlQuery {
    const parsed = DcqlQuery.parse(dcqlQuery as DcqlQuery)
    DcqlQuery.validate(parsed)
    return parsed
  }

  public async createPresentation(
    agentContext: AgentContext,
    options: {
      credentialQueryToCredential: DcqlCredentialsForRequest
      challenge: string
      domain?: string
      mdocSessionTranscript?: MdocSessionTranscriptOptions
    }
  ): Promise<{
    dcqlPresentation: DcqlPresentation
    encodedDcqlPresentation: DcqlEncodedPresentations
  }> {
    const { domain, challenge, mdocSessionTranscript } = options

    const dcqlPresentation: DcqlPresentation = {}
    const encodedDcqlPresentation: DcqlEncodedPresentations = {}
    const vcPresentationsToCreate = getDcqlVcPresentationsToCreate(options.credentialQueryToCredential)

    for (const [credentialQueryId, presentationsToCreate] of Object.entries(vcPresentationsToCreate)) {
      for (const presentationToCreate of presentationsToCreate) {
        let createdPresentation: VerifiablePresentation
        let encodedCreatedPresentation: string | Record<string, unknown>

        if (presentationToCreate.claimFormat === ClaimFormat.MsoMdoc) {
          const mdocRecord = presentationToCreate.credentialRecord
          if (!mdocSessionTranscript) {
            throw new DcqlError('Missing mdoc session transcript options for creating MDOC presentation.')
          }

          const { credentialInstance } = await useInstanceFromCredentialRecord({
            agentContext,
            useMode: presentationToCreate.useMode,
            credentialRecord: mdocRecord,
          })

          const deviceResponse = await MdocDeviceResponse.createDeviceResponse(agentContext, {
            mdocs: [credentialInstance],
            documentRequests: [
              {
                docType: mdocRecord.getTags().docType,
                nameSpaces: Object.fromEntries(
                  Object.entries(presentationToCreate.disclosedPayload).map(([key, value]) => {
                    // FIXME: we need the DCQL query here to get the intent_to_retain from query (currently hardcoded to false)
                    return [key, Object.fromEntries(Object.entries(value).map(([key]) => [key, false]))]
                  })
                ),
              },
            ],
            sessionTranscriptOptions: mdocSessionTranscript,
          })
          const deviceResponseBase64Url = TypedArrayEncoder.toBase64URL(deviceResponse)

          encodedCreatedPresentation = deviceResponseBase64Url
          createdPresentation = MdocDeviceResponse.fromBase64Url(deviceResponseBase64Url)
        } else if (presentationToCreate.claimFormat === ClaimFormat.SdJwtDc) {
          const presentationFrame = buildDisclosureFrameForPayload(presentationToCreate.disclosedPayload)

          if (!domain) {
            throw new DcqlError('Missing domain property for creating SdJwtVc presentation.')
          }

          const { credentialInstance } = await useInstanceFromCredentialRecord({
            agentContext,
            useMode: presentationToCreate.useMode,
            credentialRecord: presentationToCreate.credentialRecord,
          })

          const sdJwtVcApi = this.getSdJwtVcApi(agentContext)
          const presentation = await sdJwtVcApi.present({
            sdJwtVc: credentialInstance,
            presentationFrame,
            verifierMetadata: {
              audience: domain,
              nonce: challenge,
              issuedAt: Math.floor(Date.now() / 1000),
            },
            additionalPayload: presentationToCreate.additionalPayload,
          })

          encodedCreatedPresentation = presentation
          createdPresentation = sdJwtVcApi.fromCompact(presentation)
        } else if (presentationToCreate.claimFormat === ClaimFormat.JwtVp) {
          const { credentialInstance } = await useInstanceFromCredentialRecord({
            agentContext,
            useMode: presentationToCreate.useMode,
            credentialRecord: presentationToCreate.credentialRecord,
          })

          if (!credentialInstance.credentialSubjectIds[0]) {
            throw new DcqlError('Cannot create presentation for credentials without subject id')
          }

          // Determine a suitable verification method for the presentation
          const verificationMethod = await this.getVerificationMethodForSubjectId(
            agentContext,
            credentialInstance.credentialSubjectIds[0]
          )

          const w3cCredentialService = agentContext.resolve(W3cCredentialService)
          const w3cPresentation = new W3cPresentation({
            verifiableCredential: [credentialInstance],
            holder: verificationMethod.controller,
          })

          const publicJwk = getPublicJwkFromVerificationMethod(verificationMethod)

          const signedPresentation = await w3cCredentialService.signPresentation<ClaimFormat.JwtVp>(agentContext, {
            format: ClaimFormat.JwtVp,
            alg: publicJwk.signatureAlgorithm,
            verificationMethod: verificationMethod.id,
            presentation: w3cPresentation,
            challenge,
            domain,
          })

          encodedCreatedPresentation = signedPresentation.encoded
          createdPresentation = signedPresentation
        } else if (presentationToCreate.claimFormat === ClaimFormat.LdpVp) {
          const { credentialInstance } = await useInstanceFromCredentialRecord({
            agentContext,
            useMode: presentationToCreate.useMode,
            credentialRecord: presentationToCreate.credentialRecord,
          })

          if (!credentialInstance.credentialSubjectIds[0]) {
            throw new DcqlError('Cannot create presentation for credentials without subject id')
          }

          // Determine a suitable verification method for the presentation
          const verificationMethod = await this.getVerificationMethodForSubjectId(
            agentContext,
            credentialInstance.credentialSubjectIds[0]
          )

          const w3cCredentialService = agentContext.resolve(W3cCredentialService)
          const w3cPresentation = new W3cPresentation({
            verifiableCredential: [credentialInstance],
            holder: verificationMethod.controller,
          })

          const signedPresentation = await w3cCredentialService.signPresentation(agentContext, {
            format: ClaimFormat.LdpVp,
            // TODO: we should move the check for which proof to use for a presentation to earlier
            // as then we know when determining which VPs to submit already if the proof types are supported
            // by the verifier, and we can then just add this to the vpToCreate interface
            proofType: this.getProofTypeForLdpVc(agentContext, verificationMethod),
            proofPurpose: new purposes.AuthenticationProofPurpose({ challenge, domain }),
            verificationMethod: verificationMethod.id,
            presentation: w3cPresentation,
            challenge,
            domain,
          })

          encodedCreatedPresentation = signedPresentation.encoded
          createdPresentation = signedPresentation
        } else if (presentationToCreate.claimFormat === ClaimFormat.JwtW3cVp) {
          const w3cV2CredentialService = agentContext.resolve(W3cV2CredentialService)
          const w3cV2Presentation = new W3cV2Presentation({
            holder: presentationToCreate.credentialRecord.firstCredential.resolvedCredential.credentialSubjectIds[0],
            verifiableCredential: [
              W3cV2EnvelopedVerifiableCredential.fromVerifiableCredential(
                presentationToCreate.credentialRecord.firstCredential
              ),
            ],
          })

          const signedPresentation = await w3cV2CredentialService.signPresentation<ClaimFormat.JwtW3cVp>(agentContext, {
            format: ClaimFormat.JwtW3cVp,
            presentation: w3cV2Presentation,
            challenge,
            domain,
          })

          encodedCreatedPresentation = signedPresentation.encoded
          createdPresentation = signedPresentation
        } else if (presentationToCreate.claimFormat === ClaimFormat.SdJwtW3cVp) {
          const presentationFrame = buildDisclosureFrameForPayload(presentationToCreate.disclosedPayload)
          if (!domain) {
            throw new DcqlError('Missing domain property for creating SdJwtVc presentation.')
          }

          const w3cV2SdJwtCredentialService = agentContext.resolve(W3cV2SdJwtCredentialService)
          const sdJwtVc = await w3cV2SdJwtCredentialService.present(agentContext, {
            credential: presentationToCreate.credentialRecord.firstCredential.encoded,
            presentationFrame,
          })

          const w3cV2CredentialService = agentContext.resolve(W3cV2CredentialService)
          const w3cV2Presentation = new W3cV2Presentation({
            holder: presentationToCreate.credentialRecord.firstCredential.resolvedCredential.credentialSchemaIds[0],
            verifiableCredential: [W3cV2EnvelopedVerifiableCredential.fromVerifiableCredential(sdJwtVc)],
          })

          const signedPresentation = await w3cV2CredentialService.signPresentation<ClaimFormat.SdJwtW3cVp>(
            agentContext,
            {
              format: ClaimFormat.SdJwtW3cVp,
              presentation: w3cV2Presentation,
              challenge,
              domain,
            }
          )

          encodedCreatedPresentation = signedPresentation.encoded
          createdPresentation = signedPresentation
        } else {
          throw new DcqlError('Unsupported presentation format.')
        }

        if (!dcqlPresentation[credentialQueryId]) {
          dcqlPresentation[credentialQueryId] = [createdPresentation]
        } else {
          dcqlPresentation[credentialQueryId].push(createdPresentation)
        }

        if (!encodedDcqlPresentation[credentialQueryId]) {
          encodedDcqlPresentation[credentialQueryId] = [encodedCreatedPresentation]
        } else {
          encodedDcqlPresentation[credentialQueryId].push(encodedCreatedPresentation)
        }
      }
    }

    return {
      dcqlPresentation,
      encodedDcqlPresentation,
    }
  }

  private getSdJwtVcApi(agentContext: AgentContext) {
    return agentContext.dependencyManager.resolve(SdJwtVcApi)
  }

  private getMdocApi(agentContext: AgentContext) {
    return agentContext.dependencyManager.resolve(MdocApi)
  }

  private async getVerificationMethodForSubjectId(agentContext: AgentContext, subjectId: string) {
    const didsApi = agentContext.dependencyManager.resolve(DidsApi)

    if (!subjectId.startsWith('did:')) {
      throw new DcqlError(`Only dids are supported as credentialSubject id. ${subjectId} is not a valid did`)
    }

    const didDocument = await didsApi.resolveDidDocument(subjectId)

    if (!didDocument.authentication || didDocument.authentication.length === 0) {
      throw new DcqlError(`No authentication verificationMethods found for did ${subjectId} in did document`)
    }

    // the signature suite to use for the presentation is dependant on the credentials we share.
    // 1. Get the verification method for this given proof purpose in this DID document
    let [verificationMethod] = didDocument.authentication
    if (typeof verificationMethod === 'string') {
      verificationMethod = didDocument.dereferenceKey(verificationMethod, ['authentication'])
    }

    return verificationMethod
  }

  // FIXME: We need to take into account OpenID4VP metadata (probably providing supported/allowed algs to the DCQL create presentation method)
  private getProofTypeForLdpVc(agentContext: AgentContext, verificationMethod: VerificationMethod) {
    // For each of the supported algs, find the key types, then find the proof types
    const signatureSuiteRegistry = agentContext.dependencyManager.resolve(SignatureSuiteRegistry)

    const publicJwk = getPublicJwkFromVerificationMethod(verificationMethod)
    const supportedSignatureSuites = signatureSuiteRegistry.getAllByPublicJwkType(publicJwk)
    if (supportedSignatureSuites.length === 0) {
      throw new DcqlError(
        `Couldn't find a supported signature suite for the given jwk ${publicJwk.jwkTypeHumanDescription}`
      )
    }

    return supportedSignatureSuites[0].proofType
  }
}
