import { MultiBaseEncoder, MultiHashEncoder, TypedArrayEncoder, utils } from '@credo-ts/core'
import type { DidCommMessage } from '../DidCommMessage'
import { type ParsedMessageType, parseMessageType, supportsIncomingMessageType } from '../util/messageType'
import type { DidCommV2Attachment, DidCommV2PlaintextMessage } from './types'

const formatAttachmentKeys: Record<string, string> = {
  'https://didcomm.org/issue-credential/2.0/propose-credential': 'filters~attach',
  'https://didcomm.org/issue-credential/2.0/offer-credential': 'offers~attach',
  'https://didcomm.org/issue-credential/2.0/request-credential': 'requests~attach',
  'https://didcomm.org/issue-credential/2.0/issue-credential': 'credentials~attach',
  'https://didcomm.org/present-proof/2.0/propose-presentation': 'proposals~attach',
  'https://didcomm.org/present-proof/2.0/request-presentation': 'request_presentations~attach',
  'https://didcomm.org/present-proof/2.0/presentation': 'presentations~attach',
}

export function getFormatAttachmentKey(type: string): string | undefined {
  let incoming: ParsedMessageType
  try {
    incoming = parseMessageType(type)
  } catch {
    return undefined
  }
  return Object.entries(formatAttachmentKeys).find(([uri]) =>
    supportsIncomingMessageType(incoming, parseMessageType(uri))
  )?.[1]
}

interface AttachmentFormat {
  attach_id: string
  format: string
}

function splitFormatAttachments(
  type: string,
  body: Record<string, unknown>
): { body: Record<string, unknown>; attachments: DidCommV2Attachment[] } {
  const key = getFormatAttachmentKey(type)
  const formats = body.formats as AttachmentFormat[] | undefined
  const attachments = key ? body[key] : undefined
  if (!Array.isArray(formats) || !Array.isArray(attachments)) return { body, attachments: [] }

  const v2Attachments = attachments.map((attachment: Record<string, unknown>) => {
    const v2 = mapV1AttachmentToV2(attachment)
    const format = formats.find((entry) => entry.attach_id === v2.id)?.format
    if (format !== undefined) v2.format = format
    return v2
  })

  const rest = Object.fromEntries(Object.entries(body).filter(([name]) => name !== key && name !== 'formats'))
  // RFC 0454 lets a proposal list a format with no attachment, that entry stays in the body
  const unattachedFormats = formats.filter((entry) => !v2Attachments.some(({ id }) => id === entry.attach_id))

  return {
    body: unattachedFormats.length > 0 ? { ...rest, formats: unattachedFormats } : rest,
    attachments: v2Attachments,
  }
}

const sha256MultiHashPrefix = Uint8Array.of(0x12, 0x20)

// Spec v2.1 does not say how the multihash is written as a string. Multibase base58btc, as in hashlinks
function mapV1DataToV2(data: Record<string, unknown>): DidCommV2Attachment['data'] {
  const { sha256, ...rest } = data
  if (typeof sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(sha256)) return data as DidCommV2Attachment['data']
  const multiHash = TypedArrayEncoder.concat([sha256MultiHashPrefix, TypedArrayEncoder.fromHex(sha256)])
  return { ...rest, hash: MultiBaseEncoder.encode(multiHash, 'base58btc') }
}

function mapV2DataToV1(data: DidCommV2Attachment['data']): Record<string, unknown> {
  if (typeof data?.hash !== 'string') return data
  const { hash, ...rest } = data
  try {
    const multiHash = MultiHashEncoder.decode(MultiBaseEncoder.decode(hash).data)
    if (multiHash.hashName !== 'sha-256' || multiHash.data.length !== 32) return data
    return { ...rest, sha256: TypedArrayEncoder.toHex(multiHash.data) }
  } catch {
    return data
  }
}

/**
 * Map a v1 ~attach item to v2 attachments format.
 * v1: @id, mime-type, data; v2: id, media_type, data.
 */
