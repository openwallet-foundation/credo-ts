import type { OpenId4VcRequest, OpenId4VcRequestContext } from '../../shared/router'
import type { OpenId4VcIssuerRecord } from '../repository'

export type OpenId4VcIssuanceRequest = OpenId4VcRequest<{ issuer: OpenId4VcIssuerRecord }>
export type OpenId4VCIssuanceRequestContext = OpenId4VcRequestContext<{ issuer: OpenId4VcIssuerRecord }>
