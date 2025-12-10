import { CredoError } from '../../../error'
import { dateToSeconds } from '../../../utils'

/**
 * The maximum allowed clock skew time in seconds. If an time based validation
 * is performed against current time (`now`), the validation can be of by the skew
 * time.
 *
 * See https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.5
 */
export const DEFAULT_SKEW_TIME = 60

export interface JwtPayloadJson {
  iss?: string
  sub?: string
  aud?: string | string[]
  exp?: number
  nbf?: number
  iat?: number
  jti?: string
  [key: string]: unknown
}

export interface JwtPayloadOptions {
  iss?: string
  sub?: string
  aud?: string | string[]
  exp?: number
  nbf?: number
  iat?: number
  jti?: string
  additionalClaims?: Record<string, unknown>
}

export class JwtPayload {
  public constructor(options?: JwtPayloadOptions) {
    this.iss = options?.iss
    this.sub = options?.sub
    this.aud = options?.aud
    this.exp = options?.exp
    this.nbf = options?.nbf
    this.iat = options?.iat
    this.jti = options?.jti
    this.additionalClaims = options?.additionalClaims ?? {}
  }

  /**
   * identifies the principal that issued the JWT.
   * The processing of this claim is generally application specific.
   * The "iss" value is a case-sensitive string containing a StringOrURI
   * value.
   */
  public iss?: string

  /**
   * identifies the principal that is the
   * subject of the JWT.  The Claims in a JWT are normally statements
   * about the subject.  The subject value MUST either be scoped to be
   * locally unique in the context of the issuer or be globally unique.
   * The processing of this claim is generally application specific.  The
   * "sub" value is a case-sensitive string containing a StringOrURI
   * value.
   */
  public sub?: string

  /**
   * identifies the recipients that the JWT is
   * intended for. Each principal intended to process the JWT MUST
   * identify itself with a value in the audience claim. If the principal
   * processing the claim does not identify itself with a value in the
   * "aud" claim when this claim is present, then the JWT MUST be
   * rejected.In the general case, the "aud" value is an array of case-
   * sensitive strings, each containing a StringOrURI value.  In the
   * special case when the JWT has one audience, the "aud" value MAY be a
   * single case-sensitive string containing a StringOrURI value.  The
   * interpretation of audience values is generally application specific.
   */
  public aud?: string | string[]

  /**
   * identifies the expiration time on
   * or after which the JWT MUST NOT be accepted for processing.  The
   * processing of the "exp" claim requires that the current date/time
   * MUST be before the expiration date/time listed in the "exp" claim.
   * Implementers MAY provide for some small leeway, usually no more than
   * a few minutes, to account for clock skew.  Its value MUST be a number
   * containing a NumericDate value.
   */
  public exp?: number

  /**
   * identifies the time at which the JWT was
   * issued. This claim can be used to determine the age of the JWT.  Its
   * value MUST be a number containing a NumericDate value.
   */
  public nbf?: number

  /**
   * identifies the time at which the JWT was
   * issued. This claim can be used to determine the age of the JWT. Its
   * value MUST be a number containing a NumericDate value.
   */
  public iat?: number

  /**
   * provides a unique identifier for the JWT.
   * The identifier value MUST be assigned in a manner that ensures that
   * there is a negligible probability that the same value will be
   * accidentally assigned to a different data object; if the application
   * uses multiple issuers, collisions MUST be prevented among values
   * produced by different issuers as well. The "jti" claim can be used
   * to prevent the JWT from being replayed. The "jti" value is a case-
   * sensitive string.
   */
  public jti?: string

  public additionalClaims: Record<string, unknown>

  /**
   * Validate the JWT payload. This does not verify the signature of the JWT itself.
   *
   * The following validations are performed:
   *  - if `nbf` is present, it must be greater than now
   *  - if `iat` is present, it must be less than now
   *  - if `exp` is present, it must be greater than now
   */
  public validate(options?: {
    /**
     * @deprecated use `skewSeconds` instead
     */
    skewTime?: number
    skewSeconds?: number
    now?: number
  }) {
    const { nowSkewedFuture, nowSkewedPast } = getNowSkewed(options?.now, options?.skewSeconds ?? options?.skewTime)

    // Validate nbf
    if (typeof this.nbf !== 'number' && typeof this.nbf !== 'undefined') {
      throw new CredoError(`JWT payload 'nbf' must be a number if provided. Actual type is ${typeof this.nbf}`)
    }
    if (typeof this.nbf === 'number' && this.nbf > nowSkewedFuture) {
      throw new CredoError(`JWT not valid before ${this.nbf}`)
    }

    // Validate iat
    if (typeof this.iat !== 'number' && typeof this.iat !== 'undefined') {
      throw new CredoError(`JWT payload 'iat' must be a number if provided. Actual type is ${typeof this.iat}`)
    }
    if (typeof this.iat === 'number' && this.iat > nowSkewedFuture) {
      throw new CredoError(`JWT issued in the future at ${this.iat}`)
    }

    // Validate exp
    if (typeof this.exp !== 'number' && typeof this.exp !== 'undefined') {
      throw new CredoError(`JWT payload 'exp' must be a number if provided. Actual type is ${typeof this.exp}`)
    }
    if (typeof this.exp === 'number' && this.exp < nowSkewedPast) {
      throw new CredoError(`JWT expired at ${this.exp}`)
    }

    // NOTE: nonce and aud are not validated in here. We could maybe add
    // the values as input, so you can provide the expected nonce and aud values
  }

  public toJson(): JwtPayloadJson {
    return {
      ...this.additionalClaims,
      iss: this.iss,
      sub: this.sub,
      aud: this.aud,
      exp: this.exp,
      nbf: this.nbf,
      iat: this.iat,
      jti: this.jti,
    }
  }

  public static fromJson(jwtPayloadJson: JwtPayloadJson) {
    const { iss, sub, aud, exp, nbf, iat, jti, ...additionalClaims } = jwtPayloadJson

    // Validate iss
    if (iss && typeof iss !== 'string') {
      throw new CredoError('JWT payload iss must be a string')
    }

    // Validate sub
    if (sub && typeof sub !== 'string') {
      throw new CredoError('JWT payload sub must be a string')
    }

    // Validate aud
    if (aud && typeof aud !== 'string' && !(Array.isArray(aud) && aud.every((aud) => typeof aud === 'string'))) {
      throw new CredoError('JWT payload aud must be a string or an array of strings')
    }

    // Validate exp
    if (exp && (typeof exp !== 'number' || exp < 0)) {
      throw new CredoError('JWT payload exp must be a positive number')
    }

    // Validate nbf
    if (nbf && (typeof nbf !== 'number' || nbf < 0)) {
      throw new CredoError('JWT payload nbf must be a positive number')
    }

    // Validate iat
    if (iat && (typeof iat !== 'number' || iat < 0)) {
      throw new CredoError('JWT payload iat must be a positive number')
    }

    // Validate jti
    if (jti && typeof jti !== 'string') {
      throw new CredoError('JWT payload jti must be a string')
    }

    const jwtPayload = new JwtPayload({
      iss,
      sub,
      aud,
      exp,
      nbf,
      iat,
      jti,
      additionalClaims,
    })

    return jwtPayload
  }
}

function getNowSkewed(now?: number, skewSeconds?: number) {
  const _now = now ?? dateToSeconds(new Date())
  const _skewSeconds = skewSeconds ?? DEFAULT_SKEW_TIME

  return {
    nowSkewedPast: _now - _skewSeconds,
    nowSkewedFuture: _now + _skewSeconds,
  }
}
