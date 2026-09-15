/**
 * @deprecated The data integrity credential format is no longer anoncreds specific and has moved to
 * `@credo-ts/didcomm` as `DidCommDataIntegrityCredentialFormatService`. Binding a credential to an
 * anoncreds link secret is provided by {@link AnonCredsLinkSecretBindingProvider}, which the
 * `AnonCredsModule` registers for you.
 *
 * Import `DidCommDataIntegrityCredentialFormatService` from `@credo-ts/didcomm` instead. This alias
 * will be removed in the next major version.
 */
export { DidCommDataIntegrityCredentialFormatService as DataIntegrityDidCommCredentialFormatService } from '@credo-ts/didcomm'
