import { MdocError } from './MdocError'
import type { MdocDeviceKeyAuthorizationsOptions, MdocNameSpaces } from './MdocOptions'

/**
 * Ensures device key authorizations only reference namespaces and data elements
 * present in the issuer-signed payload being signed.
 */
export function assertDeviceKeyAuthorizationsMatchNamespaces(
  namespaces: MdocNameSpaces,
  deviceKeyAuthorizations?: MdocDeviceKeyAuthorizationsOptions
): void {
  if (!deviceKeyAuthorizations?.namespaces?.length && !deviceKeyAuthorizations?.dataElements) {
    return
  }

  const issuedNamespaceIds = new Set(Object.keys(namespaces))

  for (const namespace of deviceKeyAuthorizations.namespaces ?? []) {
    if (!issuedNamespaceIds.has(namespace)) {
      throw new MdocError(
        `Device key authorization namespace '${namespace}' is not present in the mdoc issuance namespaces`
      )
    }
  }

  for (const [namespace, dataElements] of Object.entries(deviceKeyAuthorizations.dataElements ?? {})) {
    const issuedElements = namespaces[namespace]
    if (!issuedElements) {
      throw new MdocError(
        `Device key authorization dataElements namespace '${namespace}' is not present in the mdoc issuance namespaces`
      )
    }

    const issuedElementIds = new Set(Object.keys(issuedElements))
    for (const dataElement of dataElements) {
      if (!issuedElementIds.has(dataElement)) {
        throw new MdocError(
          `Device key authorization data element '${dataElement}' is not present in namespace '${namespace}' of the mdoc issuance payload`
        )
      }
    }
  }
}

export function nameSpacesRecordToMap<
  NamespaceValue,
  NameSpaces extends Record<string, Record<string, NamespaceValue>>,
>(nameSpaces: NameSpaces): Map<string, Map<string, NamespaceValue>> {
  return new Map(Object.entries(nameSpaces).map(([key, value]) => [key, new Map(Object.entries(value))] as const))
}

export function namespacesMapToRecord<NamespaceValue, NameSpaces extends Map<string, Map<string, NamespaceValue>>>(
  nameSpaces: NameSpaces
): Record<string, Record<string, NamespaceValue>> {
  return Object.fromEntries(
    Array.from(nameSpaces.entries()).map(([key, value]) => [key, Object.fromEntries(Array.from(value.entries()))])
  )
}
