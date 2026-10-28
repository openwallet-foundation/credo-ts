import { convertName } from '../utils/nameConversion'
import { X509Error } from '../X509Error'

describe('convertName', () => {
  it('returns a string name unchanged', () => {
    expect(convertName('CN=credo, O=Example Org')).toStrictEqual('CN=credo, O=Example Org')
  })

  it('converts all attributes in a fixed order', () => {
    expect(
      convertName({
        stateOrProvinceName: 'Utrecht',
        organizationalUnit: 'Engineering',
        organizationIdentifier: 'NTRNL-12345678',
        organizationName: 'Example Org',
        countryName: 'NL',
        commonName: 'credo',
      })
    ).toStrictEqual('CN=credo, C=NL, O=Example Org, 2.5.4.97=NTRNL-12345678, OU=Engineering, ST=Utrecht')
  })

  it('escapes special characters in values', () => {
    expect(convertName({ commonName: 'a,b+c"d\\e<f>g;h=i' })).toStrictEqual('CN=a\\,b\\+c\\"d\\\\e\\<f\\>g\\;h\\=i')
    expect(convertName({ commonName: '#credo' })).toStrictEqual('CN=\\#credo')
    expect(convertName({ commonName: ' credo ' })).toStrictEqual('CN=\\ credo\\ ')
  })

  it('throws when a value ends with a backslash', () => {
    expect(() => convertName({ commonName: 'credo\\' })).toThrow(X509Error)
  })

  it('throws when no attributes are provided', () => {
    expect(() => convertName({})).toThrow(X509Error)
  })
})
