export * from './OpenId4VcVerifierApi'
export * from './OpenId4VcVerifierModule'
export * from './OpenId4VcVerifierService'

// Contains internal types, so we don't export everything
export {
  HolderMetadata as HolderClientMetadata,
  staticOpOpenIdConfig,
  staticOpSiopConfig,
  CreateProofRequestOptions,
  ProofRequestWithMetadata,
} from './OpenId4VcVerifierServiceOptions'
