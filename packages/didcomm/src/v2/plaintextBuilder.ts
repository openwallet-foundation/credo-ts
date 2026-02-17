import type { DidCommMessage } from '../DidCommMessage'
import type { DidCommV2PlaintextMessage } from './types'

/**
 * Build a DIDComm v2 plaintext message from a DidCommMessage (v1 shape).
 * Maps @type→type, @id→id, ~thread→thid/pthid, remaining fields→body.
 * Used when packing outbound messages for DIDComm v2.
 *
 * @param message - The v1 DidCommMessage to convert
 * @param config - Optional config (e.g. useDidSovPrefixWhereAllowed, from/to override for connection-based sends)
 * @returns A DIDComm v2 plaintext message
 */
export function buildV2PlaintextFromMessage(
  message: DidCommMessage,
  config?: {
    useDidSovPrefixWhereAllowed?: boolean
    /** Override from (e.g. connection.did) when message doesn't have it */
    from?: string
    /** Override to (e.g. [connection.theirDid]) when message doesn't have it */
    to?: string[]
  }
): DidCommV2PlaintextMessage {
  const v1 = message.toJSON({
    useDidSovPrefixWhereAllowed: config?.useDidSovPrefixWhereAllowed ?? false,
  })

  const { ['@type']: type, ['@id']: id, ['~thread']: thread, from, to, ...rest } = v1

  const v2: DidCommV2PlaintextMessage = {
    id: id as string,
    type: type as string,
    body: rest as Record<string, unknown>,
  }

  const fromVal = (from ?? config?.from) as string | undefined
  const toVal = (to ?? config?.to) as string | string[] | undefined
  if (fromVal !== undefined) v2.from = fromVal
  if (toVal !== undefined) v2.to = Array.isArray(toVal) ? toVal : [toVal as string]
  if (thread && typeof thread === 'object') {
    if ('thid' in thread && thread.thid !== undefined) v2.thid = thread.thid as string
    if ('pthid' in thread && thread.pthid !== undefined) v2.pthid = thread.pthid as string
  }

  return v2
}
