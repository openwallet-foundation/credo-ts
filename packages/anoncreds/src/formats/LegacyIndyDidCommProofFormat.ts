import type { DidCommProofFormat } from '@credo-ts/didcomm'
import type { AnonCredsProof, AnonCredsProofRequest, AnonCredsSelectedCredentials } from '../models'
import type {
  AnonCredsCredentialsForProofRequest,
  AnonCredsGetCredentialsForProofRequestOptions,
  AnonCredsProposeProofFormat,
  AnonCredsRequestProofFormat,
} from './AnonCredsDidCommProofFormat'

// TODO: Custom restrictions to remove `_id` from restrictions?
export type LegacyIndyProofRequest = AnonCredsProofRequest

export interface LegacyIndyDidCommProofFormat extends DidCommProofFormat {
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
