import { JwtPayload } from '../JwtPayload'

describe('JwtPayload', () => {
  test('create JwtPayload from json', () => {
    const jwtPayload = JwtPayload.fromJson({
      iss: 'issuer',
      sub: 'subject',
      aud: 'audience',
      exp: 123,
      nbf: 123,
      iat: 123,
      jti: 'jwtid',

      someAdditional: 'claim',
      and: {
        another: 'claim',
      },
    })

    expect(jwtPayload.iss).toBe('issuer')
    expect(jwtPayload.sub).toBe('subject')
    expect(jwtPayload.aud).toBe('audience')
    expect(jwtPayload.exp).toBe(123)
    expect(jwtPayload.nbf).toBe(123)
    expect(jwtPayload.iat).toBe(123)
    expect(jwtPayload.jti).toBe('jwtid')
    expect(jwtPayload.additionalClaims).toEqual({
      someAdditional: 'claim',
      and: {
        another: 'claim',
      },
    })
  })

  test('validate jwt payload', () => {
    const jwtPayload = JwtPayload.fromJson({})

    jwtPayload.exp = 123
    expect(() => jwtPayload.validate({ now: 200, skewTime: 1 })).toThrow('JWT expired at 123')
    expect(() => jwtPayload.validate({ now: 100, skewTime: 1 })).not.toThrow()

    jwtPayload.nbf = 80
    expect(() => jwtPayload.validate({ now: 75, skewTime: 1 })).toThrow('JWT not valid before 80')
    expect(() => jwtPayload.validate({ now: 100, skewTime: 1 })).not.toThrow()

    jwtPayload.iat = 90
    expect(() => jwtPayload.validate({ now: 85, skewTime: 1 })).toThrow('JWT issued in the future at 90')
    expect(() => jwtPayload.validate({ now: 100, skewTime: 1 })).not.toThrow()
  })

  test('throws error for invalid values', () => {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    expect(() => JwtPayload.fromJson({ iss: {} } as any)).toThrow('JWT payload iss must be a string')
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    expect(() => JwtPayload.fromJson({ sub: {} } as any)).toThrow('JWT payload sub must be a string')
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    expect(() => JwtPayload.fromJson({ aud: {} } as any)).toThrow(
      'JWT payload aud must be a string or an array of strings'
    )
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    expect(() => JwtPayload.fromJson({ aud: [1, 'string'] } as any)).toThrow(
      'JWT payload aud must be a string or an array of strings'
    )
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    expect(() => JwtPayload.fromJson({ exp: '10' } as any)).toThrow('JWT payload exp must be a positive number')
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    expect(() => JwtPayload.fromJson({ exp: -1 } as any)).toThrow('JWT payload exp must be a positive number')
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    expect(() => JwtPayload.fromJson({ nbf: '10' } as any)).toThrow('JWT payload nbf must be a positive number')
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    expect(() => JwtPayload.fromJson({ nbf: -1 } as any)).toThrow('JWT payload nbf must be a positive number')
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    expect(() => JwtPayload.fromJson({ iat: '10' } as any)).toThrow('JWT payload iat must be a positive number')
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    expect(() => JwtPayload.fromJson({ iat: -1 } as any)).toThrow('JWT payload iat must be a positive number')
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    expect(() => JwtPayload.fromJson({ jti: {} } as any)).toThrow('JWT payload jti must be a string')
  })

  test('correctly outputs json', () => {
    const jwtPayload = new JwtPayload({
      iss: 'issuer',
      sub: 'subject',
      aud: 'audience',
      exp: 123,
      nbf: 123,
      iat: 123,
      jti: 'jwtid',

      additionalClaims: {
        someAdditional: 'claim',
        and: {
          another: 'claim',
        },
      },
    })

    expect(jwtPayload.toJson()).toEqual({
      iss: 'issuer',
      sub: 'subject',
      aud: 'audience',
      exp: 123,
      nbf: 123,
      iat: 123,
      jti: 'jwtid',

      someAdditional: 'claim',
      and: {
        another: 'claim',
      },
    })
  })
})
