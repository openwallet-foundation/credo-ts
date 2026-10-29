import type { DcqlCredentialsForRequest, DcqlQuery, DcqlQueryResult } from '@credo-ts/core'
import type { DidCommProofFormat } from '../DidCommProofFormat'

export interface DcqlProposalAttachment {
  dcql_query: DcqlQuery
}

export interface DcqlRequestAttachment {
  dcql_query: DcqlQuery
  nonce: string
  audience: string
}

export interface DcqlPresentationAttachment {
  vp_token: Record<string, [string, ...string[]]>
}

export interface DidCommDcqlProofFormat extends DidCommProofFormat {
  formatKey: 'dcql'

  proofFormats: {
    createProposal: {
      dcqlQuery: DcqlQuery
    }

    acceptProposal: {
      dcqlQuery?: DcqlQuery
    }

    createRequest: {
      dcqlQuery: DcqlQuery
      /**
       * The verifier DID for the `audience`. Required without a connection, where it must be the DID of the
       * service of the out-of-band invitation carrying the request.
       */
      audienceDid?: string
    }

    acceptRequest: {
      credentials?: DcqlCredentialsForRequest
    }

    getCredentialsForRequest: {
      input: Record<string, never>
      output: DcqlQueryResult
    }

    selectCredentialsForRequest: {
      input: Record<string, never>
      output: {
        credentials: DcqlCredentialsForRequest
      }
    }
  }

  formatData: {
    proposal: DcqlProposalAttachment
    request: DcqlRequestAttachment
    presentation: DcqlPresentationAttachment
  }
}
