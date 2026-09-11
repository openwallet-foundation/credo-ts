import { CredoError, injectable } from '@credo-ts/core'
import type { EnvelopeKeys } from '../DidCommEnvelopeService'
import type { DidCommMessage } from '../DidCommMessage'
import { DidCommModuleConfig } from '../DidCommModuleConfig'
import type { DidCommConnectionRecord } from '../modules/connections/repository'
import type { DidCommVersion } from '../util/didcommVersion'
import { isDidCommV2SignedMessage } from '../util/didcommVersion'
import type { DidCommEnvelope } from './DidCommEnvelope'
import { DidCommV1Envelope } from './DidCommV1Envelope'
import { DidCommV2Envelope } from './DidCommV2Envelope'

/**
 * Resolves the {@link DidCommEnvelope} that applies to a message, holding the selection
 * rules that used to sit inline in the message sender and the message receiver.
 *
 * A caller resolves an envelope implementation once and then calls `pack`/`unpack` on it, in the
 * same way the proofs and credentials APIs resolve their version protocol before acting on it.
 */
@injectable()
export class DidCommEnvelopeRegistry {
  private v1Envelope: DidCommV1Envelope
  private v2Envelope: DidCommV2Envelope
  private config: DidCommModuleConfig

  public constructor(v1Envelope: DidCommV1Envelope, v2Envelope: DidCommV2Envelope, config: DidCommModuleConfig) {
    this.v1Envelope = v1Envelope
    this.v2Envelope = v2Envelope
    this.config = config
  }

  public getEnvelopeForDidCommVersion(didcommVersion: 'v1'): DidCommV1Envelope
  public getEnvelopeForDidCommVersion(didcommVersion: 'v2'): DidCommV2Envelope
  public getEnvelopeForDidCommVersion(didcommVersion: DidCommVersion): DidCommEnvelope
  public getEnvelopeForDidCommVersion(didcommVersion: DidCommVersion): DidCommEnvelope {
    return didcommVersion === 'v2' ? this.v2Envelope : this.v1Envelope
  }

  /**
   * Get the envelope implementation that builds the outbound envelope.
   *
   * The rules, in order:
   * 1. `didcommVersion` overrides the connection version. The sender passes the envelope version
   *    of the inbound message when it replies over a return-route transport session, because the
   *    peer may have fallen back to a version other than the one stored on the connection.
   * 2. Otherwise the connection's own version decides. Connectionless exchanges default to v1.
   * 3. A message that declares `supportedDidCommVersions` must support the decided version. The
   *    connection handshake messages use this to stay on v1, because no peer DID is resolvable yet.
   * 4. Sending v2 requires v2 to be enabled in `didcommVersions`, and the key material must allow
   *    a v2 envelope (authcrypt needs a sender key).
   */
  public getEnvelopeForOutbound({
    message,
    connection,
    keys,
    didcommVersion,
  }: {
    message: DidCommMessage
    connection?: DidCommConnectionRecord
    keys: EnvelopeKeys
    didcommVersion?: DidCommVersion
  }): DidCommEnvelope {
    const version = didcommVersion ?? (connection ? (connection.didcommVersion ?? 'v1') : 'v1')

    this.assertMessageSupportsVersion(message, version)

    if (version === 'v2') {
      if (!this.config.isSupported('v2')) {
        throw new CredoError(
          `Cannot send message ${message.type} over DIDComm v2: v2 is not enabled. Add "v2" to didcommVersions in DidCommModuleConfig, or use a v1 connection.`
        )
      }
      if (this.v2Envelope.supportsPacking(keys)) return this.v2Envelope
    }

    return this.v1Envelope
  }

  /**
   * Get the envelope implementation that opens an inbound envelope, from the wire format alone.
   *
   * The v2 test runs first, because a v2 envelope is also a structurally valid JWE.
   */
  public getEnvelopeForInbound(message: unknown): DidCommEnvelope {
    if (this.v2Envelope.supportsUnpacking(message)) {
      this.assertVersionEnabled(message)
      return this.v2Envelope
    }

    if (this.v1Envelope.supportsUnpacking(message)) return this.v1Envelope

    throw new CredoError('Unable to parse incoming message: unrecognized envelope format')
  }

  /**
   * Reject a v2 envelope when the agent has not enabled v2.
   */
  public assertVersionEnabled(message: unknown): void {
    if (this.config.isSupported('v2')) return

    const kind = isDidCommV2SignedMessage(message) ? 'signed' : 'encrypted'
    throw new CredoError(
      `Received DIDComm v2 ${kind} message but v2 is not enabled. Add "v2" to didcommVersions in DidCommModuleConfig to accept v2 messages.`
    )
  }

  /**
   * Throw when a message declares the versions it supports and the outbound envelope version is
   * not one of them.
   *
   * Both the direct send path and the session send path resolve their envelope through
   * {@link getEnvelopeForOutbound}, so both get this check.
   */
  private assertMessageSupportsVersion(message: DidCommMessage, didcommVersion: DidCommVersion): void {
    const supported = message.supportedDidCommVersions
    if (!supported || supported.length === 0) return
    if (supported.includes(didcommVersion)) return

    throw new CredoError(
      `Message type ${message.type} only supports DIDComm ${supported.join(', ')} but the outbound envelope uses ${didcommVersion}`
    )
  }
}
