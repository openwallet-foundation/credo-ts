import { JsonTransformer, MessageValidator } from '../../../../../core/src/utils'
import { buildV2PlaintextFromMessage } from '../../../v2/plaintextBuilder'
import { DidCommOutOfBandInvitationV2 } from '../messages/DidCommOutOfBandInvitationV2'

describe('DidCommOutOfBandInvitationV2', () => {
  const FROM = 'did:webvh:Q:host.example'
  const TYPE_URI = 'https://didcomm.org/out-of-band/2.0/invitation'
  const buildBody = () => ({ goal: 'g', goalCode: 'gc', accept: ['didcomm/v2'] })
  const v2Attachment = { id: 'att-1', media_type: 'application/json', data: { json: { foo: 'bar' } } }

  describe('constructor', () => {
    it('sets id (generated), from, and body fields', () => {
      const inv = new DidCommOutOfBandInvitationV2({ from: FROM, body: buildBody() })
      expect(inv.id).toBeDefined()
      expect(inv.from).toBe(FROM)
      expect(inv.goal).toBe('g')
      expect(inv.goalCode).toBe('gc')
      expect(inv.accept).toEqual(['didcomm/v2'])
    })

    it('respects custom id', () => {
      const inv = new DidCommOutOfBandInvitationV2({ id: 'custom-id', from: FROM })
      expect(inv.id).toBe('custom-id')
    })

    it('declares supportedDidCommVersions = ["v2"]', () => {
      const inv = new DidCommOutOfBandInvitationV2({ from: FROM })
      expect(inv.supportedDidCommVersions).toEqual(['v2'])
    })

    it('exposes static type as ParsedMessageType', () => {
      expect(DidCommOutOfBandInvitationV2.type.messageTypeUri).toBe(TYPE_URI)
    })

    it('stores v2 attachments via the base class ~attach mixin', () => {
      const inv = new DidCommOutOfBandInvitationV2({ from: FROM, attachments: [v2Attachment] })
      expect(inv.appendedAttachments).toHaveLength(1)
      expect(inv.appendedAttachments?.[0].id).toBe('att-1')
    })
  })

  describe('attachments getter', () => {
    it('returns v2-shape array reflecting appendedAttachments', () => {
      const inv = new DidCommOutOfBandInvitationV2({ from: FROM, attachments: [v2Attachment] })
      expect(inv.attachments).toHaveLength(1)
      expect(inv.attachments?.[0]).toMatchObject({
        id: 'att-1',
        media_type: 'application/json',
        data: { json: { foo: 'bar' } },
      })
    })

    it('returns undefined when there are no attachments', () => {
      const inv = new DidCommOutOfBandInvitationV2({ from: FROM })
      expect(inv.attachments).toBeUndefined()
    })
  })

  describe('body getter', () => {
    it('returns reconstructed body when any field is set', () => {
      const inv = new DidCommOutOfBandInvitationV2({ from: FROM, body: buildBody() })
      expect(inv.body).toEqual({ goal: 'g', goalCode: 'gc', accept: ['didcomm/v2'] })
    })

    it('returns undefined when no body field is set', () => {
      const inv = new DidCommOutOfBandInvitationV2({ from: FROM })
      expect(inv.body).toBeUndefined()
    })
  })

  describe('toJSON', () => {
    it('returns v2 wire shape (type/id/from, not @type/@id)', () => {
      const inv = new DidCommOutOfBandInvitationV2({ from: FROM, body: buildBody() })
      const json = inv.toJSON() as unknown as Record<string, unknown>

      expect(json.type).toBe(TYPE_URI)
      expect(json.id).toBe(inv.id)
      expect(json.from).toBe(FROM)
      expect(json['@type']).toBeUndefined()
      expect(json['@id']).toBeUndefined()

      const body = json.body as Record<string, unknown>
      expect(body.goal_code).toBe('gc')
      expect(body.goal).toBe('g')
      expect(body.accept).toEqual(['didcomm/v2'])
    })

    it('serializes attachments in v2 wire shape', () => {
      const inv = new DidCommOutOfBandInvitationV2({ from: FROM, attachments: [v2Attachment] })
      const json = inv.toJSON() as unknown as Record<string, unknown>
      const attachments = json.attachments as Array<Record<string, unknown>>
      expect(attachments).toHaveLength(1)
      expect(attachments[0]).toMatchObject({ id: 'att-1', media_type: 'application/json' })
    })

    it('omits attachments when there are none', () => {
      const inv = new DidCommOutOfBandInvitationV2({ from: FROM })
      const json = inv.toJSON() as unknown as Record<string, unknown>
      expect(json.attachments).toBeUndefined()
    })
  })

  describe('toV2Plaintext', () => {
    it('returns v2 plaintext with snake_case goal_code', () => {
      const inv = new DidCommOutOfBandInvitationV2({ from: FROM, body: buildBody() })
      const v2 = inv.toV2Plaintext()
      expect(v2.id).toBe(inv.id)
      expect(v2.type).toBe(TYPE_URI)
      expect(v2.from).toBe(FROM)
      expect(v2.body).toEqual({ goal: 'g', goal_code: 'gc', accept: ['didcomm/v2'] })
    })

    it('includes v2-shape attachments derived from appendedAttachments', () => {
      const inv = new DidCommOutOfBandInvitationV2({ from: FROM, attachments: [v2Attachment] })
      const v2 = inv.toV2Plaintext()
      expect(v2.attachments).toHaveLength(1)
      expect(v2.attachments?.[0].id).toBe('att-1')
      expect(v2.attachments?.[0].media_type).toBe('application/json')
    })
  })

  describe('buildV2PlaintextFromMessage hook', () => {
    it('uses toV2Plaintext (avoids the v1 fallback mapping)', () => {
      const inv = new DidCommOutOfBandInvitationV2({ from: FROM, body: buildBody() })
      const v2 = buildV2PlaintextFromMessage(inv)
      expect(v2.type).toBe(TYPE_URI)
      expect(v2.from).toBe(FROM)
      expect(v2.body).toMatchObject({ goal_code: 'gc' })
    })
  })

  describe('inbound URL/QR path: fromJson', () => {
    it('hydrates a valid instance from v2 wire JSON', () => {
      const json = {
        type: TYPE_URI,
        id: 'inv-url-12345678',
        from: FROM,
        body: { goal: 'g', goal_code: 'gc', accept: ['didcomm/v2'] },
      }
      const inv = DidCommOutOfBandInvitationV2.fromJson(json)
      expect(inv).toBeInstanceOf(DidCommOutOfBandInvitationV2)
      expect(inv.id).toBe('inv-url-12345678')
      expect(inv.from).toBe(FROM)
      expect(inv.goal).toBe('g')
      expect(inv.goalCode).toBe('gc')
      expect(() => MessageValidator.validateSync(inv)).not.toThrow()
    })

    it('preserves v2 attachments through fromJson (PR #2777 contract)', () => {
      const json = {
        type: TYPE_URI,
        id: 'inv-url-attach-1',
        from: FROM,
        attachments: [v2Attachment],
      }
      const inv = DidCommOutOfBandInvitationV2.fromJson(json)
      expect(inv.attachments).toHaveLength(1)
      expect(inv.attachments?.[0]).toMatchObject({ id: 'att-1', media_type: 'application/json' })
    })

    it('throws on wrong type (JsonTransformer.fromJSON validates by default)', () => {
      expect(() =>
        DidCommOutOfBandInvitationV2.fromJson({
          type: 'https://didcomm.org/wrong/1.0/x',
          id: 'inv-bad-type-1',
          from: FROM,
        })
      ).toThrow(/type does not match/)
    })

    it('throws on missing from (JsonTransformer.fromJSON validates by default)', () => {
      expect(() => DidCommOutOfBandInvitationV2.fromJson({ type: TYPE_URI, id: 'inv-no-from-1' })).toThrow(
        /from must be a string/
      )
    })
  })

  describe('inbound v2 envelope path: class-transform from post-normalize JSON', () => {
    it('hydrates a valid instance with all fields populated', () => {
      // Simulates the post-`normalizeV2PlaintextToV1` JSON that the v2 envelope dispatcher feeds
      // to class-transformer when an OOB v2 message arrives in-band.
      const normalized = {
        '@type': TYPE_URI,
        '@id': 'inv-envelope-12345',
        from: FROM,
        goal: 'g',
        goal_code: 'gc',
        accept: ['didcomm/v2'],
      }
      const inv = JsonTransformer.fromJSON(normalized, DidCommOutOfBandInvitationV2)
      expect(inv).toBeInstanceOf(DidCommOutOfBandInvitationV2)
      expect(inv.id).toBe('inv-envelope-12345')
      expect(inv.from).toBe(FROM)
      expect(inv.goal).toBe('g')
      expect(inv.goalCode).toBe('gc')
      expect(inv.accept).toEqual(['didcomm/v2'])
      expect(() => MessageValidator.validateSync(inv)).not.toThrow()
    })

    it('exposes envelope-borne ~attach as v2-shape attachments via the getter', () => {
      // Post-normalize JSON: attachments arrive as v1-shaped `~attach`, base class mixin
      // populates `appendedAttachments`, getter surfaces them in v2 shape.
      const normalized = {
        '@type': TYPE_URI,
        '@id': 'inv-envelope-attach',
        from: FROM,
        '~attach': [{ '@id': 'att-env-1', 'mime-type': 'application/json', data: { json: { hi: 1 } } }],
      }
      const inv = JsonTransformer.fromJSON(normalized, DidCommOutOfBandInvitationV2)
      expect(inv.appendedAttachments).toHaveLength(1)
      expect(inv.attachments).toHaveLength(1)
      expect(inv.attachments?.[0]).toMatchObject({
        id: 'att-env-1',
        media_type: 'application/json',
        data: { json: { hi: 1 } },
      })
    })
  })

  describe('toUrl / fromUrl roundtrip', () => {
    it('encodes the v2 shape under _oob and parses back losslessly', () => {
      const original = new DidCommOutOfBandInvitationV2({ from: FROM, body: buildBody() })
      const url = original.toUrl({ domain: 'https://example.com' })

      expect(url).toMatch(/^https:\/\/example\.com\?_oob=/)

      const parsed = DidCommOutOfBandInvitationV2.fromUrl(url)
      expect(parsed.id).toBe(original.id)
      expect(parsed.from).toBe(original.from)
      expect(parsed.body?.goal).toBe('g')
      expect(parsed.body?.goalCode).toBe('gc')
      expect(parsed.body?.accept).toEqual(['didcomm/v2'])
    })

    it('preserves attachments through toUrl → fromUrl', () => {
      const original = new DidCommOutOfBandInvitationV2({
        from: FROM,
        body: buildBody(),
        attachments: [v2Attachment],
      })
      const parsed = DidCommOutOfBandInvitationV2.fromUrl(original.toUrl({ domain: 'https://example.com' }))
      expect(parsed.attachments).toHaveLength(1)
      expect(parsed.attachments?.[0]).toMatchObject({ id: 'att-1', media_type: 'application/json' })
    })
  })

  describe('validation', () => {
    it('passes MessageValidator on a well-formed instance', () => {
      const inv = new DidCommOutOfBandInvitationV2({ from: FROM, body: buildBody() })
      expect(() => MessageValidator.validateSync(inv)).not.toThrow()
    })
  })
})
