import 'fast-text-encoding'

export * from './OpenId4VcHolderApi'
export * from './issuance/OpenId4VciHolderModule'
export * from './issuance/OpenId4VciHolderService'
// Contains internal types, so we don't export everything
export {
  AuthCodeFlowOptions,
  AcceptCredentialOfferOptions,
  ProofOfPossessionVerificationMethodResolver,
  ProofOfPossessionVerificationMethodResolverOptions,
  RequestCredentialOptions,
  SupportedCredentialFormats,
} from './OpenId4VcHolderServiceOptions'
export * from './presentations'
export { OpenIdCredentialFormatProfile } from './issuance/utils'
