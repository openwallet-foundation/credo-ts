import { CredoError, type SdJwtVc } from '@credo-ts/core'

export function getSdJwtVcTransactionDataHashes(sdJwtVc: SdJwtVc) {
  if (!sdJwtVc.kbJwt) {
    return undefined
  }

  const transactionDataHashes = sdJwtVc.kbJwt.payload.transaction_data_hashes
  if (!transactionDataHashes) {
    return undefined
  }

  if (!Array.isArray(transactionDataHashes) || !transactionDataHashes.every((hash) => typeof hash === 'string')) {
    throw new CredoError("Property 'transaction_data_hashes' in SD-JWT VC KB-JWT payload must be an array of strings")
  }

  const transactionDataHashesAlg = sdJwtVc.kbJwt.payload.transaction_data_hashes_alg
  if (typeof transactionDataHashesAlg !== 'string' && transactionDataHashes !== undefined) {
    throw new CredoError("Property 'transaction_data_hashes_alg' in SD-JWT VC KB-JWT payload is not of string")
  }

  return {
    transaction_data_hashes: transactionDataHashes,
    transaction_data_hashes_alg: transactionDataHashesAlg as string | undefined,
  }
}
