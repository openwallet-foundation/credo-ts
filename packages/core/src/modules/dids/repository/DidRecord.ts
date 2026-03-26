import { Type } from 'class-transformer'
import { IsEnum, ValidateNested } from 'class-validator'
import type { TagsBase } from '../../../storage/BaseRecord'
import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'
import { Ed25519PublicJwk, type PublicJwk, X25519PublicJwk } from '../../kms'
import type { DidDocumentKey } from '../DidsApiOptions'
import { DidDocument } from '../domain'
import { DidDocumentRole } from '../domain/DidDocumentRole'
import { parseDid } from '../domain/parse'
import type { DidRecordMetadata } from './didRecordMetadataTypes'
import { DidRecordMetadataKeys } from './didRecordMetadataTypes'

export interface DidRecordProps {
  id?: string
  did: string
  role: DidDocumentRole
  didDocument?: DidDocument
  createdAt?: Date
  tags?: CustomDidTags

  /**
   * The kms key ids associated with the did record. Should only be used
   * when role is {@link DidDocumentRole.Created}
   */
  keys?: DidDocumentKey[]
}

export interface CustomDidTags extends TagsBase {
  recipientKeyFingerprints?: string[]

  // Alternative forms of the did, allowed to be queried by them.
  // Relationship must be verified both ways before setting this tag.
  alternativeDids?: string[]
}

type DefaultDidTags = {
  // We set the recipientKeyFingeprints as a default tag, if the did record has a did document
  // If the did record does not have a did document, we can't calculate it, and it needs to be
  // handled by the creator of the did record
  recipientKeyFingerprints?: string[]

  role: DidDocumentRole
  method: string
  legacyUnqualifiedDid?: string
  methodSpecificIdentifier: string
  did: string
}

export class DidRecord extends BaseRecord<DefaultDidTags, CustomDidTags, DidRecordMetadata> implements DidRecordProps {
  @Type(() => DidDocument)
  @ValidateNested()
  public didDocument?: DidDocument

  public did!: string

  @IsEnum(DidDocumentRole)
  public role!: DidDocumentRole

  public static readonly type = 'DidRecord'
  public readonly type = DidRecord.type

  /**
   * The kms key ids associated with the DidRecord. Should only be used
   * when role is {@link DidDocumentRole.Created}.
   */
  keys?: DidDocumentKey[]

  public constructor(props: DidRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.did = props.did
      this.role = props.role
      this.didDocument = props.didDocument
      this.createdAt = props.createdAt ?? new Date()
      this._tags = props.tags ?? {}
      this.keys = props.keys
    }
  }

  public getTags() {
    const did = parseDid(this.did)

    const legacyDid = this.metadata.get(DidRecordMetadataKeys.LegacyDid)

    return {
      ...this._tags,
      role: this.role,
      method: did.method,
      legacyUnqualifiedDid: legacyDid?.unqualifiedDid,
      did: this.did,
      methodSpecificIdentifier: did.id,

      // Calculate if we have a did document, otherwise use the already present recipient keys.
      // DIDComm v2 uses keyAgreement verification relationships and ECDH-1PU requires X25519.
      // Even if a peer references a verification method backed by an Ed25519 key, we index the
      // corresponding X25519 fingerprint so lookup works consistently.
      recipientKeyFingerprints: this.didDocument
        ? (() => {
            const prints = new Set<string>()
            const doc = this.didDocument!
            for (const recipientKey of doc.recipientKeys) {
              const x25519 = recipientKey.is(Ed25519PublicJwk)
                ? (recipientKey as PublicJwk<Ed25519PublicJwk>).convertTo(X25519PublicJwk)
                : (recipientKey as PublicJwk<X25519PublicJwk>)

              prints.add(x25519.fingerprint)
            }
            return [...prints]
          })()
        : this._tags.recipientKeyFingerprints,
    }
  }
}
