import type { ProofFormat } from '@credo-ts/didcomm'
import type { AnonCredsProof, AnonCredsProofRequest, AnonCredsSelectedCredentials } from '../models'
import type {
  AnonCredsCredentialsForProofRequest,
  AnonCredsGetCredentialsForProofRequestOptions,
  AnonCredsProposeProofFormat,
  AnonCredsRequestProofFormat,
} from './AnonCredsProofFormat'

// TODO: Custom restrictions to remove `_id` from restrictions?
export type LegacyIndyProofRequest = AnonCredsProofRequest

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
    proposal: LegacyIndyProofRequest
    request: LegacyIndyProofRequest
    presentation: AnonCredsProof
  }
}
