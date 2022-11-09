import type { Attachment } from '../../../decorators/attachment/Attachment'
import type { ProofFormatSpec } from '../models/ProofFormatSpec'
import type { ProofFormat } from './ProofFormat'
import type { ProofFormatService } from './ProofFormatService'

/**
 * Get the service map for usage in the proofs module. Will return a type mapping of protocol version to service.
 *
 * @example
 * ```
 * type FormatServiceMap = ProofFormatServiceMap<[IndyProofFormat]>
 *
 * // equal to
 * type FormatServiceMap = {
 *   indy: ProofFormatServiceMap<IndyCredentialFormat>
 * }
 * ```
 */
export type ProofFormatServiceMap<PFs extends ProofFormat[]> = {
  [PF in PFs[number] as PF['formatKey']]: ProofFormatService<PF>
}

/**
 * Base return type for all methods that create an attachment format.
 *
 * It requires an attachment and a format to be returned.
 */
export interface ProofFormatCreateReturn {
  format: ProofFormatSpec
  attachment: Attachment
}
