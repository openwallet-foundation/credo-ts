import type { AgentContext } from '../../agent'

import { DcqlCredential, DcqlMdocCredential, DcqlPresentationResult, DcqlQuery, DcqlSdJwtVcCredential } from 'dcql'

import { injectable } from 'tsyringe'

import { Mdoc, MdocApi, MdocDeviceResponse, MdocOpenId4VpSessionTranscriptOptions, MdocRecord } from '../mdoc'
import { SdJwtVcApi, SdJwtVcRecord, SdJwtVcService } from '../sd-jwt-vc'
import { buildDisclosureFrameForPayload } from '../sd-jwt-vc/disclosureFrame'
import { ClaimFormat, W3cCredentialRecord, W3cCredentialRepository } from '../vc'

import { DcqlError } from './DcqlError'
import { DcqlCredentialsForRequest, DcqlEncodedPresentations, DcqlPresentation, DcqlQueryResult } from './models'
import { dcqlGetPresentationsToCreate as getDcqlVcPresentationsToCreate } from './utils'
import { TransactionDataAuthorization } from '../dif-presentation-exchange/models/TransactionData'
import { VerifiablePresentation } from '../dif-presentation-exchange/index'

@injectable()
export class DcqlService {
  public constructor() {}
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
    for (const format of formats) {
      if (format !== 'vc+sd-jwt' && format !== 'jwt_vc_json' && format !== 'jwt_vc_json-ld' && format !== 'mso_mdoc') {
        throw new DcqlError(`Unsupported credential format ${format}.`)
      }
    }

    const allRecords: Array<SdJwtVcRecord | W3cCredentialRecord | MdocRecord> = []

    const w3cCredentialRecords =
      formats.has('jwt_vc_json') || formats.has('jwt_vc_json-ld')
        ? await w3cCredentialRepository.getAll(agentContext)
        : []
    allRecords.push(...w3cCredentialRecords)

    const mdocDoctypes = dcqlQuery.credentials
      .filter((credentialQuery) => credentialQuery.format === 'mso_mdoc')
      .map((c) => c.meta?.doctype_value)
    const allMdocCredentialQueriesSpecifyDoctype = mdocDoctypes.every((doctype) => doctype)

    const mdocApi = this.getMdocApi(agentContext)
    if (allMdocCredentialQueriesSpecifyDoctype) {
      const mdocRecords = await mdocApi.findAllByQuery({
        $or: mdocDoctypes.map((docType) => ({
          docType: docType as string,
        })),
      })
      allRecords.push(...mdocRecords)
    } else {
      const mdocRecords = await mdocApi.getAll()
      allRecords.push(...mdocRecords)
    }

    const sdJwtVctValues = dcqlQuery.credentials
      .filter(
        (credentialQuery): credentialQuery is DcqlSdJwtVcCredential.Model => credentialQuery.format === 'vc+sd-jwt'
      )
      .flatMap((c) => c.meta?.vct_values)

    const allSdJwtVcQueriesSpecifyDoctype = sdJwtVctValues.every((vct) => vct)

    const sdJwtVcApi = this.getSdJwtVcApi(agentContext)
    if (allSdJwtVcQueriesSpecifyDoctype) {
      const sdjwtVcRecords = await sdJwtVcApi.findAllByQuery({
        $or: sdJwtVctValues.map((vct) => ({
          vct: vct as string,
        })),
      })
      allRecords.push(...sdjwtVcRecords)
    } else {
      const sdJwtVcRecords = await sdJwtVcApi.getAll()
      allRecords.push(...sdJwtVcRecords)
    }

