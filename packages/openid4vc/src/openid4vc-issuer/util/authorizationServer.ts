import type {
  OpenId4VciAuthorizationCodeFlowConfig,
  OpenId4VciPreAuthorizedCodeFlowConfig,
} from '../OpenId4VcIssuerServiceOptions'
import type { OpenId4VcIssuerRecord } from '../repository'

/**
 * Whether any grant of a credential offer uses the internal (Credo) authorization server, which issues the
 * access and refresh tokens. Chained authorization and presentation during issuance also use it.
 */
export function offerUsesInternalAuthorizationServer(options: {
  issuer: OpenId4VcIssuerRecord
  credentialIssuer: string
  preAuthorizedCodeFlowConfig?: OpenId4VciPreAuthorizedCodeFlowConfig
  authorizationCodeFlowConfig?: OpenId4VciAuthorizationCodeFlowConfig
}) {
  const { issuer, credentialIssuer, preAuthorizedCodeFlowConfig, authorizationCodeFlowConfig } = options
  const isInternal = (authorizationServerUrl?: string) =>
    !authorizationServerUrl || authorizationServerUrl === credentialIssuer

  if (preAuthorizedCodeFlowConfig && isInternal(preAuthorizedCodeFlowConfig.authorizationServerUrl)) return true
  if (!authorizationCodeFlowConfig) return false

  const { authorizationServerUrl, requirePresentationDuringIssuance } = authorizationCodeFlowConfig
  return (
    isInternal(authorizationServerUrl) ||
    requirePresentationDuringIssuance === true ||
    issuer.chainedAuthorizationServerConfigs?.some((config) => config.issuer === authorizationServerUrl) === true
  )
}
