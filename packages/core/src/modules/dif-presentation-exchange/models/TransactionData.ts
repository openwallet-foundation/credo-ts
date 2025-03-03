import type { MdocRecord } from '../../mdoc/index'
import type { SdJwtVcRecord } from '../../sd-jwt-vc/index'
import type { W3cCredentialRecord } from '../../vc/index'
import type { DifPexCredentialsForRequestSubmissionEntry } from './DifPexCredentialsForRequest'

export type TransactionDataEntry = {
  type: string
  credential_ids: string[]
  transaction_data_hashes_alg?: string[]
} & Record<string, unknown>

export type TransactionData = TransactionDataEntry[]

export type TransactionDataResult = {
  hashes: string[]
  hashes_alg?: string
}

export type TransactionDataMeta = {
  credentialId: string
  transactionData: TransactionDataEntry[]
  transactionDataResult: TransactionDataResult
}

export type TransactionDataAuthorization = {
  credentials: string[]
  transactionData: TransactionDataEntry[]
}

export type TransactionDataRequest = {
  transactionDataEntry: TransactionDataEntry
  submissionEntry: DifPexCredentialsForRequestSubmissionEntry
}[]

export type DcqlTransactionDataRequest = {
  transactionDataEntry: TransactionDataEntry
  dcql: {
    credentialQueryId: number
    claimSetId: number
    record: W3cCredentialRecord | SdJwtVcRecord | MdocRecord
  }
}[]

export type InputDescriptorToTransactionDataEntry = Record<string, TransactionDataEntry[]>
