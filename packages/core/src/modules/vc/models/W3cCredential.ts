import type { JsonObject } from '../../../types'

import { AriesFrameworkError } from '../../../error'
import { isJsonObject } from '../../../utils/type'
import { CREDENTIALS_CONTEXT_V1_URL, VERIFIABLE_CREDENTIAL_TYPE } from '../constants'
import { UriValidator } from '../validators'

export interface W3cCredentialOptions {
  context?: Array<string | JsonObject>
  id?: string
  type?: Array<string>
  issuer?: string | JsonObject
  issuanceDate?: string
  expirationDate?: string
  credentialSubject?: JsonObject | Array<JsonObject>
}

export class W3cCredential {
  private _context: Array<string | JsonObject>
  private _id?: string // VERIFY: acapy code says this can be optional, specs say it's required
  private _type: Array<string>
  private _issuer: string | JsonObject | null
  private _issuanceDate: string | null
  private _expirationDate: string | null
  private _credentialSubject: JsonObject | Array<JsonObject> | null

  public constructor(options: W3cCredentialOptions) {
    this._context = options.context ?? [CREDENTIALS_CONTEXT_V1_URL]
    this._id = options.id
    this._type = options.type ?? [VERIFIABLE_CREDENTIAL_TYPE]
    this._issuer = options.issuer ?? null
    this._issuanceDate = options.issuanceDate ?? null
    this._expirationDate = options.expirationDate ?? null
    this._credentialSubject = options.credentialSubject ?? null
  }

  public get context(): Array<string | JsonObject> {
    return this._context
  }

  public set context(context: Array<string | JsonObject>) {
    if (context[0] !== CREDENTIALS_CONTEXT_V1_URL) {
      throw new Error('First entry of context must be the credentials V1 context')
    }
    this._context = context
  }

  public addContext(context: string | JsonObject): void {
    this._context.push(context)
  }

  public get id(): string | undefined {
    return this._id
  }

  public set id(id: string | undefined) {
    if (id && !UriValidator.test(id)) {
      throw new AriesFrameworkError('id must be a valid URI')
    }
    this._id = id
  }

  public get type(): Array<string> {
    return this._type
  }

  public set type(type: Array<string>) {
    if (!type.includes(VERIFIABLE_CREDENTIAL_TYPE)) {
      throw new AriesFrameworkError('Type must include the verifiable credential type')
    }
    this._type = type
  }

  public addType(type: string): void {
    this._type.push(type)
  }

  public get issuer_id(): string | null {
    if (!this._issuer) {
      return null
    }
    if (typeof this._issuer === 'string') {
      return this._issuer
    }
    if (this._issuer.id && typeof this._issuer.id === 'string') {
      return this._issuer.id
    }
    throw new AriesFrameworkError('Issuer must either be a string or have an id property')
  }

  public set issuer_id(issuer_id: string | null) {
    if (issuer_id && !UriValidator.test(issuer_id)) {
      throw new AriesFrameworkError('issuer_id must be a valid URI')
    }

    if (!this._issuer || typeof this._issuer === 'string') {
      this._issuer = issuer_id
      return
    }

    this._issuer.id = issuer_id
  }

  public get issuer(): string | JsonObject | null {
    return this._issuer
  }

  public set issuer(issuer: string | JsonObject | null) {
    if (!issuer) {
      throw new AriesFrameworkError('Issuer must be a string or an object')
    }

    const issuer_id = typeof issuer === 'string' ? issuer : issuer.id

    if (!(typeof issuer_id === 'string')) {
      throw new AriesFrameworkError('issuer.id must be a string')
    }
    if (issuer_id && typeof issuer_id === 'string' && !UriValidator.test(issuer_id)) {
      throw new AriesFrameworkError('issuer_id must be a valid URI')
    }

    this._issuer = issuer_id
  }

  public get issuanceDate(): string | null {
    return this._issuanceDate
  }

  public set issuanceDate(issuanceDate: string | null | Date) {
    this._issuanceDate = this.parseDate(issuanceDate)
  }

  public get expirationDate(): string | null {
    return this._expirationDate
  }

  public set expirationDate(expirationDate: string | null | Date) {
    this._expirationDate = this.parseDate(expirationDate)
  }

  public get credentialSubjectIds(): Array<string> {
    if (!this._credentialSubject) {
      return []
    }
    if (typeof this._credentialSubject === 'string') {
      return [this._credentialSubject]
    }

    if (Array.isArray(this._credentialSubject)) {
      const subjects = this._credentialSubject.map((subject) => subject.id)
      if (!subjects.every((subject) => typeof subject === 'string')) {
        throw new AriesFrameworkError('All credential subjects must have an id property')
      }
      return subjects as string[]
    }

    if (this._credentialSubject.id && typeof this._credentialSubject.id === 'string') {
      return [this._credentialSubject.id]
    }

    throw new AriesFrameworkError('Credential subject must either be a string, array or have an id property')
  }

  public get credentialSubject(): JsonObject | Array<JsonObject> | null {
    return this._credentialSubject
  }

  public set credentialSubject(credentialSubject: JsonObject | Array<JsonObject> | null) {
    if (!credentialSubject) {
      throw new AriesFrameworkError('Credential subject must be an object or an array')
    }

    const subjects = []

    if (isJsonObject(credentialSubject)) {
      subjects.push({ id: credentialSubject })
    } else if (Array.isArray(credentialSubject)) {
      subjects.push(...credentialSubject)
    }

    for (const subject of subjects) {
      if (!subject.id || typeof subject.id !== 'string') {
        throw new AriesFrameworkError('All credential subjects must have an id property')
      }
      if (!UriValidator.test(subject.id)) {
        throw new AriesFrameworkError('All credential subjects ids must be valid URIs')
      }
    }
    this._credentialSubject = credentialSubject
  }

  private parseDate(date: string | null | Date): string {
    if (typeof date === 'string') {
      return date
    }
    if (date instanceof Date) {
      return new Date(
        Date.UTC(
          date.getUTCFullYear(),
          date.getUTCMonth(),
          date.getUTCDate(),
          date.getUTCHours(),
          date.getUTCMinutes(),
          date.getUTCSeconds(),
          date.getUTCMilliseconds()
        )
      ).toISOString()
    }
    throw new AriesFrameworkError('date must be a string or a Date')
  }
}
