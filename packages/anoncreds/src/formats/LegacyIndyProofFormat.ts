import type {
  AnonCredsProposeProofFormat,
  AnonCredsRequestProofFormat,
  AnonCredsGetCredentialsForProofRequestOptions,
  AnonCredsCredentialsForProofRequest,
} from './AnonCredsProofFormat'
import type { AnonCredsProof, AnonCredsProofRequest, AnonCredsSelectedCredentials } from '../models'
import type { ProofFormat } from '@aries-framework/core'

export interface LegacyIndyProofFormat extends ProofFormat {
  formatKey: 'indy'

  proofFormats: {
    createProposal: AnonCredsProposeProofFormat
    acceptProposal: {
      name?: string
      version?: string
    }
    createRequest: AnonCredsRequestProofFormat
    acceptRequest: AnonCredsSelectedCredentials

    getCredentialsForRequest: {
      input: AnonCredsGetCredentialsForProofRequestOptions
      output: AnonCredsCredentialsForProofRequest
    }
    selectCredentialsForRequest: {
      input: AnonCredsGetCredentialsForProofRequestOptions
      output: AnonCredsSelectedCredentials
    }
  }

  formatData: {
    // TODO: Custom restrictions to remove `_id` from restrictions?
    proposal: AnonCredsProofRequest
    request: AnonCredsProofRequest
    presentation: AnonCredsProof
  }
}
