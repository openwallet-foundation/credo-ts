import type { DidCommPlaintextMessage } from '../types'
import type { DidCommV2Attachment, DidCommV2PlaintextMessage } from './types'

/**
 * Map a v2 attachment to v1 ~attach format.
 * v2: id, media_type, data; v1: @id, mime-type, data.
 */
function mapV2AttachmentToV1(att: DidCommV2Attachment): Record<string, unknown> {
  const v1: Record<string, unknown> = {
    '@id': att.id,
    data: att.data,
  }
  if (att.description !== undefined) v1.description = att.description
  if (att.filename !== undefined) v1.filename = att.filename
  if (att.media_type !== undefined) v1['mime-type'] = att.media_type
  if (att.format !== undefined) v1.format = att.format
  if (att.lastmod_time !== undefined) v1.lastmod_time = att.lastmod_time
  if (att.byte_count !== undefined) v1.byte_count = att.byte_count
  return v1
}

/**
 * Normalize a DIDComm v2 plaintext message to v1 shape so existing handlers work.
 * Maps: type→@type, id→@id, body→top level, thid/pthid→~thread, lang→~l10n, attachments→~attach.
 * This allows v2 plaintext to be processed by v1 message handlers without changes.
 *
 * @param v2 - The DIDComm v2 plaintext message
 * @returns A v1-shaped plaintext message suitable for transformAndValidate and handler dispatch
 */
export function normalizeV2PlaintextToV1(v2: DidCommV2PlaintextMessage): DidCommPlaintextMessage {
  const { type, id, from, to, thid, pthid, body, lang, attachments, created_time, expires_time, ...rest } = v2

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

  if (lang !== undefined) v1['~l10n'] = { locale: lang }
  
  if (attachments !== undefined && Array.isArray(attachments) && attachments.length > 0) {
    v1['~attach'] = attachments.map(mapV2AttachmentToV1)
  }

  // TODO: Do we need to convert created_time/expires_time from epoch seconds (v2) to Date/~timing (v1)?
  if (created_time !== undefined) v1.created_time = created_time
  if (expires_time !== undefined) v1.expires_time = expires_time

  return v1
}
