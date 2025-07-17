import type { AgentContext } from '../../agent'
import type { VerifiablePresentation } from '../dif-presentation-exchange/index'

import {
  DcqlCredential,
  DcqlMdocCredential,
  DcqlPresentationResult,
  DcqlQuery,
  DcqlSdJwtVcCredential,
  DcqlW3cVcCredential,
} from 'dcql'
import { injectable } from 'tsyringe'

import { TypedArrayEncoder, mapSingleOrArray } from '../../utils'
import { Mdoc, MdocApi, MdocDeviceResponse, MdocNameSpaces, MdocRecord, MdocSessionTranscriptOptions } from '../mdoc'
import { SdJwtVcApi, SdJwtVcRecord, SdJwtVcService } from '../sd-jwt-vc'
import { buildDisclosureFrameForPayload } from '../sd-jwt-vc/disclosureFrame'
import {
  ClaimFormat,
  W3cCredentialRecord,
  W3cCredentialRepository,
  W3cJsonLdCredentialService,
  W3cJsonLdVerifiableCredential,
} from '../vc'

import { JsonObject } from '../../types'
import { X509Certificate } from '../x509'
import { DcqlError } from './DcqlError'
import {
  DcqlCredentialsForRequest,
  DcqlEncodedPresentations,
  DcqlPresentation,
  DcqlQueryResult,
  DcqlValidCredential,
} from './models'
import { dcqlGetPresentationsToCreate as getDcqlVcPresentationsToCreate } from './utils'

