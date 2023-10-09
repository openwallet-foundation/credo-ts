import 'fast-text-encoding'

export * from './OpenId4VcClientApi'
export * from './OpenId4VcClientModule'
export * from './OpenId4VcClientService'
// Contains internal types, so we don't export everything
export {
  AuthCodeFlowOptions,
  GenerateAuthorizationUrlOptions,
  PreAuthCodeFlowOptions,
  ProofOfPossessionVerificationMethodResolver,
  ProofOfPossessionVerificationMethodResolverOptions,
  RequestCredentialOptions,
  SupportedCredentialFormats,
} from './OpenId4VcClientServiceOptions'
export * from './presentations'
export {
  getOpenId4VcCredentialMetadata,
  OpenId4VcCredentialMetadata,
  OpenIdCredentialFormatProfile,
  setOpenId4VcCredentialMetadata,
} from './utils'
