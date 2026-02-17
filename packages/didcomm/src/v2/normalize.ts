import type { DidCommPlaintextMessage } from '../types'
import type { DidCommV2PlaintextMessage } from './types'

/**
 * Normalize a DIDComm v2 plaintext message to v1 shape so existing handlers work.
 * Maps: type→@type, id→@id, body→top level, thid/pthid→~thread.
 * This allows v2 plaintext to be processed by v1 message handlers without changes.
 *
 * @param v2 - The DIDComm v2 plaintext message
 * @returns A v1-shaped plaintext message suitable for transformAndValidate and handler dispatch
 */
export function normalizeV2PlaintextToV1(v2: DidCommV2PlaintextMessage): DidCommPlaintextMessage {
  const { type, id, from, to, thid, pthid, body, ...rest } = v2

  const v1: DidCommPlaintextMessage = {
    '@type': type,
    '@id': id,
    ...(body ?? {}),
    ...rest,
  }

  if (from !== undefined) v1.from = from
  if (to !== undefined) v1.to = to

  if (thid !== undefined || pthid !== undefined) {
    v1['~thread'] = {}
    if (thid !== undefined) v1['~thread']!.thid = thid
    if (pthid !== undefined) v1['~thread']!.pthid = pthid
  }

  return v1
}
