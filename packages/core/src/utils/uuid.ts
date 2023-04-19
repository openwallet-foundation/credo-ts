import { v4, validate } from 'uuid'

export function uuid() {
  return v4()
}

export function isValidUuid(id: string) {
  return validate(id)
}
