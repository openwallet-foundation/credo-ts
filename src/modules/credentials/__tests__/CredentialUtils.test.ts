import { CredentialUtils } from '../CredentialUtils'
import { CredentialPreview, CredentialPreviewAttribute } from '../messages/CredentialPreview'

/**
 * Sample test cases for encoding/decoding of verifiable credential claims - Aries RFCs 0036 and 0037
 * @see https://gist.github.com/swcurran/78e5a9e8d11236f003f6a6263c6619a6
 */
const testEncodings: { [key: string]: { raw: any; encoded: string } } = {
  address2: {
    raw: '101 Wilson Lane',
    encoded: '68086943237164982734333428280784300550565381723532936263016368251445461241953',
  },
  zip: {
    raw: '87121',
    encoded: '87121',
  },
  city: {
    raw: 'SLC',
    encoded: '101327353979588246869873249766058188995681113722618593621043638294296500696424',
  },
  address1: {
    raw: '101 Tela Lane',
    encoded: '63690509275174663089934667471948380740244018358024875547775652380902762701972',
  },
  state: {
    raw: 'UT',
    encoded: '93856629670657830351991220989031130499313559332549427637940645777813964461231',
  },
  Empty: {
    raw: '',
    encoded: '102987336249554097029535212322581322789799900648198034993379397001115665086549',
  },
  Null: {
    raw: null,
    encoded: '99769404535520360775991420569103450442789945655240760487761322098828903685777',
  },
  'bool True': {
    raw: true,
    encoded: '1',
  },
  'bool False': {
    raw: false,
    encoded: '0',
  },
  'str True': {
    raw: 'True',
    encoded: '27471875274925838976481193902417661171675582237244292940724984695988062543640',
  },
  'str False': {
    raw: 'False',
    encoded: '43710460381310391454089928988014746602980337898724813422905404670995938820350',
  },
  'max i32': {
    raw: 2147483647,
    encoded: '2147483647',
  },
  'max i32 + 1': {
    raw: 2147483648,
    encoded: '26221484005389514539852548961319751347124425277437769688639924217837557266135',
  },
  'min i32': {
    raw: -2147483648,
    encoded: '-2147483648',
  },
  'min i32 - 1': {
    raw: -2147483649,
    encoded: '68956915425095939579909400566452872085353864667122112803508671228696852865689',
  },
  'float 0.1': {
    raw: 0.1,
    encoded: '9382477430624249591204401974786823110077201914483282671737639310288175260432',
  },
  'str 0.1': {
    raw: '0.1',
    encoded: '9382477430624249591204401974786823110077201914483282671737639310288175260432',
  },
  'chr 0': {
    raw: String.fromCharCode(0),
    encoded: '49846369543417741186729467304575255505141344055555831574636310663216789168157',
  },
  'chr 1': {
    raw: String.fromCharCode(1),
    encoded: '34356466678672179216206944866734405838331831190171667647615530531663699592602',
  },
  'chr 2': {
    raw: String.fromCharCode(2),
    encoded: '99398763056634537812744552006896172984671876672520535998211840060697129507206',
  },
}

describe('CredentialUtils', () => {
  describe('convertPreviewToValues', () => {
    test('returns object with raw and encoded attributes', () => {
      const credentialPreview = new CredentialPreview({
        attributes: [
          new CredentialPreviewAttribute({
            name: 'name',
            mimeType: 'text/plain',
            value: '101 Wilson Lane',
          }),
          new CredentialPreviewAttribute({
            name: 'age',
            mimeType: 'text/plain',
            value: '1234',
          }),
        ],
      })

      expect(CredentialUtils.convertPreviewToValues(credentialPreview)).toEqual({
        name: {
          raw: '101 Wilson Lane',
          encoded: '68086943237164982734333428280784300550565381723532936263016368251445461241953',
        },
        age: { raw: '1234', encoded: '1234' },
      })
    })
  })

  describe('checkValidEncoding', () => {
    // Formatted for test.each
    const testEntries = Object.entries(testEncodings).map(([name, { raw, encoded }]) => [name, raw, encoded])

    test.each(testEntries)('returns true for valid encoding %s', (_, raw, encoded) => {
      expect(CredentialUtils.checkValidEncoding(raw, encoded)).toEqual(true)
    })
  })
})
