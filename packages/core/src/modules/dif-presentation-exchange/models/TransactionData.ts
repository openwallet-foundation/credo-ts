import { DifPexCredentialsForRequestSubmissionEntry } from './DifPexCredentialsForRequest.js'

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
  inputDescriptor: string
  path: string
  transactionData: TransactionDataEntry[]
  transactionDataResult: TransactionDataResult
}

export type TransactionDataAuthorization = {
  inputDescriptors: string[]
  transactionData: TransactionDataEntry[]
}

export type TransactionDataRequest =
  | {
      transactionDataEntry: TransactionDataEntry
      submissionEntry: DifPexCredentialsForRequestSubmissionEntry
    }[]

export type InputDescriptorToTransactionDataEntry = Record<string, TransactionDataEntry[]>
