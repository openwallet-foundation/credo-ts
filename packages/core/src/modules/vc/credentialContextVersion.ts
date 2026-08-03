import type { JsonObject } from '../../types'
import { asArray } from '../../utils/array'
import { CREDENTIALS_CONTEXT_V1_URL, CREDENTIALS_CONTEXT_V2_URL } from './constants'

/**
 * The Verifiable Credentials Data Model versions that can be expressed using the
 * {@link W3cCredential} and {@link W3cPresentation} models.
 */
export type W3cCredentialDataModelVersion = '1.1' | '2.0'

/**
 * Credential context URLs accepted as the first entry of a credential or presentation
 * `@context`, in order of data model version.
 */
export const DEFAULT_CREDENTIAL_CONTEXTS = [CREDENTIALS_CONTEXT_V1_URL, CREDENTIALS_CONTEXT_V2_URL]

/**
 * Determines the Verifiable Credentials Data Model version based on the base JSON-LD context.
 *
 * Both data models require the base context to be the first entry of the `@context`, which makes
 * it the authoritative signal for the version in use.
 *
 * @returns the data model version, or `undefined` if the context does not start with a known base context.
 */
export function getCredentialContextVersion(
  context: string | Array<string | JsonObject> | undefined
): W3cCredentialDataModelVersion | undefined {
  const baseContext = asArray(context ?? [])[0]

  if (baseContext === CREDENTIALS_CONTEXT_V1_URL) return '1.1'
  if (baseContext === CREDENTIALS_CONTEXT_V2_URL) return '2.0'

  return undefined
}

/**
 * Whether the provided `@context` describes a Verifiable Credentials Data Model 2.0 credential
 * or presentation.
 */
export function isCredentialContextV2(context: string | Array<string | JsonObject> | undefined): boolean {
  return getCredentialContextVersion(context) === '2.0'
}
