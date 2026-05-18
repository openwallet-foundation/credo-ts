import { TypedArrayEncoder } from '../../../utils'
import { isObject } from '../../../utils/object'
import type { DataIntegrityVerifyFailure } from '../DataIntegrityError'
import { createInvalidResult, createIssue, DataIntegrityProcessingErrorCode } from '../DataIntegrityError'
import type { DataIntegritySecuredDocument } from '../DataIntegrityProof'
import type {
  DataIntegrityVerifyProofDocumentOptions,
  DataIntegrityVerifyProofOptions,
} from '../DataIntegrityProofService'

export interface ParsedDataIntegrityProofDocument {
  normalisedMediaType: string
  securedDocument: DataIntegritySecuredDocument
  verifyOptions: DataIntegrityVerifyProofOptions
}

export type ParseDataIntegrityProofDocumentResult =
  | { ok: true; value: ParsedDataIntegrityProofDocument }
  | { ok: false; result: DataIntegrityVerifyFailure }

/**
 * Implements VC Data Integrity v1.0 §4.4 steps 1-2 document parsing preflight.
 *
 * Validates media type support, parses document bytes as JSON, and ensures
 * a proof container is present before verification dispatch.
 */
export function parseDataIntegrityProofDocument(
  options: DataIntegrityVerifyProofDocumentOptions,
  supportedMediaTypes: string[]
): ParseDataIntegrityProofDocumentResult {
  const normalisedMediaType = options.mediaType.split(';')[0]?.trim().toLowerCase()
  if (!normalisedMediaType || !supportedMediaTypes.includes(normalisedMediaType)) {
    return {
      ok: false,
      result: createInvalidResult(
        createIssue(
          DataIntegrityProcessingErrorCode.ParsingError,
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
          DataIntegrityProcessingErrorCode.ParsingError,
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
          DataIntegrityProcessingErrorCode.ParsingError,
          'Parsed Data Integrity document must be a JSON object'
        )
      ),
    }
  }

  const securedDocument = parsedDocument as DataIntegritySecuredDocument
  if (!('proof' in securedDocument)) {
    return {
      ok: false,
      result: createInvalidResult(
        createIssue(DataIntegrityProcessingErrorCode.ParsingError, 'Parsed Data Integrity document has no proof')
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
