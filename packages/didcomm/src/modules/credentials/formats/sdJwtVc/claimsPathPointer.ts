import type { ClaimPath, IDisclosureFrame, JsonObject, SdJwtVc } from '@credo-ts/core'
import { CredoError, Hasher, isJsonObject, JsonEncoder, TypedArrayEncoder } from '@credo-ts/core'

/** OpenID4VP section 7.1, without the `null` component */
export function resolveClaimsPathPointer(claims: Record<string, unknown>, pointer: ClaimPath): unknown {
  if (
    !Array.isArray(pointer) ||
    pointer.length === 0 ||
    !pointer.every(
      (component) =>
        typeof component === 'string' ||
        (typeof component === 'number' && Number.isInteger(component) && component >= 0)
    )
  ) {
    throw new CredoError(
      `Claims path pointer ${JSON.stringify(pointer)} must be a non-empty array of strings and non-negative integers`
    )
  }

  let claim: unknown = claims
  for (const component of pointer) {
    if (typeof component === 'string' && isJsonObject(claim) && Object.hasOwn(claim, component)) {
      claim = claim[component]
    } else if (typeof component === 'number' && Array.isArray(claim) && component < claim.length) {
      claim = claim[component]
    } else {
      throw new CredoError(`Claims path pointer ${JSON.stringify(pointer)} does not select a claim of the credential`)
    }
  }

  return claim
}

/** SD-JWT VC section 9.1, where `null` selects all elements of an array */
export function selectClaimsPath(claims: Record<string, unknown>, path: Array<string | number | null>): ClaimPath[] {
  let selected: Array<{ pointer: ClaimPath; value: unknown }> = [{ pointer: [], value: claims }]
  for (const component of path) {
    selected = selected.flatMap(({ pointer, value }) => {
      if (component === null) {
        return Array.isArray(value)
          ? value.map((element, index) => ({ pointer: [...pointer, index], value: element }))
          : []
      }
      if (typeof component === 'string') {
        return isJsonObject(value) && Object.hasOwn(value, component)
          ? [{ pointer: [...pointer, component], value: value[component] }]
          : []
      }
      return Array.isArray(value) && component < value.length
        ? [{ pointer: [...pointer, component], value: value[component] }]
        : []
    })
  }

  return selected.map(({ pointer }) => pointer)
}

export function disclosureFrameFromClaimsPathPointers(pointers: ClaimPath[] = []): IDisclosureFrame | undefined {
  if (pointers.length === 0) return undefined

  // Null prototype, so a claim named like an Object.prototype member such as `__proto__` is a plain key
  const frame: IDisclosureFrame = Object.create(null)
  for (const pointer of pointers) {
    let current = frame
    for (const component of pointer.slice(0, -1)) {
      current[component] ??= Object.create(null)
      current = current[component] as IDisclosureFrame
    }
    current._sd = [...(current._sd ?? []), pointer[pointer.length - 1]]
  }

  return frame
}

type Claim = { value: unknown; disclosable: boolean }

/** RFC 9901 section 4.2.4. Decoy digests are not array elements. */
export function findNotSelectivelyDisclosable(sdJwtVc: SdJwtVc, pointers: ClaimPath[]): ClaimPath | undefined {
  const sdAlg = typeof sdJwtVc.payload._sd_alg === 'string' ? sdJwtVc.payload._sd_alg : 'sha-256'
  const disclosures = new Map(
    sdJwtVc.compact
      .split('~')
      .slice(1, -1)
      .map((disclosure): [string, unknown[]] => [
        TypedArrayEncoder.toBase64Url(Hasher.hash(disclosure, sdAlg)),
        JsonEncoder.fromBase64Url(disclosure),
      ])
  )

  // Each object and array is indexed once, so a large offer and credential can't make this quadratic
  const indexes = new Map<JsonObject | unknown[], Map<string | number, Claim>>()
  const getChildren = (value: JsonObject | unknown[]): Map<string | number, Claim> => {
    const indexed = indexes.get(value)
    if (indexed) return indexed

    const children = new Map<string | number, Claim>()
    if (Array.isArray(value)) {
      for (const element of value) {
        const digest = isJsonObject(element) && Object.keys(element).length === 1 ? element['...'] : undefined
        if (typeof digest !== 'string') {
          children.set(children.size, { value: element, disclosable: false })
          continue
        }

        const disclosure = disclosures.get(digest)
        if (disclosure?.length === 2) children.set(children.size, { value: disclosure[1], disclosable: true })
      }
    } else {
      for (const digest of Array.isArray(value._sd) ? value._sd : []) {
        const disclosure = disclosures.get(digest as string)
        if (disclosure?.length === 3 && typeof disclosure[1] === 'string' && !children.has(disclosure[1])) {
          children.set(disclosure[1], { value: disclosure[2], disclosable: true })
        }
      }
      for (const [name, child] of Object.entries(value)) children.set(name, { value: child, disclosable: false })
    }

    indexes.set(value, children)
    return children
  }

  return pointers.find((pointer) => {
    let claim: Claim | undefined = { value: sdJwtVc.payload, disclosable: false }
    for (const component of pointer) {
      const value: unknown = claim.value
      if (typeof component === 'string' ? !isJsonObject(value) : !Array.isArray(value)) return true

      claim = getChildren(value as JsonObject | unknown[]).get(component)
      if (!claim) return true
    }

    return !claim.disclosable
  })
}
