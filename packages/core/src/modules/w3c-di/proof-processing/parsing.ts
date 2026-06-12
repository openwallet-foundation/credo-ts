import { TypedArrayEncoder } from '../../../utils'
import { isObject } from '../../../utils/object'
import type { W3cDataIntegrityVerifyFailure } from '../W3cDataIntegrityError'
import { createInvalidResult, createIssue, W3cDataIntegrityProcessingErrorCode } from '../W3cDataIntegrityError'
import type { W3cDataIntegritySecuredDocument } from '../W3cDataIntegrityProof'
import type {
  W3cDataIntegrityVerifyProofDocumentOptions,
  W3cDataIntegrityVerifyProofOptions,
} from '../W3cDataIntegrityProofService'

export interface ParsedW3cDataIntegrityProofDocument {
  normalisedMediaType: string
  securedDocument: W3cDataIntegritySecuredDocument
  verifyOptions: W3cDataIntegrityVerifyProofOptions
}

export type ParseW3cDataIntegrityProofDocumentResult =
  | { ok: true; value: ParsedW3cDataIntegrityProofDocument }
  | { ok: false; result: W3cDataIntegrityVerifyFailure }

/**
 * Implements VC Data Integrity v1.0 §4.4 steps 1-2 document parsing preflight.
 *
 * Validates media type support, parses document bytes as JSON, and ensures
 * a proof container is present before verification dispatch.
 */
export function parseW3cDataIntegrityProofDocument(
  options: W3cDataIntegrityVerifyProofDocumentOptions,
  supportedMediaTypes: string[]
): ParseW3cDataIntegrityProofDocumentResult {
  const normalisedMediaType = options.mediaType.split(';')[0]?.trim().toLowerCase()
  if (!normalisedMediaType || !supportedMediaTypes.includes(normalisedMediaType)) {
    return {
      ok: false,
      result: createInvalidResult(
        createIssue(
          W3cDataIntegrityProcessingErrorCode.ParsingError,
          'Unsupported media type for Data Integrity verification',
          `Received media type '${options.mediaType}'. Supported media types: ${supportedMediaTypes.join(', ')}`
        )
      ),
    }
  }

  let parsedDocument: unknown
  try {
    parsedDocument = JSON.parse(TypedArrayEncoder.toUtf8String(options.documentBytes))
  } catch (error) {
    return {
      ok: false,
      result: createInvalidResult(
        createIssue(
          W3cDataIntegrityProcessingErrorCode.ParsingError,
          'Document bytes could not be parsed as JSON',
          error instanceof Error ? error.message : String(error)
        )
      ),
    }
  }

  if (!isObject(parsedDocument)) {
    return {
      ok: false,
      result: createInvalidResult(
        createIssue(
          W3cDataIntegrityProcessingErrorCode.ParsingError,
          'Parsed Data Integrity document must be a JSON object'
        )
      ),
    }
  }

  const securedDocument = parsedDocument as W3cDataIntegritySecuredDocument
  if (!('proof' in securedDocument)) {
    return {
      ok: false,
      result: createInvalidResult(
        createIssue(W3cDataIntegrityProcessingErrorCode.ParsingError, 'Parsed Data Integrity document has no proof')
      ),
    }
  }

  return {
    ok: true,
    value: {
      normalisedMediaType,
      securedDocument,
      verifyOptions: {
        expectedProofPurpose: options.expectedProofPurpose,
        domain: options.domain,
        challenge: options.challenge,
      },
    },
  }
}
