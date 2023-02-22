// To parse this data:
//
//   import { Convert, CheqdSchema, CheqdCredentialDefinition, CheqdRevocationRegistryDefinition } from './file'
//
//   const cheqdSchema = Convert.toCheqdSchema(json)
//   const cheqdCredentialDefinition = Convert.toCheqdCredentialDefinition(json)
//   const cheqdRevocationRegistryDefinition = Convert.toCheqdRevocationRegistryDefinition(json)
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

export interface CheqdSchema {
  name: string
  attrNames: string[]
  version: string
}

export interface CheqdCredentialDefinition {
  schemaId: string
  type: 'CL'
  tag: string
  value: CheqdCredentialDefinitionValue
}

export interface CheqdCredentialDefinitionValue {
  primary: { [key: string]: any }
  revocation?: any
}

export interface CheqdRevocationRegistryDefinition {
  revocDefType: 'CL_ACCUM'
  credDefId: string
  tag: string
  value: CheqdRevocationRegistryDefinitionValue
}

export interface CheqdRevocationRegistryDefinitionValue {
  publicKeys: PublicKeys
  maxCredNum: number
  tailsLocation: string
  tailsHash: string
}

export interface PublicKeys {
  accumKey: AccumKey
}

export interface AccumKey {
  z: string
}

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
  public static toCheqdSchema(json: string): CheqdSchema {
    return cast(JSON.parse(json), r('CheqdSchema'))
  }

  public static toCheqdCredentialDefinition(json: string): CheqdCredentialDefinition {
    return cast(JSON.parse(json), r('CheqdCredentialDefinition'))
  }

  public static toCheqdRevocationRegistryDefinition(json: string): CheqdRevocationRegistryDefinition {
    return cast(JSON.parse(json), r('CheqdRevocationRegistryDefinition'))
  }
}

function invalidValue(typ: any, val: any, key: any, parent: any = ''): never {
  const prettyTyp = prettyTypeName(typ)
  const parentText = parent ? ` on ${parent}` : ''
  const keyText = key ? ` for key "${key}"` : ''
  throw Error(`Invalid value${keyText}${parentText}. Expected ${prettyTyp} but got ${JSON.stringify(val)}`)
}

function prettyTypeName(typ: any): string {
  if (Array.isArray(typ)) {
    if (typ.length === 2 && typ[0] === undefined) {
      return `an optional ${prettyTypeName(typ[1])}`
    } else {
      return `one of [${typ
        .map((a) => {
          return prettyTypeName(a)
        })
        .join(', ')}]`
    }
  } else if (typeof typ === 'object' && typ.literal !== undefined) {
    return typ.literal
  } else {
    return typeof typ
  }
}

function jsonToJSProps(typ: any): any {
  if (typ.jsonToJS === undefined) {
    const map: any = {}
    typ.props.forEach((p: any) => (map[p.json] = { key: p.js, typ: p.typ }))
    typ.jsonToJS = map
  }
  return typ.jsonToJS
}

