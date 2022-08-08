import type { Attachment } from '../../../decorators/attachment/Attachment'
import type { ProofFormat } from './ProofFormat'
import type { ProofFormatService } from './ProofFormatService'
import type { ProofFormatSpec } from './models/ProofFormatSpec'
/**
 * Get the service map for usage in the proofs module. Will return a type mapping of protocol version to service.
 *
 * @example
 * ```
 * type ProofFormatServiceMap = FormatServiceMap<[IndyProofFormat]>
 *
 * // equal to
 * type ProofFormatServiceMap = {
 *   indy: ProofFormatService<IndyCredentialFormat>
 * }
 * ```
 */
export type FormatServiceMap<PFs extends ProofFormat[]> = {
  [PF in PFs[number] as PF['formatKey']]: ProofFormatService<PF>
}

/**
 * Base return type for all methods that create an attachment format.
 *
 * It requires an attachment and a format to be returned.
 */
export interface FormatCreateReturn {
  format: ProofFormatSpec
  attachment: Attachment
}
