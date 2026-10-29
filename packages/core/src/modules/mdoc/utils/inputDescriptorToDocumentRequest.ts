import { type FieldMatch, parseJsonPath } from 'presentation-exchange'
import type { Mdoc } from '../Mdoc'
import type { MdocDocumentRequest } from '../MdocOptions'

/**
 * The name space and data element a field path of an mdoc input descriptor addresses, such as
 * `$['org.iso.18013.5.1']['family_name']`, or `undefined` for a path that doesn't address one.
 */
function getMdocDataElementForPath(path: string) {
  let segments: ReturnType<typeof parseJsonPath>
  try {
    segments = parseJsonPath(path)
  } catch {
    return undefined
  }

  // A path into a data element, such as `$['org.iso.18013.5.1']['driving_privileges'][0]`, requests the data element
  const [nameSpace, elementIdentifier] = segments
  if (typeof nameSpace !== 'string' || typeof elementIdentifier !== 'string') return undefined

  return { nameSpace, elementIdentifier }
}

/**
 * The document request for an input descriptor of an mdoc, as ISO 18013-7 maps one: the input descriptor id is the
 * doctype, and each field requests the data element of its first path that addresses one, with the field's
 * `intent_to_retain`. A field without such a path requests nothing.
 *
 * With `mdoc`, an optional field only requests a data element the mdoc holds, so the request can be answered with
 * the data elements the mdoc has.
 *
 * Returns `undefined` when the input descriptor requests no data element.
 */
export function inputDescriptorToDocumentRequest(
  inputDescriptor: {
    id: string
    constraints?: { fields?: Array<{ path: string[]; optional?: boolean; intent_to_retain?: boolean }> }
  },
  { mdoc }: { mdoc?: Mdoc } = {}
): MdocDocumentRequest | undefined {
  // Maps, as the name spaces and data elements come from the verifier, and a `__proto__` key must not reach a prototype
  const nameSpaces = new Map<string, Map<string, boolean>>()

  const issuerSignedNamespaces = mdoc?.issuerSignedNamespaces
  const isIssuerSigned = ({ nameSpace, elementIdentifier }: { nameSpace: string; elementIdentifier: string }) =>
    issuerSignedNamespaces !== undefined &&
    Object.hasOwn(issuerSignedNamespaces, nameSpace) &&
    Object.hasOwn(issuerSignedNamespaces[nameSpace], elementIdentifier)

  for (const field of inputDescriptor.constraints?.fields ?? []) {
    const dataElement = field.path.map(getMdocDataElementForPath).find((element) => element !== undefined)
    if (!dataElement) continue
    if (field.optional && issuerSignedNamespaces && !isIssuerSigned(dataElement)) continue

    const dataElements = nameSpaces.get(dataElement.nameSpace) ?? new Map<string, boolean>()
    dataElements.set(dataElement.elementIdentifier, field.intent_to_retain ?? false)
    nameSpaces.set(dataElement.nameSpace, dataElements)
  }

  return toDocumentRequest(inputDescriptor.id, nameSpaces)
}

function toDocumentRequest(
  docType: string,
  nameSpaces: Map<string, Map<string, boolean>>
): MdocDocumentRequest | undefined {
  if (nameSpaces.size === 0) return undefined

  return {
    docType,
    nameSpaces: Object.fromEntries(
      Array.from(nameSpaces, ([nameSpace, dataElements]) => [nameSpace, Object.fromEntries(dataElements)])
    ),
  }
}

/**
 * The document request for the fields an mdoc matched an input descriptor with, as the presentation exchange library
 * reports them: each field requests the data elements its path resolved to, with the field's `intent_to_retain`. So
 * the request asks for exactly what the query matched: the path that resolved of a field with several paths, the
 * data element holding the value of a nested path, and nothing for an optional field the mdoc doesn't have.
 *
 * Returns `undefined` when the fields request no data element.
 */
export function fieldMatchesToDocumentRequest(
  docType: string,
  fieldMatches: Array<Pick<FieldMatch, 'nodes' | 'intent_to_retain'>>
): MdocDocumentRequest | undefined {
  // Maps, as the name spaces and data elements come from the verifier, and a `__proto__` key must not reach a prototype
  const nameSpaces = new Map<string, Map<string, boolean>>()

  for (const fieldMatch of fieldMatches) {
    for (const {
      path: [nameSpace, elementIdentifier],
    } of fieldMatch.nodes) {
      if (typeof nameSpace !== 'string' || typeof elementIdentifier !== 'string') continue

      const dataElements = nameSpaces.get(nameSpace) ?? new Map<string, boolean>()
      // A data element is retained if any field asking for it intends to
      dataElements.set(
        elementIdentifier,
        (dataElements.get(elementIdentifier) ?? false) || (fieldMatch.intent_to_retain ?? false)
      )
      nameSpaces.set(nameSpace, dataElements)
    }
  }

  return toDocumentRequest(docType, nameSpaces)
}
