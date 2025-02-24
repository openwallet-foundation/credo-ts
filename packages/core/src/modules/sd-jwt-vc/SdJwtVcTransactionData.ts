import { Hasher } from '../../crypto/index'
import { JsonEncoder } from '../../utils/JsonEncoder'
import { TypedArrayEncoder } from '../../utils/TypedArrayEncoder'
import { TransactionData } from '../dif-presentation-exchange/index'
import { SdJwtVcError } from './SdJwtVcError'
import { SdJwtVc } from './SdJwtVcService'

export function getTransactionDataHashes(
  kbJwtPayload: Record<string, unknown> & {
    transaction_data_hashes?: string[]
    transaction_data_hashes_alg?: string
  }
): SdJwtVc['transactionData'] {
  if (!kbJwtPayload || !kbJwtPayload.transaction_data_hashes) {
    return
  }

  const transactionDataHashes = kbJwtPayload.transaction_data_hashes
  if (!Array.isArray(transactionDataHashes) || transactionDataHashes.some((hash) => typeof hash !== 'string')) {
    throw new SdJwtVcError('transaction_data_hashes must be an array of string')
  }

  const transactionDataHashesAlg = kbJwtPayload.transaction_data_hashes_alg
  if (transactionDataHashesAlg && typeof transactionDataHashesAlg !== 'string') {
    throw new SdJwtVcError('transaction_data_hashes_alg must be a string')
  }

  return {
    hashes: transactionDataHashes,
    ...(transactionDataHashesAlg && { hashes_alg: transactionDataHashesAlg }),
  }
}

export function getTransactionDataVerifierMetadata(transactionData: TransactionData) {
  const transactionDataHashes = transactionData.map((tdEntry) => {
    const supportedHashAlgs = ['sha-256', 'sha-1']

    const hashName = (tdEntry.transaction_data_hashes_alg ?? ['sha-256']).find((val) => supportedHashAlgs.includes(val))
    if (!hashName) {
      throw new SdJwtVcError(
        `Cannot hash transaction data. Not suitable hashing algorithm found in '${tdEntry.transaction_data_hashes_alg?.join(
          ', '
        )}'`
      )
    }

    const encodedTdEntry = JsonEncoder.toBase64URL(tdEntry)
    const hashed = Hasher.hash(encodedTdEntry, hashName)
    return TypedArrayEncoder.toBase64URL(hashed)
  })

  return {
    transaction_data_hashes: transactionDataHashes,
    // this just makes no sense
    transaction_data_hashes_alg: 'sha-256',
  } as const
}
