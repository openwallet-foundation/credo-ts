import type { OpenId4VcRequest } from '../../shared/router'
import type { OpenId4VcIssuerRecord } from '../repository'

export type OpenId4VcIssuanceRequest = OpenId4VcRequest<{ issuer: OpenId4VcIssuerRecord }>
