import type { OpenId4VcRequest } from '../../shared/router'
import type { OpenId4VcVerifierRecord } from '../repository'

export type OpenId4VcVerificationRequest = OpenId4VcRequest<{ verifier: OpenId4VcVerifierRecord }>
