import type { Logger } from '@credo-ts/core'
import type { DidCommPlaintextMessage } from '../types'
import { formatAttachmentKeys, mapV2AttachmentToV1 } from './plaintextBuilder'
import type { DidCommV2PlaintextMessage } from './types'

const reservedBodyKeys = [
  '@id',
  '@type',
  'from',
  'to',
  'from_prior',
  'ack',
  'lang',
  'created_time',
  'expires_time',
  // class-transformer also binds a decorator from its property name, not only from its ~ key
  'service',
  'timing',
  'thread',
  'transport',
  'pleaseAck',
  'l10n',
  'appendedAttachments',
]

/**
 * Normalize a DIDComm v2 plaintext message to v1 shape so existing handlers work.
 * Maps: type→@type, id→@id, body→top level, thid/pthid→~thread, lang→lang and ~l10n, please_ack→~please_ack, ack→ack, attachments→~attach.
 * This allows v2 plaintext to be processed by v1 message handlers without changes.
 *
 * @param v2 - The DIDComm v2 plaintext message
 * @returns A v1-shaped plaintext message suitable for transformAndValidate and handler dispatch
 */
export function normalizeV2PlaintextToV1(v2: DidCommV2PlaintextMessage, logger?: Logger): DidCommPlaintextMessage {
  const {
    type,
    id,
    from,
    to,
    thid,
    pthid,
    body,
    lang,
    attachments,
    created_time,
    expires_time,
    return_route,
    please_ack,
    ack,
    from_prior,
  } = v2

  // Unknown headers are ignored (spec v2.1 Message Headers) and v2 has no ~ decorators
  const droppedBodyKeys = Object.keys(body ?? {}).filter((key) => key.startsWith('~') || reservedBodyKeys.includes(key))
  if (droppedBodyKeys.length > 0) {
    logger?.debug('Dropped DIDComm v2 body keys that clash with v1 header or decorator names', {
      type,
      droppedBodyKeys,
    })
  }
  const bodyFields = Object.fromEntries(Object.entries(body ?? {}).filter(([key]) => !droppedBodyKeys.includes(key)))

  const v1: DidCommPlaintextMessage = {
    ...bodyFields,
    '@type': type,
    '@id': id,
  }

  if (from !== undefined) v1.from = from
  if (to !== undefined) v1.to = to
  if (from_prior !== undefined) v1.from_prior = from_prior
  if (ack !== undefined) v1.ack = ack

  if (thid !== undefined || pthid !== undefined) {
    const thread: { thid?: string; pthid?: string } = {}
    if (thid !== undefined) thread.thid = thid
    if (pthid !== undefined) thread.pthid = pthid
    v1['~thread'] = thread
  }

  if (lang !== undefined) {
    v1.lang = lang
    v1['~l10n'] = { locale: lang }
  }

  if (Array.isArray(please_ack) && (please_ack.includes('') || please_ack.includes(id))) {
    v1['~please_ack'] = { on: ['RECEIPT'] }
  }

  const formatAttachmentKey = formatAttachmentKeys[type]
  const formatAttachments =
    formatAttachmentKey && Array.isArray(attachments)
      ? attachments.filter((attachment) => attachment.format !== undefined)
      : []
  if (formatAttachmentKey && formatAttachments.length > 0) {
    v1.formats = [
      ...(Array.isArray(bodyFields.formats) ? bodyFields.formats : []),
      ...formatAttachments.map((attachment) => ({ attach_id: attachment.id, format: attachment.format })),
    ]
    v1[formatAttachmentKey] = formatAttachments.map((attachment) =>
      mapV2AttachmentToV1({ ...attachment, format: undefined })
    )
  }

  const otherAttachments = Array.isArray(attachments)
    ? attachments.filter((attachment) => !formatAttachments.includes(attachment))
    : []
  if (otherAttachments.length > 0) {
    v1['~attach'] = otherAttachments.map(mapV2AttachmentToV1)
  }

  if (return_route !== undefined) {
    v1['~transport'] = { return_route }
  }

  if (created_time !== undefined) v1.created_time = created_time
  if (expires_time !== undefined) v1.expires_time = expires_time

  return v1
}
