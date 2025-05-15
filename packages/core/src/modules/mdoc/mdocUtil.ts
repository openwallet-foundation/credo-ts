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
