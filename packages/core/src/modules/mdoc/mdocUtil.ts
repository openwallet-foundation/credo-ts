import type { Document, IssuerSigned, KeyAuthorizations } from '@owf/mdoc'
import type { Mdoc } from './Mdoc'
import { MdocError } from './MdocError'
import type { MdocNameSpaces } from './MdocOptions'

export function isDeviceKeyAuthorizationEnforced(keyAuthorizations?: KeyAuthorizations): boolean {
  if (!keyAuthorizations) return false

  return Boolean(
    keyAuthorizations.namespaces?.length || (keyAuthorizations.dataElements && keyAuthorizations.dataElements.size > 0)
  )
}

export function getDeviceKeyAuthorizationsFromIssuerSigned(issuerSigned: IssuerSigned): KeyAuthorizations | undefined {
  return issuerSigned.issuerAuth.mobileSecurityObject.deviceKeyInfo.keyAuthorizations
}

export function getDeviceKeyAuthorizationsFromMdoc(mdoc: Mdoc): KeyAuthorizations | undefined {
  return getDeviceKeyAuthorizationsFromIssuerSigned(mdoc.issuerSigned)
}

export function assertNameSpacesWithinDeviceKeyAuthorizations(
  keyAuthorizations: KeyAuthorizations | undefined,
  nameSpaces: MdocNameSpaces
): void {
  if (!isDeviceKeyAuthorizationEnforced(keyAuthorizations)) {
    return
  }

  const authorizedNamespaces = keyAuthorizations?.namespaces
  const authorizedDataElements = keyAuthorizations?.dataElements
  const restrictsNamespaces = Boolean(authorizedNamespaces?.length)
  const restrictsElements = Boolean(authorizedDataElements && authorizedDataElements.size > 0)

  for (const [namespace, elements] of Object.entries(nameSpaces)) {
    if (restrictsNamespaces && !authorizedNamespaces?.includes(namespace)) {
      throw new MdocError(`Device key is not authorized for namespace '${namespace}'`)
    }

    if (restrictsElements) {
      const authorizedElementIds = authorizedDataElements?.get(namespace)
      if (!authorizedElementIds) {
        throw new MdocError(`Device key is not authorized for namespace '${namespace}'`)
      }

      for (const elementId of Object.keys(elements)) {
        if (!authorizedElementIds.includes(elementId)) {
          throw new MdocError(
            `Device key is not authorized for data element '${elementId}' in namespace '${namespace}'`
          )
        }
      }
    }
  }
}

export function getDeviceSignedNameSpacesFromDocument(document: Document): MdocNameSpaces {
  const deviceNamespaces = document.deviceSigned.deviceNamespaces?.deviceNamespaces
  if (!deviceNamespaces?.size) return {}

  return Object.fromEntries(
    Array.from(deviceNamespaces.entries()).map(([namespace, items]) => [
      namespace,
      Object.fromEntries(items.deviceSignedItems.entries()),
    ])
  )
}

export function getIssuerSignedNameSpacesFromDocument(document: Document): MdocNameSpaces {
  const issuerNamespaces = document.issuerSigned.issuerNamespaces?.issuerNamespaces
  if (!issuerNamespaces?.size) return {}

  return Object.fromEntries(
    Array.from(issuerNamespaces.entries()).map(([namespace, items]) => [
      namespace,
      Object.fromEntries(items.map((item) => [item.elementIdentifier, item.elementValue])),
    ])
  )
}

export function assertDocumentNameSpacesWithinDeviceKeyAuthorizations(
  keyAuthorizations: KeyAuthorizations | undefined,
  document: Document
): void {
  if (!isDeviceKeyAuthorizationEnforced(keyAuthorizations)) {
    return
  }

  const deviceSignedNameSpaces = getDeviceSignedNameSpacesFromDocument(document)
  const issuerSignedNameSpaces = getIssuerSignedNameSpacesFromDocument(document)

  assertNameSpacesWithinDeviceKeyAuthorizations(keyAuthorizations, deviceSignedNameSpaces)
  assertNameSpacesWithinDeviceKeyAuthorizations(keyAuthorizations, issuerSignedNameSpaces)
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
