import type { OpenId4VcRequest } from '../../shared/router'
import type { OpenId4VcIssuerRecordWithOptionalClientSecrets } from '../repository'

export type OpenId4VcIssuanceRequest = OpenId4VcRequest<{
  issuer: OpenId4VcIssuerRecordWithOptionalClientSecrets
}>
