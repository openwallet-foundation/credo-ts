import { CredoError, injectable } from '@credo-ts/core'
import type { EnvelopeKeys } from '../DidCommEnvelopeService'
import type { DidCommMessage } from '../DidCommMessage'
import { DidCommModuleConfig } from '../DidCommModuleConfig'
import type { DidCommConnectionRecord } from '../modules/connections/repository'
import type { DidCommVersion } from '../util/didcommVersion'
import { isDidCommV2SignedMessage } from '../util/didcommVersion'
import type { DidCommEnvelopeProtocol } from './DidCommEnvelopeProtocol'
import { DidCommV1EnvelopeProtocol } from './DidCommV1EnvelopeProtocol'
import { DidCommV2EnvelopeProtocol } from './DidCommV2EnvelopeProtocol'

/**
 * Resolves the {@link DidCommEnvelopeProtocol} that applies to a message, holding the selection
 * rules that used to sit inline in the message sender and the message receiver.
 *
 * A caller resolves a protocol once and then calls `pack`/`unpack` on it, in the same way the
 * proofs and credentials APIs resolve their version protocol before acting on it.
 */
@injectable()
export class DidCommEnvelopeProtocolRegistry {
  private v1EnvelopeProtocol: DidCommV1EnvelopeProtocol
  private v2EnvelopeProtocol: DidCommV2EnvelopeProtocol
  private config: DidCommModuleConfig

  public constructor(
    v1EnvelopeProtocol: DidCommV1EnvelopeProtocol,
    v2EnvelopeProtocol: DidCommV2EnvelopeProtocol,
    config: DidCommModuleConfig
  ) {
    this.v1EnvelopeProtocol = v1EnvelopeProtocol
    this.v2EnvelopeProtocol = v2EnvelopeProtocol
    this.config = config
  }

  public getProtocolForDidCommVersion(didcommVersion: 'v1'): DidCommV1EnvelopeProtocol
  public getProtocolForDidCommVersion(didcommVersion: 'v2'): DidCommV2EnvelopeProtocol
  public getProtocolForDidCommVersion(didcommVersion: DidCommVersion): DidCommEnvelopeProtocol
  public getProtocolForDidCommVersion(didcommVersion: DidCommVersion): DidCommEnvelopeProtocol {
    return didcommVersion === 'v2' ? this.v2EnvelopeProtocol : this.v1EnvelopeProtocol
  }

  /**
   * Get the protocol that builds the outbound envelope.
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
  public getProtocolForOutbound({
    message,
    connection,
    keys,
    didcommVersion,
  }: {
    message: DidCommMessage
    connection?: DidCommConnectionRecord
    keys: EnvelopeKeys
    didcommVersion?: DidCommVersion
  }): DidCommEnvelopeProtocol {
    const version = didcommVersion ?? (connection ? (connection.didcommVersion ?? 'v1') : 'v1')

    this.assertMessageSupportsVersion(message, version)

    if (version === 'v2') {
      if (!this.config.isSupported('v2')) {
        throw new CredoError(
          `Cannot send message ${message.type} over DIDComm v2: v2 is not enabled. Add "v2" to didcommVersions in DidCommModuleConfig, or use a v1 connection.`
        )
      }
      if (this.v2EnvelopeProtocol.supportsPacking(keys)) return this.v2EnvelopeProtocol
    }

    return this.v1EnvelopeProtocol
  }

  /**
   * Get the protocol that opens an inbound envelope, from the wire format alone.
   *
   * The v2 test runs first, because a v2 envelope is also a structurally valid JWE.
   */
  public getProtocolForInbound(message: unknown): DidCommEnvelopeProtocol {
    if (this.v2EnvelopeProtocol.supportsUnpacking(message)) {
      this.assertVersionEnabled(message)
      return this.v2EnvelopeProtocol
    }

    if (this.v1EnvelopeProtocol.supportsUnpacking(message)) return this.v1EnvelopeProtocol

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
   * Both the direct send path and the session send path resolve their protocol through
   * {@link getProtocolForOutbound}, so both get this check.
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