export function mapV1AttachmentToV2(att: Record<string, unknown>): DidCommV2Attachment {
  const v2: DidCommV2Attachment = {
    id: (att['@id'] ?? att.id) as string,
    data: mapV1DataToV2((att.data ?? {}) as Record<string, unknown>),
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
 * Map a v2 attachment to v1 ~attach item shape.
 * v2: id, media_type, data; v1 (JSON form): @id, mime-type, data.
 *
 * Used when surfacing v2 OOB invitation attachments through the unified invitation
 * record so the existing v1 `requests~attach` consumers can dispatch them.
 */
export function mapV2AttachmentToV1(v2: DidCommV2Attachment): Record<string, unknown> {
  const v1: Record<string, unknown> = {
    '@id': v2.id,
    data: mapV2DataToV1(v2.data),
  }
  if (v2.description !== undefined) v1.description = v2.description
  if (v2.filename !== undefined) v1.filename = v2.filename
  // Spec v2.1 IANA Media Types implies application/ for DIDComm message media types. Extended here to attachments
  if (v2.media_type !== undefined) {
    v1['mime-type'] =
      typeof v2.media_type === 'string' && !v2.media_type.includes('/') ? `application/${v2.media_type}` : v2.media_type
  }
  if (v2.format !== undefined) v1.format = v2.format
  if (v2.lastmod_time !== undefined) v1.lastmod_time = v2.lastmod_time
  if (v2.byte_count !== undefined) v1.byte_count = v2.byte_count
  return v1
}

/**
 * Build a DIDComm v2 plaintext message from a DidCommMessage with the default mapping.
 *
 * Maps v1 shape: @type→type, @id→id, ~thread→thid/pthid, lang or ~l10n→lang, ~please_ack→please_ack, ack→ack,
 * ~attach and the formats + named *~attach array→attachments, ~timing→created_time/expires_time,
 * remaining non-decorator fields→body.
 *
 * A message class whose v2 variant differs from this mapping can call this function from its own
 * `toV2Plaintext()` and then adjust the result, for example to move a body field into a header.
 *
 * @param message - The DidCommMessage to convert
 * @param config - Optional config (e.g. useDidSovPrefixWhereAllowed)
 * @returns A DIDComm v2 plaintext message
 */
export function buildDefaultV2PlaintextFromMessage(
  message: DidCommMessage,
  config?: { useDidSovPrefixWhereAllowed?: boolean }
): DidCommV2PlaintextMessage {
  const v1 = message.toJSON({
    useDidSovPrefixWhereAllowed: config?.useDidSovPrefixWhereAllowed ?? false,
  })

  const {
    '@type': type,
    '@id': id,
    '~thread': thread,
    '~l10n': l10n,
    '~attach': attach,
    '~transport': transport,
    '~please_ack': pleaseAck,
    lang,
    ack,
    from,
    to,
    // A rotation proof is never replayed from a received message. The sender sets it through the config.
    from_prior: _fromPrior,
    ...rest
  } = v1

  const { body, attachments: formatAttachments } = splitFormatAttachments(
    type as string,
    Object.fromEntries(Object.entries(rest).filter(([key]) => !key.startsWith('~')))
  )

  const v2: DidCommV2PlaintextMessage = {
    id: id as string,
    type: type as string,
    body,
  }

  if (from !== undefined) v2.from = from as string
  if (to !== undefined) v2.to = Array.isArray(to) ? (to as string[]) : [to as string]
  if (thread && typeof thread === 'object') {
    if ('thid' in thread && thread.thid !== undefined) v2.thid = thread.thid as string
    if ('pthid' in thread && thread.pthid !== undefined) v2.pthid = thread.pthid as string
  }

  const langVal = (lang ?? (l10n && typeof l10n === 'object' && 'locale' in l10n ? l10n.locale : undefined)) as
    | string
    | undefined
  if (langVal !== undefined) v2.lang = langVal
  if (pleaseAck !== undefined) v2.please_ack = ['']
  if (Array.isArray(ack) && ack.length > 0) v2.ack = ack as string[]

  // DIDComm v2 carries return_route as a top-level header, not the v1 ~transport decorator.
  if (transport && typeof transport === 'object') {
    const returnRoute = (transport as Record<string, unknown>).return_route
    if (returnRoute !== undefined) v2.return_route = returnRoute as string
  }

  const attachments = [
    ...formatAttachments,
    ...(Array.isArray(attach) ? attach.map((a) => mapV1AttachmentToV2(a as Record<string, unknown>)) : []),
  ]
  if (attachments.length > 0) v2.attachments = attachments

  // The headers come from the ~timing decorator only. A body field with the same name is protocol data and stays in the body.
  // Other ~timing fields have no v2 header (spec v2.1 Message Headers)
  const outTime = message.timing?.outTime
  const expiresTime = message.timing?.expiresTime
  if (outTime) v2.created_time = utils.dateToSeconds(outTime)
  if (expiresTime) v2.expires_time = utils.dateToSeconds(expiresTime)

  return v2
}

/**
 * Build a DIDComm v2 plaintext message from a DidCommMessage.
 * For messages that implement toV2Plaintext() (e.g. DidCommBasicMessageV2), uses that directly.
 * Otherwise uses {@link buildDefaultV2PlaintextFromMessage}.
 *
 * @param message - The DidCommMessage to convert
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
    /** Compact JWS to attach as the `from_prior` header (DIDComm V2 DID rotation). */
    fromPrior?: string
  }
): DidCommV2PlaintextMessage {
  const v2Native = message as unknown as { toV2Plaintext?: () => DidCommV2PlaintextMessage }
  const plaintext =
    typeof v2Native.toV2Plaintext === 'function'
      ? v2Native.toV2Plaintext()
      : buildDefaultV2PlaintextFromMessage(message, {
          useDidSovPrefixWhereAllowed: config?.useDidSovPrefixWhereAllowed,
        })

  if (plaintext.from === undefined && config?.from !== undefined) plaintext.from = config.from
  if (plaintext.to === undefined && config?.to !== undefined) {
    plaintext.to = Array.isArray(config.to) ? config.to : [config.to]
  }
  if (plaintext.from_prior === undefined && config?.fromPrior !== undefined) {
    plaintext.from_prior = config.fromPrior
  }
  // thid stays with each class because a problem report carries the reported thread as pthid only
  if (plaintext.pthid === undefined && message.thread?.parentThreadId) plaintext.pthid = message.thread.parentThreadId
  return plaintext
}
