import type { OpenId4VcRequest, OpenId4VcPostRequest } from '../../shared/router'
import type { OpenId4VcIssuerRecord } from '../repository'

export type OpenId4VcIssuanceRequest = OpenId4VcRequest<{ issuer: OpenId4VcIssuerRecord }>
export type OpenId4VcIssuancePostRequest<BodyType> = OpenId4VcPostRequest<BodyType, { issuer: OpenId4VcIssuerRecord }>
