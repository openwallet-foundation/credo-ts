import type { DidCommMessage } from '../DidCommMessage'
import type { DidCommV2Attachment, DidCommV2PlaintextMessage } from './types'

/**
 * Map a v1 ~attach item to v2 attachments format.
 * v1: @id, mime-type, data; v2: id, media_type, data.
 */
function mapV1AttachmentToV2(att: Record<string, unknown>): DidCommV2Attachment {
  const v2: DidCommV2Attachment = {
    id: (att['@id'] ?? att.id) as string,
    data: (att.data ?? {}) as DidCommV2Attachment['data'],
  }
  if (att.description !== undefined) v2.description = att.description as string
  if (att.filename !== undefined) v2.filename = att.filename as string
  const mimeType = att['mime-type'] ?? att.mimeType
  if (mimeType !== undefined) v2.media_type = mimeType as string
  if (att.format !== undefined) v2.format = att.format as string
  if (att.lastmod_time !== undefined) v2.lastmod_time = att.lastmod_time as string
  if (att.byte_count !== undefined) v2.byte_count = att.byte_count as number
  return v2
}

/**
 * Build a DIDComm v2 plaintext message from a DidCommMessage (v1 shape).
 * Maps @type→type, @id→id, ~thread→thid/pthid, ~l10n→lang, ~attach→attachments, remaining fields→body.
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

  const {
    ['@type']: type,
    ['@id']: id,
    ['~thread']: thread,
    ['~l10n']: l10n,
    ['~attach']: attach,
    created_time,
    expires_time,
    from,
    to,
    ...rest
  } = v1

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

  if (l10n && typeof l10n === 'object' && 'locale' in l10n && l10n.locale !== undefined) {
    v2.lang = l10n.locale as string
  }

  if (attach !== undefined && Array.isArray(attach) && attach.length > 0) {
    v2.attachments = attach.map((a) => mapV1AttachmentToV2(a as Record<string, unknown>))
  }

  // TODO: Do we need to convert created_time/expires_time from Date (v1 ~timing) to epoch (v2)?
  if (created_time !== undefined) v2.created_time = created_time as number
  if (expires_time !== undefined) v2.expires_time = expires_time as number

  return v2
}