    return allRecords
  }

  public getDcqlCredentialRepresentation(presentation: VerifiablePresentation): DcqlQueryResult['credentials'] {
    if (presentation.claimFormat === ClaimFormat.SdJwtVc) {
      return {
        credential_format: 'vc+sd-jwt',
        vct: presentation.prettyClaims,
        claims: presentation.prettyClaims as DcqlSdJwtVcCredential.Claims,
      } satisfies DcqlSdJwtVcCredential
    } else if (presentation.claimFormat === ClaimFormat.MsoMdoc) {
      if (presentation.documents.length !== 1) {
        throw new DcqlError('MDOC presentations must contain exactly one document')
      }
      return {
        credential_format: 'mso_mdoc',
        doctype: presentation.documents[0].docType,
        namespaces: presentation.documents[0].issuerSignedNamespaces,
      } satisfies DcqlMdocCredential
    }
    throw new DcqlError('W3C credentials are not supported yet')
  }

  public async getCredentialsForRequest(
    agentContext: AgentContext,
    dcqlQuery: DcqlQuery.Input
  ): Promise<DcqlQueryResult> {
    const credentialRecords = await this.queryCredentialsForDcqlQuery(agentContext, dcqlQuery)

    const dcqlCredentials: DcqlCredential[] = credentialRecords.map((record) => {
      if (record.type === 'MdocRecord') {
        const mdoc = Mdoc.fromBase64Url(record.base64Url)
        return {
          credential_format: 'mso_mdoc',
          doctype: record.getTags().docType,
          namespaces: mdoc.issuerSignedNamespaces,
        } satisfies DcqlMdocCredential
      } else if (record.type === 'SdJwtVcRecord') {
        return {
          credential_format: 'vc+sd-jwt',
          vct: record.getTags().vct,
          claims: this.getSdJwtVcApi(agentContext).fromCompact(record.compactSdJwtVc)
            .prettyClaims as DcqlSdJwtVcCredential.Claims,
        } satisfies DcqlSdJwtVcCredential
      } else {
        // TODO:
        throw new DcqlError('W3C credentials are not supported yet')
      }
    })

    const queryResult = DcqlQuery.query(DcqlQuery.parse(dcqlQuery), dcqlCredentials)
    const matchesWithRecord = Object.fromEntries(
      Object.entries(queryResult.credential_matches).map(([credential_query_id, result]) => {
        if (result.success) {
          if (result.output.credential_format === 'vc+sd-jwt') {
            const sdJwtVcRecord = credentialRecords[result.input_credential_index] as SdJwtVcRecord
            const claims = agentContext.dependencyManager
              .resolve(SdJwtVcService)
              .applyDisclosuresForPayload(sdJwtVcRecord.compactSdJwtVc, result.output.claims).prettyClaims
            return [
              credential_query_id,
              {
                ...result,
                output: { ...result.output, claims },
                record: credentialRecords[result.input_credential_index],
              },
            ]
          }

          return [credential_query_id, { ...result, record: credentialRecords[result.input_credential_index] }]
        } else {
          return [credential_query_id, result]
        }
      })
    )

    return {
      ...queryResult,
      credential_matches: matchesWithRecord,
    }
  }

  public assertValidDcqlPresentation(dcqlPresentation: DcqlPresentation, dcqlQuery: DcqlQuery) {
    const internalDcqlPresentation = Object.fromEntries(
      Object.entries(dcqlPresentation).map(([key, value]) => {
        return [key, this.getDcqlCredentialRepresentation(value)]
      })
    )
    return DcqlPresentationResult.fromDcqlPresentation(internalDcqlPresentation, { dcqlQuery })
  }

  /**
   * Selects the credentials to use based on the output from `getCredentialsForRequest`
   * Use this method if you don't want to manually select the credentials yourself.
   */
  public selectCredentialsForRequest(dcqlQueryResult: DcqlQueryResult): DcqlCredentialsForRequest {
    if (!dcqlQueryResult.canBeSatisfied) {
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
          const credential = dcqlQueryResult.credential_matches[credentialQueryId]

          if (credential.success && credential.record.type === 'MdocRecord' && 'namespaces' in credential.output) {
            credentials[credentialQueryId] = {
              claimFormat: ClaimFormat.MsoMdoc,
              credentialRecord: credential.record,
              disclosedPayload: credential.output.namespaces,
            }
          } else if (
            credential.success &&
            credential.record.type === 'SdJwtVcRecord' &&
            'claims' in credential.output
          ) {
            credentials[credentialQueryId] = {
              claimFormat: ClaimFormat.SdJwtVc,
              credentialRecord: credential.record,
              disclosedPayload: credential.output.claims,
            }
          } else {
            throw new DcqlError('Invalid dcql query result. Cannot auto-select credentials')
          }
        }
      }
    } else {
      for (const credentialQuery of dcqlQueryResult.credentials) {
        const credential = dcqlQueryResult.credential_matches[credentialQuery.id]
        if (credential.success && credential.record.type === 'MdocRecord' && 'namespaces' in credential.output) {
          credentials[credentialQuery.id] = {
            claimFormat: ClaimFormat.MsoMdoc,
            credentialRecord: credential.record,
            disclosedPayload: credential.output.namespaces,
          }
        } else if (credential.success && credential.record.type === 'SdJwtVcRecord' && 'claims' in credential.output) {
          credentials[credentialQuery.id] = {
            claimFormat: ClaimFormat.SdJwtVc,
            credentialRecord: credential.record,
            disclosedPayload: credential.output.claims,
          }
        } else {
          throw new DcqlError('Invalid dcql query result. Cannot auto-select credentials')
        }
      }
    }

    return credentials
  }

  public validateDcqlQuery(dcqlQuery: DcqlQuery.Input | DcqlQuery) {
    return DcqlQuery.parse(dcqlQuery)
  }

  public async createPresentation(
    agentContext: AgentContext,
    options: {
      credentialQueryToCredential: DcqlCredentialsForRequest
      challenge: string
      domain?: string
      openid4vp?: Omit<MdocOpenId4VpSessionTranscriptOptions, 'verifierGeneratedNonce' | 'clientId'>
      transactionDataAuthorization?: TransactionDataAuthorization
    }
  ): Promise<{
    dcqlPresentation: DcqlPresentation
    encodedDcqlPresentation: string
  }> {
    const { domain, challenge, openid4vp } = options

    const dcqlPresentation: DcqlPresentation = {}
    const encodedDcqlPresentation: Record<string, string> = {}

    const vcPresentationsToCreate = getDcqlVcPresentationsToCreate(
      options.credentialQueryToCredential,
      options.transactionDataAuthorization
    )
    for (const [credentialQueryId, presentationToCreate] of Object.entries(vcPresentationsToCreate)) {
      if (presentationToCreate.claimFormat === ClaimFormat.MsoMdoc) {
        const mdocRecord = presentationToCreate.credentialRecord
        if (!openid4vp) {
          throw new DcqlError('Missing openid4vp options for creating MDOC presentation.')
        }

        if (!domain) {
          throw new DcqlError('Missing domain property for creating MDOC presentation.')
        }

        const { deviceResponseBase64Url } = await MdocDeviceResponse.createOpenId4VpDcqlDeviceResponse(agentContext, {
          mdocs: [Mdoc.fromBase64Url(mdocRecord.base64Url)],
          docRequests: [
            {
              itemsRequestData: {
                docType: mdocRecord.getTags().docType,
                nameSpaces: Object.fromEntries(
                  Object.entries(presentationToCreate.disclosedPayload).map(([key, value]) => {
                    return [key, Object.fromEntries(Object.entries(value).map(([key]) => [key, true]))]
                  })
                ),
              },
            },
          ],
          sessionTranscriptOptions: {
            ...openid4vp,
            clientId: domain,
            verifierGeneratedNonce: challenge,
          },
        })

        encodedDcqlPresentation[credentialQueryId] = deviceResponseBase64Url
        dcqlPresentation[credentialQueryId] = MdocDeviceResponse.fromBase64Url(deviceResponseBase64Url)
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
            transactionData: presentationToCreate.transactionData,
          },
        })

        encodedDcqlPresentation[credentialQueryId] = presentation
        dcqlPresentation[credentialQueryId] = sdJwtVcApi.fromCompact(presentation)
      } else {
        throw new DcqlError('W3c Presentation are not yet supported in combination with DCQL.')
      }
    }

    return {
      dcqlPresentation: dcqlPresentation,
      encodedDcqlPresentation: JSON.stringify(encodedDcqlPresentation),
    }
  }

  public getEncodedPresentations(dcqlPresentation: DcqlPresentation): DcqlEncodedPresentations {
    return Object.fromEntries(Object.entries(dcqlPresentation).map(([key, value]) => [key, value.encoded]))
  }

  private getSdJwtVcApi(agentContext: AgentContext) {
    return agentContext.dependencyManager.resolve(SdJwtVcApi)
  }

  private getMdocApi(agentContext: AgentContext) {
    return agentContext.dependencyManager.resolve(MdocApi)
  }
}
