type AnyJson = boolean | number | string | null | JsonArray | JsonMap
interface JsonMap {
  [key: string]: AnyJson
}
interface JsonArray extends Array<AnyJson> {}

export { AnyJson, JsonMap, JsonArray }