function transform(val: any, typ: any, getProps: any, key: any = '', parent: any = ''): any {
  function transformPrimitive(typ: string, val: any): any {
    if (typeof typ === typeof val) return val
    return invalidValue(typ, val, key, parent)
  }

  function transformUnion(typs: any[], val: any): any {
    // val must validate against one typ in typs
    const l = typs.length
    for (let i = 0; i < l; i++) {
      const typ = typs[i]
      try {
        return transform(val, typ, getProps)
      } catch (_) {
        /**/
      }
    }
    return invalidValue(typs, val, key, parent)
  }

  function transformEnum(cases: string[], val: any): any {
    if (cases.indexOf(val) !== -1) return val
    return invalidValue(
      cases.map((a) => {
        return l(a)
      }),
      val,
      key,
      parent
    )
  }

  function transformArray(typ: any, val: any): any {
    // val must be an array with no invalid elements
    if (!Array.isArray(val)) return invalidValue(l('array'), val, key, parent)
    return val.map((el) => transform(el, typ, getProps))
  }
  let ref: any = undefined
  function transformObject(props: { [k: string]: any }, additional: any, val: any): any {
    if (val === null || typeof val !== 'object' || Array.isArray(val)) {
      return invalidValue(l(ref || 'object'), val, key, parent)
    }
    const result: any = {}
    Object.getOwnPropertyNames(props).forEach((key) => {
      const prop = props[key]
      const v = Object.prototype.hasOwnProperty.call(val, key) ? val[key] : undefined
      result[prop.key] = transform(v, prop.typ, getProps, key, ref)
    })
    Object.getOwnPropertyNames(val).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(props, key)) {
        result[key] = transform(val[key], additional, getProps, key, ref)
      }
    })
    return result
  }

  if (typ === 'any') return val
  if (typ === null) {
    if (val === null) return val
    return invalidValue(typ, val, key, parent)
  }
  if (typ === false) return invalidValue(typ, val, key, parent)
  while (typeof typ === 'object' && typ.ref !== undefined) {
    ref = typ.ref
    typ = typeMap[typ.ref]
  }
  if (Array.isArray(typ)) return transformEnum(typ, val)
  if (typeof typ === 'object') {
    return typ.hasOwnProperty('unionMembers')
      ? transformUnion(typ.unionMembers, val)
      : typ.hasOwnProperty('arrayItems')
      ? transformArray(typ.arrayItems, val)
      : typ.hasOwnProperty('props')
      ? transformObject(getProps(typ), typ.additional, val)
      : invalidValue(typ, val, key, parent)
  }

  return transformPrimitive(typ, val)
}

function cast<T>(val: any, typ: any): T {
  return transform(val, typ, jsonToJSProps)
}

function l(typ: any) {
  return { literal: typ }
}

function a(typ: any) {
  return { arrayItems: typ }
}

function u(...typs: any[]) {
  return { unionMembers: typs }
}

function o(props: any[], additional: any) {
  return { props, additional }
}

function m(additional: any) {
  return { props: [], additional }
}

function r(name: string) {
  return { ref: name }
}

const typeMap: any = {
  CheqdSchema: o(
    [
      { json: 'name', js: 'name', typ: '' },
      { json: 'attrNames', js: 'attrNames', typ: a('') },
      { json: 'version', js: 'version', typ: '' },
    ],
    false
  ),
  CheqdCredentialDefinition: o(
    [
      { json: 'schemaId', js: 'schemaId', typ: '' },
      { json: 'type', js: 'type', typ: '' },
      { json: 'tag', js: 'tag', typ: '' },
      { json: 'value', js: 'value', typ: r('CheqdCredentialDefinitionValue') },
    ],
    false
  ),
  CheqdCredentialDefinitionValue: o(
    [
      { json: 'primary', js: 'primary', typ: m('any') },
      { json: 'revocation', js: 'revocation', typ: u(undefined, 'any') },
    ],
    'any'
  ),
  CheqdRevocationRegistryDefinition: o(
    [
      { json: 'revocDefType', js: 'revocDefType', typ: '' },
      { json: 'credDefId', js: 'credDefId', typ: '' },
      { json: 'tag', js: 'tag', typ: '' },
      { json: 'value', js: 'value', typ: r('CheqdRevocationRegistryDefinitionValue') },
    ],
    false
  ),
  CheqdRevocationRegistryDefinitionValue: o(
    [
      { json: 'publicKeys', js: 'publicKeys', typ: r('PublicKeys') },
      { json: 'maxCredNum', js: 'maxCredNum', typ: 0 },
      { json: 'tailsLocation', js: 'tailsLocation', typ: '' },
      { json: 'tailsHash', js: 'tailsHash', typ: '' },
    ],
    false
  ),
  PublicKeys: o([{ json: 'accumKey', js: 'accumKey', typ: r('AccumKey') }], false),
  AccumKey: o([{ json: 'z', js: 'z', typ: '' }], false),
}
