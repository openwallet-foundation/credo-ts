import type { AgentContext } from '../../agent'
import type { VerifiablePresentation } from '../dif-presentation-exchange/index'

import { DcqlCredential, DcqlMdocCredential, DcqlPresentationResult, DcqlQuery, DcqlSdJwtVcCredential } from 'dcql'
import { injectable } from 'tsyringe'

import { TypedArrayEncoder } from '../../utils'
import {
  Mdoc,
  MdocApi,
  MdocDeviceResponse,
  MdocOpenId4VpDcApiSessionTranscriptOptions,
  MdocOpenId4VpSessionTranscriptOptions,
  MdocRecord,
} from '../mdoc'
import { SdJwtVcApi, SdJwtVcRecord, SdJwtVcService } from '../sd-jwt-vc'
import { buildDisclosureFrameForPayload } from '../sd-jwt-vc/disclosureFrame'
import { ClaimFormat, W3cCredentialRecord, W3cCredentialRepository } from '../vc'

import { DcqlError } from './DcqlError'
import { DcqlCredentialsForRequest, DcqlEncodedPresentations, DcqlPresentation, DcqlQueryResult } from './models'
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

    const w3cCredentialRecords =
      formats.has('jwt_vc_json') || formats.has('ldp_vc') ? await w3cCredentialRepository.getAll(agentContext) : []
    allRecords.push(...w3cCredentialRecords)

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
    } else {
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
    } else {
      const sdJwtVcRecords = await sdJwtVcApi.getAll()
      allRecords.push(...sdJwtVcRecords)
    }

    return allRecords
  }

  public getDcqlCredentialRepresentation(
    presentation: VerifiablePresentation,
    queryCredential: DcqlQuery['credentials'][number]
  ): DcqlQueryResult['credentials'] {
    // SD-JWT credential can be used as both dc+sd-jwt and vc+sd-jwt
    // At some point we might want to look at the header value of the sd-jwt (vc+sd-jwt vc dc+sd-jwt)
    if (presentation.claimFormat === ClaimFormat.SdJwtVc) {
      return {
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
    const credentialRecordsWithFormatDuplicates: typeof credentialRecords = []

    const dcqlCredentials: DcqlCredential[] = credentialRecords.flatMap((record) => {
      if (record.type === 'MdocRecord') {
        credentialRecordsWithFormatDuplicates.push(record)
        const mdoc = Mdoc.fromBase64Url(record.base64Url)
        return {
          credential_format: 'mso_mdoc',
          doctype: record.getTags().docType,
          namespaces: mdoc.issuerSignedNamespaces,
        } satisfies DcqlMdocCredential
      }
      if (record.type === 'SdJwtVcRecord') {
        const claims = this.getSdJwtVcApi(agentContext).fromCompact(record.compactSdJwtVc)
          .prettyClaims as DcqlSdJwtVcCredential.Claims

        // To keep correct mapping of input credential index, we add it twice here (for dc+sd-jwt and vc+sd-jwt)
        credentialRecordsWithFormatDuplicates.push(record, record)
        return [
          {
            credential_format: 'dc+sd-jwt',
            vct: record.getTags().vct,
            claims,
          } satisfies DcqlSdJwtVcCredential,
          {
            credential_format: 'vc+sd-jwt',
            vct: record.getTags().vct,
            claims,
          } satisfies DcqlSdJwtVcCredential,
        ]
      }
      // TODO:
      throw new DcqlError('W3C credentials are not supported yet')
    })

    const queryResult = DcqlQuery.query(DcqlQuery.parse(dcqlQuery), dcqlCredentials)
    const matchesWithRecord = Object.fromEntries(
      Object.entries(queryResult.credential_matches).map(([credential_query_id, result]) => {
        const all = result.all.map((entry) =>
          entry.map((inner) => {
            if (!inner || !inner.success) return inner

            const record = credentialRecordsWithFormatDuplicates[inner.input_credential_index]

            return {
              ...inner,
              output:
                record.type === 'SdJwtVcRecord' &&
                (inner.output.credential_format === 'dc+sd-jwt' || inner.output.credential_format === 'vc+sd-jwt')
                  ? {
                      ...inner.output,
                      claims: agentContext.dependencyManager
                        .resolve(SdJwtVcService)
                        .applyDisclosuresForPayload(record.compactSdJwtVc, inner.output.claims).prettyClaims,
                    }
                  : inner.output,
              record: credentialRecordsWithFormatDuplicates[inner.input_credential_index],
            }
          })
        )

        if (result.success) {
          if (result.output.credential_format === 'vc+sd-jwt' || result.output.credential_format === 'dc+sd-jwt') {
            const sdJwtVcRecord = credentialRecordsWithFormatDuplicates[result.input_credential_index] as SdJwtVcRecord
            const claims = agentContext.dependencyManager
              .resolve(SdJwtVcService)
              .applyDisclosuresForPayload(sdJwtVcRecord.compactSdJwtVc, result.output.claims).prettyClaims

            return [
              credential_query_id,
              {
                ...result,
                all,
                output: { ...result.output, claims },
                record: credentialRecordsWithFormatDuplicates[result.input_credential_index],
              },
            ]
          }

          return [
            credential_query_id,
            { ...result, record: credentialRecordsWithFormatDuplicates[result.input_credential_index], all },
          ]
        }

        return [credential_query_id, { ...result, all }]
      })
    )

    return {
      ...queryResult,
      credential_matches: matchesWithRecord,
    }
  }

  public assertValidDcqlPresentation(dcqlPresentation: DcqlPresentation, dcqlQuery: DcqlQuery) {
    const internalDcqlPresentation = Object.fromEntries(
      Object.entries(dcqlPresentation).map(([credentialId, value]) => {
        const queryCredential = dcqlQuery.credentials.find((c) => c.id === credentialId)
        if (!queryCredential) {
          throw new DcqlError(
            `DCQL presentation contains presentation entry for credential id '${credentialId}', but this id is not present in the DCQL query`
          )
        }

        return [credentialId, this.getDcqlCredentialRepresentation(value, queryCredential)]
      })
    )
    const presentationResult = DcqlPresentationResult.fromDcqlPresentation(internalDcqlPresentation, { dcqlQuery })

    if (!presentationResult.canBeSatisfied) {
      throw new DcqlError('Presentations do not satisfy the DCQL query.', {
        additionalMessages: Object.entries(presentationResult.invalid_matches ?? {}).map(
          ([queryId, match]) =>
            `query '${queryId}' does not match. ${
              // biome-ignore lint/suspicious/noExplicitAny: <explanation>
              JSON.stringify((match as any).flattened?.nested, null, 2)
            }`
        ),
      })
    }

    return presentationResult
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

  public validateDcqlQuery(dcqlQuery: DcqlQuery | DcqlQuery.Input | unknown) {
    return DcqlQuery.parse(dcqlQuery as DcqlQuery)
  }

  public async createPresentation(
    agentContext: AgentContext,
    options: {
      credentialQueryToCredential: DcqlCredentialsForRequest
      challenge: string
      domain?: string
      openid4vp?:
        | Omit<MdocOpenId4VpSessionTranscriptOptions, 'verifierGeneratedNonce'>
        | Omit<MdocOpenId4VpDcApiSessionTranscriptOptions, 'verifierGeneratedNonce'>
    }
  ): Promise<{
    dcqlPresentation: DcqlPresentation
    encodedDcqlPresentation: Record<string, string>
  }> {
    const { domain, challenge, openid4vp } = options

    const dcqlPresentation: DcqlPresentation = {}
    const encodedDcqlPresentation: Record<string, string> = {}

    const vcPresentationsToCreate = getDcqlVcPresentationsToCreate(options.credentialQueryToCredential)
    for (const [credentialQueryId, presentationToCreate] of Object.entries(vcPresentationsToCreate)) {
      if (presentationToCreate.claimFormat === ClaimFormat.MsoMdoc) {
        const mdocRecord = presentationToCreate.credentialRecord
        if (!openid4vp) {
          throw new DcqlError('Missing openid4vp options for creating MDOC presentation.')
        }

        const deviceResponse = await MdocDeviceResponse.createDeviceResponse(agentContext, {
          mdocs: [Mdoc.fromBase64Url(mdocRecord.base64Url)],
          documentRequests: [
            {
              docType: mdocRecord.getTags().docType,
              nameSpaces: Object.fromEntries(
                Object.entries(presentationToCreate.disclosedPayload).map(([key, value]) => {
                  // FIXME: we need the DCQL query here to get the intent_to_retain from query (currnetly hardcoded to false)
                  return [key, Object.fromEntries(Object.entries(value).map(([key]) => [key, false]))]
                })
              ),
            },
          ],
          sessionTranscriptOptions: {
            ...openid4vp,
            verifierGeneratedNonce: challenge,
          },
        })
        const deviceResponseBase64Url = TypedArrayEncoder.toBase64URL(deviceResponse)

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
          },
          additionalPayload: presentationToCreate.additionalPayload,
        })

        encodedDcqlPresentation[credentialQueryId] = presentation
        dcqlPresentation[credentialQueryId] = sdJwtVcApi.fromCompact(presentation)
      } else {
        throw new DcqlError('W3c Presentation are not yet supported in combination with DCQL.')
      }
    }

    return {
      dcqlPresentation: dcqlPresentation,
      encodedDcqlPresentation: encodedDcqlPresentation,
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
