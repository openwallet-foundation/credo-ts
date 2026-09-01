import type { AgentContext } from '@credo-ts/core'
import type { DecryptedDidCommMessageContext, DidCommEnvelopeKey, EnvelopeKeys } from '../DidCommEnvelopeService'
import type { DidCommMessage } from '../DidCommMessage'
import type { DidCommConnectionRecord } from '../modules/connections/repository'
import type { DidCommEncryptedMessage, DidCommPlaintextMessage } from '../types'
import type { DidCommVersion } from '../util/didcommVersion'

export interface DidCommReturnRouteOptions {
  /** The key that signed or encrypted the inbound message. It becomes our recipient key. */
  senderKey: DidCommEnvelopeKey
  /** The key of ours the message was addressed to. It becomes our sender key. */
  recipientKey: DidCommEnvelopeKey
  /** The inbound plaintext, in v1 shape. Carries `to` for the v2 skid lookup. */
  plaintextMessage: DidCommPlaintextMessage
  connection?: DidCommConnectionRecord
}

export interface DidCommPackOptions {
  /**
   * The connection the message goes to, when there is one. An implementation uses it to fill the
   * envelope headers that identify both parties (`from`, `to`, `from_prior` in v2).
   */
  connection?: DidCommConnectionRecord
}

/**
 * One DIDComm envelope version.
 *
 * Each implementation owns everything that is specific to its wire format: the plaintext shape,
 * the key types, the Forward wrapping for mediated routes, and the format detection. A caller
 * selects an implementation once and then sends and receives without knowledge of the version.
 *
 * This mirrors {@link DidCommMessagePickupProtocol} and {@link DidCommCredentialProtocol}, which
 * give the same treatment to their own multi-version capabilities. It is deliberately not named
 * `*Protocol` — enveloping is the encryption layer, not a DIDComm protocol — and not `*Service`,
 * because {@link DidCommEnvelopeService} keeps that exported name for the v1 crypto layer.
 */
export interface DidCommEnvelope<Version extends DidCommVersion = DidCommVersion> {
  readonly version: Version

  /**
   * Whether this implementation can build an envelope from the given key material. V2 needs a
   * sender key and at least one recipient key; v1 accepts anonymous packing.
   */
  supportsPacking(keys: EnvelopeKeys): boolean

  /**
   * Whether the received bytes are an encrypted envelope in this version's wire format. Signed
   * envelopes are not part of this contract: they exist only in v2 and have their own receive path.
   */
  supportsUnpacking(message: unknown): boolean

  /**
   * Build an encrypted envelope. The implementation wraps its own Forward messages for every routing key
   * in `keys`, so a caller never handles mediation itself.
   */
  pack(
    agentContext: AgentContext,
    message: DidCommMessage,
    keys: EnvelopeKeys,
    options?: DidCommPackOptions
  ): Promise<DidCommEncryptedMessage>

  /**
   * Open an encrypted envelope. The returned plaintext is always in v1 shape, so message handlers
   * and the dispatcher stay free of version logic.
   */
  unpack(agentContext: AgentContext, encryptedMessage: DidCommEncryptedMessage): Promise<DecryptedDidCommMessageContext>

  /**
   * Build the key set that a transport session stores so a reply can travel back over the same
   * inbound connection. V2 must also record a resolvable `skid`, because a v2 envelope identifies
   * its sender by reference instead of embedding the key.
   */
  buildReturnRouteKeys(agentContext: AgentContext, options: DidCommReturnRouteOptions): Promise<EnvelopeKeys>
}