@injectable()
export class DcqlService {
  /**
   * Queries the wallet for credentials that match the given dcql query. This only does an initial query based on the
   * schema of the input descriptors. It does not do any further filtering based on the constraints in the input descriptors.
   */
  private async queryCredentialsForDcqlQuery(
    agentContext: AgentContext,
    dcqlQuery: DcqlQuery.Input
  ): Promise<Array<SdJwtVcRecord | W3cCredentialRecord | MdocRecord>> {
    const w3cCredentialRepository = agentContext.dependencyManager.resolve(W3cCredentialRepository)

    const formats = new Set(dcqlQuery.credentials.map((c) => c.format))
    const allRecords: Array<SdJwtVcRecord | W3cCredentialRecord | MdocRecord> = []

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

    const sdJwtVctValues = dcqlQuery.credentials
      .filter(
        (credentialQuery): credentialQuery is DcqlSdJwtVcCredential.Model =>
          credentialQuery.format === 'vc+sd-jwt' || credentialQuery.format === 'dc+sd-jwt'
      )
      .flatMap((c) => c.meta?.vct_values)

    const sdJwtVcApi = this.getSdJwtVcApi(agentContext)
    if (sdJwtVctValues.every((vct) => vct !== undefined)) {
      const sdjwtVcRecords = await sdJwtVcApi.findAllByQuery({
        $or: sdJwtVctValues.map((vct) => ({
          vct: vct as string,
        })),
      })
      allRecords.push(...sdjwtVcRecords)
    } else if (formats.has('dc+sd-jwt') || formats.has('vc+sd-jwt')) {
      const sdJwtVcRecords = await sdJwtVcApi.getAll()
      allRecords.push(...sdJwtVcRecords)
    }

    if (formats.has('jwt_vc_json')) {
      const w3cRecords = await w3cCredentialRepository.findByQuery(agentContext, {
        claimFormat: ClaimFormat.JwtVc,

        // For jwt_vc_json we query the non-exapnded types
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

    return allRecords
  }

  public async getDcqlCredentialRepresentation(
    agentContext: AgentContext,
    presentation: VerifiablePresentation,
    queryCredential: DcqlQuery['credentials'][number]
  ): Promise<DcqlQueryResult['credentials']> {
    // SD-JWT credential can be used as both dc+sd-jwt and vc+sd-jwt
    // At some point we might want to look at the header value of the sd-jwt (vc+sd-jwt vc dc+sd-jwt)
    if (presentation.claimFormat === ClaimFormat.SdJwtVc) {
      return {
        cryptographic_holder_binding: true,
        credential_format: queryCredential.format === 'dc+sd-jwt' ? 'dc+sd-jwt' : 'vc+sd-jwt',
        vct: presentation.prettyClaims.vct,
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
        doctype: presentation.documents[0].docType,
        namespaces: presentation.documents[0].issuerSignedNamespaces,
      } satisfies DcqlMdocCredential
    }
    if (presentation.claimFormat === ClaimFormat.JwtVp) {
      const vc = Array.isArray(presentation.verifiableCredential)
        ? presentation.verifiableCredential[0].jsonCredential
        : presentation.verifiableCredential

      return {
        cryptographic_holder_binding: true,
        credential_format: 'jwt_vc_json',
        claims: vc.jsonCredential,
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
        claims: vc.jsonCredential,
        type: expandedTypes,
      } satisfies DcqlW3cVcCredential
    }

    throw new DcqlError('Unsupported claim format for presentation')
  }

  public async getCredentialsForRequest(
    agentContext: AgentContext,
    dcqlQuery: DcqlQuery.Input
  ): Promise<DcqlQueryResult> {
    const credentialRecords = await this.queryCredentialsForDcqlQuery(agentContext, dcqlQuery)
    const credentialRecordsWithFormatDuplicates: typeof credentialRecords = []

    const dcqlCredentials: DcqlCredential[] = credentialRecords.flatMap((record) => {
      if (record.type === 'MdocRecord') {
        credentialRecordsWithFormatDuplicates.push(record)
        const mdoc = Mdoc.fromBase64Url(record.base64Url)

        const akiHex = X509Certificate.fromRawCertificate(mdoc.signingCertificate).authorityKeyIdentifier
        const aki = akiHex ? TypedArrayEncoder.toBase64URL(TypedArrayEncoder.fromHex(akiHex)) : undefined

        return {
          authority: aki
            ? {
                type: 'aki',
                value: aki,
              }
            : undefined,
          credential_format: 'mso_mdoc',
          doctype: record.getTags().docType,
          namespaces: mdoc.issuerSignedNamespaces,
          cryptographic_holder_binding: true,
        } satisfies DcqlMdocCredential
      }

      if (record.type === 'SdJwtVcRecord') {
        const sdJwtVc = this.getSdJwtVcApi(agentContext).fromCompact(record.compactSdJwtVc)
        const claims = sdJwtVc.prettyClaims as DcqlSdJwtVcCredential.Claims

        // FIXME: we should pass AKI from all certs: https://github.com/openwallet-foundation-labs/dcql-ts/issues/65
        const signingCertificate = (sdJwtVc.header.x5c as string[] | undefined)?.[0]
        const akiHex = signingCertificate
          ? X509Certificate.fromEncodedCertificate(signingCertificate).authorityKeyIdentifier
          : undefined
        const authority = akiHex
          ? {
              type: 'aki',
              value: TypedArrayEncoder.toBase64URL(TypedArrayEncoder.fromHex(akiHex)),
            }
          : undefined

        // To keep correct mapping of input credential index, we add it twice here (for dc+sd-jwt and vc+sd-jwt)
        credentialRecordsWithFormatDuplicates.push(record, record)
        return [
          {
            authority,
            credential_format: 'dc+sd-jwt',
            vct: record.getTags().vct,
            claims,
            cryptographic_holder_binding: true,
          } satisfies DcqlSdJwtVcCredential,
          {
            authority,
            credential_format: 'vc+sd-jwt',
            vct: record.getTags().vct,
            claims,
            cryptographic_holder_binding: true,
          } satisfies DcqlSdJwtVcCredential,
        ]
      }

      if (record.type === 'W3cCredentialRecord') {
        credentialRecordsWithFormatDuplicates.push(record)
        if (record.credential.claimFormat === ClaimFormat.LdpVc) {
          return {
            credential_format: 'ldp_vc',
            type: record.getTags().expandedTypes ?? [],
            claims: record.credential.jsonCredential,
            cryptographic_holder_binding: true,
          } satisfies DcqlW3cVcCredential
        }

        return {
          credential_format: 'jwt_vc_json',
          type: record.credential.type,
          claims: record.credential.jsonCredential,
          cryptographic_holder_binding: true,
        }
      }

      throw new DcqlError('Unsupported record type')
    })

    const queryResult = DcqlQuery.query(DcqlQuery.parse(dcqlQuery), dcqlCredentials)

    const matchesWithRecord = Object.fromEntries(
      Object.entries(queryResult.credential_matches).map(([credential_query_id, result]) => {
        const updatedResult = {
          ...result,
          valid_credentials: result.valid_credentials?.map((credential) => {
            const record = credentialRecordsWithFormatDuplicates[credential.input_credential_index]
            return {
              ...credential,
              record,
              claims: {
                ...credential.claims,
                valid_claim_sets: credential.claims.valid_claim_sets.map((claimSet) => ({
                  ...claimSet,
                  ...(record.type === 'SdJwtVcRecord'
                    ? {
                        output: agentContext.dependencyManager
                          .resolve(SdJwtVcService)
                          .applyDisclosuresForPayload(record.compactSdJwtVc, claimSet.output as JsonObject)
                          .prettyClaims,
                      }
                    : {}),
                })),
              },
            }
          }),

          failed_credentials: result.failed_credentials?.map((credential) => {
            const record = credentialRecordsWithFormatDuplicates[credential.input_credential_index]
            return {
              ...credential,
              record,
              claims: {
                ...credential.claims,
                valid_claim_sets: credential.claims.valid_claim_sets?.map((claimSet) => ({
                  ...claimSet,
                  ...(record.type === 'SdJwtVcRecord'
                    ? {
                        output: agentContext.dependencyManager
                          .resolve(SdJwtVcService)
                          .applyDisclosuresForPayload(record.compactSdJwtVc, claimSet.output as JsonObject)
                          .prettyClaims,
                      }
                    : {}),
                })),
              },
            }
          }),
        }

        return [credential_query_id, updatedResult]
      })
    )

    return {
      ...queryResult,
      credential_matches: matchesWithRecord,
    } as DcqlQueryResult
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
                              trusted_authorities: failedCredential.trusted_authorities.failed_trusted_authorities.map(
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
        claimFormat: ClaimFormat.SdJwtVc,
        credentialRecord: validCredential.record,
        disclosedPayload: validCredential.claims.valid_claim_sets[0].output as JsonObject,
      } as const
    }

    if (validCredential.record.type === 'W3cCredentialRecord') {
      return {
        claimFormat: validCredential.record.credential.claimFormat,
        credentialRecord: validCredential.record,
        disclosedPayload: validCredential.record.credential.jsonCredential as JsonObject,
      } as const
    }

    throw new DcqlError('Unsupported record type for DCQL')
  }

  /**
   * Selects the credentials to use based on the output from `getCredentialsForRequest`
   * Use this method if you don't want to manually select the credentials yourself.
   */
  public selectCredentialsForRequest(dcqlQueryResult: DcqlQueryResult): DcqlCredentialsForRequest {
    if (!dcqlQueryResult.can_be_satisfied) {
      throw new DcqlError(
        'Cannot select the credentials for the dcql query presentation if the request cannot be satisfied'
      )
    }

    const credentials: DcqlCredentialsForRequest = {}

    if (dcqlQueryResult.credential_sets) {
      for (const credentialSet of dcqlQueryResult.credential_sets) {
        // undefined defaults to true
        if (credentialSet.required === false) continue
        const firstFullFillableOption = credentialSet.options.find((option) =>
          option.every((credential_id) => dcqlQueryResult.credential_matches[credential_id].success)
        )

        if (!firstFullFillableOption) {
          throw new DcqlError('Invalid dcql query result. No option is fullfillable')
        }

        for (const credentialQueryId of firstFullFillableOption) {
          const credentialMatch = dcqlQueryResult.credential_matches[credentialQueryId]

          if (!credentialMatch.success) {
            throw new DcqlError('Invalid dcql query result. Cannot auto-select credentials')
          }

          const credential = credentialMatch.valid_credentials[0]
          credentials[credentialQueryId] = this.dcqlCredentialForRequestForValidCredential(credential)
        }
      }
    } else {
      for (const credentialQuery of dcqlQueryResult.credentials) {
        const credentialMatch = dcqlQueryResult.credential_matches[credentialQuery.id]
        if (!credentialMatch.success) {
          throw new DcqlError('Invalid dcql query result. Cannot auto-select credentials')
        }

        const credential = credentialMatch.valid_credentials[0]
        credentials[credentialQuery.id] = this.dcqlCredentialForRequestForValidCredential(credential)
      }
    }

    return credentials
  }

  public validateDcqlQuery(dcqlQuery: DcqlQuery | DcqlQuery.Input | unknown) {
    return DcqlQuery.parse(dcqlQuery as DcqlQuery)
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

          const deviceResponse = await MdocDeviceResponse.createDeviceResponse(agentContext, {
            mdocs: [Mdoc.fromBase64Url(mdocRecord.base64Url)],
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
        } else if (presentationToCreate.claimFormat === ClaimFormat.SdJwtVc) {
          const presentationFrame = buildDisclosureFrameForPayload(presentationToCreate.disclosedPayload)

          if (!domain) {
            throw new DcqlError('Missing domain property for creating SdJwtVc presentation.')
          }

          const sdJwtVcApi = this.getSdJwtVcApi(agentContext)
          const presentation = await sdJwtVcApi.present({
            compactSdJwtVc: presentationToCreate.credentialRecord.compactSdJwtVc,
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
        } else {
          throw new DcqlError('W3c Presentation are not yet supported in combination with DCQL.')
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

  public getEncodedPresentations(dcqlPresentation: DcqlPresentation): DcqlEncodedPresentations {
    return Object.fromEntries(
      Object.entries(dcqlPresentation).map(([key, value]) => [key, mapSingleOrArray(value, (v) => v.encoded)])
    ) as DcqlEncodedPresentations
  }

  private getSdJwtVcApi(agentContext: AgentContext) {
    return agentContext.dependencyManager.resolve(SdJwtVcApi)
  }

  private getMdocApi(agentContext: AgentContext) {
    return agentContext.dependencyManager.resolve(MdocApi)
  }
}
