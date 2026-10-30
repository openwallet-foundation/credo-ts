import path from 'node:path'
import { testRecordEncoding } from '../../../../core/tests/recordEncoding'
import { anoncredsDefinitionFourAttributesNoRevocation } from '../../../tests/preCreatedAnonCredsDefinition'
import { AnonCredsCredentialDefinitionPrivateRecord } from '../AnonCredsCredentialDefinitionPrivateRecord'
import { AnonCredsCredentialDefinitionRecord } from '../AnonCredsCredentialDefinitionRecord'
import { AnonCredsCredentialRecord } from '../AnonCredsCredentialRecord'
import { AnonCredsKeyCorrectnessProofRecord } from '../AnonCredsKeyCorrectnessProofRecord'
import { AnonCredsLinkSecretRecord } from '../AnonCredsLinkSecretRecord'
import {
  AnonCredsRevocationRegistryDefinitionPrivateRecord,
  AnonCredsRevocationRegistryState,
} from '../AnonCredsRevocationRegistryDefinitionPrivateRecord'
import { AnonCredsRevocationRegistryDefinitionRecord } from '../AnonCredsRevocationRegistryDefinitionRecord'
import { AnonCredsSchemaRecord } from '../AnonCredsSchemaRecord'
import { AnonCredsCredentialDefinitionRecordMetadataKeys } from '../anonCredsCredentialDefinitionRecordMetadataTypes'
import { AnonCredsRevocationRegistryDefinitionRecordMetadataKeys } from '../anonCredsRevocationRegistryDefinitionRecordMetadataTypes'
import { AnonCredsSchemaRecordMetadataKeys } from '../anonCredsSchemaRecordMetadataTypes'

const createdAt = new Date('2026-01-01T00:00:00.000Z')
const updatedAt = new Date('2026-01-02T00:00:00.000Z')

const issuerId = 'did:indy:bcovrin:test:6LHqdUeWDWsL94zRc1ULEx'
const schemaId = `${issuerId}/anoncreds/v0/SCHEMA/Employee Credential/1.0`
const credentialDefinitionId = `${issuerId}/anoncreds/v0/CLAIM_DEF/400832/default`
const revocationRegistryDefinitionId = `${issuerId}/anoncreds/v0/REV_REG_DEF/400832/default/revocation`

const { credentialDefinitionPrivate, keyCorrectnessProof } = anoncredsDefinitionFourAttributesNoRevocation

testRecordEncoding(path.join(__dirname, '__fixtures__/records'), {
  AnonCredsCredentialDefinitionPrivateRecord: () => {
    const record = new AnonCredsCredentialDefinitionPrivateRecord({
      id: 'anoncreds-credential-definition-private-record-id',
      createdAt,
      credentialDefinitionId,
      value: credentialDefinitionPrivate,
    })
    record.updatedAt = updatedAt
    record.setTag('custom', 'tag')
    record.metadata.set('meta', { key: 'value' })
    return record
  },
  AnonCredsCredentialDefinitionRecord: () => {
    const record = new AnonCredsCredentialDefinitionRecord({
      id: 'anoncreds-credential-definition-record-id',
      createdAt,
      credentialDefinitionId,
      credentialDefinition: {
        ...anoncredsDefinitionFourAttributesNoRevocation.credentialDefinition,
        issuerId,
        schemaId,
        tag: 'default',
        value: {
          ...anoncredsDefinitionFourAttributesNoRevocation.credentialDefinition.value,
          revocation: {
            g: '1 1F14F2E8E5E76D5E5F6A1E1D48D4C1A1F27A0E3A3EB5B57B0F0B6D1F4F5C3A8D 1 0F2E5A2C3B6F9C8E5E1A7F3E9B2D4C6A8F0E1D3B5A7C9E1F3A5B7D9E1F3A5B7 2',
            g_dash:
              '1 0C1D2E3F4A5B6C7D8E9F0A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C 1 1A2B3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A0B1C2D3E4F5A6B7C8D9E0F1A',
            h: '1 13F1A1D3C2B4E6F8A0B2C4D6E8F0A2B4C6D8E0F2A4B6C8D0E2F4A6B8C0D2E4 1 0B1D3F5A7C9E1B3D5F7A9C1E3B5D7F9A1C3E5B7D9F1A3C5E7B9D1F3A5C7E9B1 2',
            h0: '1 0A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F0A 1 1F0E9D8C7B6A5F4E3D2C1B0A9F8E7D6C5B4A3F2E1D0C9B8A7F6E5D4C3B2A1F0 2',
            h1: '1 1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F0A1B 1 0E9D8C7B6A5F4E3D2C1B0A9F8E7D6C5B4A3F2E1D0C9B8A7F6E5D4C3B2A1F0E 2',
            h2: '1 0C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F0A1B2C 1 1D8C7B6A5F4E3D2C1B0A9F8E7D6C5B4A3F2E1D0C9B8A7F6E5D4C3B2A1F0E9D 2',
            htilde:
              '1 1D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F0A1B2C3D 1 0C7B6A5F4E3D2C1B0A9F8E7D6C5B4A3F2E1D0C9B8A7F6E5D4C3B2A1F0E9D8C 2',
            h_cap:
              '1 0E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F0A1B2C3D4E 1 1B6A5F4E3D2C1B0A9F8E7D6C5B4A3F2E1D0C9B8A7F6E5D4C3B2A1F0E9D8C7B',
            u: '1 1F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F0A1B2C3D4E5F 1 0A5F4E3D2C1B0A9F8E7D6C5B4A3F2E1D0C9B8A7F6E5D4C3B2A1F0E9D8C7B6A',
            pk: '1 0A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F0A1B2C3D4E5F6A 1 1F4E3D2C1B0A9F8E7D6C5B4A3F2E1D0C9B8A7F6E5D4C3B2A1F0E9D8C7B6A5F 2',
            y: '1 1B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F0A1B2C3D4E5F6A7B 1 0E3D2C1B0A9F8E7D6C5B4A3F2E1D0C9B8A7F6E5D4C3B2A1F0E9D8C7B6A5F4E',
          },
        },
      },
      methodName: 'indy',
    })
    record.updatedAt = updatedAt
    record.setTag('custom', 'tag')
    record.metadata.set(AnonCredsCredentialDefinitionRecordMetadataKeys.CredentialDefinitionRegistrationMetadata, {
      didIndyNamespace: 'bcovrin:test',
    })
    record.metadata.set(AnonCredsCredentialDefinitionRecordMetadataKeys.CredentialDefinitionMetadata, {
      seqNo: 400832,
    })
    return record
  },
  AnonCredsCredentialRecord: () => {
    const record = new AnonCredsCredentialRecord({
      id: 'anoncreds-credential-record-id',
      createdAt,
      credentialId: 'c5775c27-93d1-46e0-bb00-65e408a58d97',
      credentialRevocationId: '12',
      linkSecretId: 'ae343b1d-e2af-4706-9aae-2010a7f2c882',
      methodName: 'indy',
      issuerId,
      schemaIssuerId: issuerId,
      schemaName: 'Employee Credential',
      schemaVersion: '1.0',
      credential: {
        schema_id: schemaId,
        cred_def_id: credentialDefinitionId,
        rev_reg_id: revocationRegistryDefinitionId,
        values: {
          name: {
            raw: 'Alice',
            encoded: '27034640024117331033063128044004318218486816931520886405535659934417438781507',
          },
          age: { raw: '25', encoded: '25' },
        },
        signature: {
          p_credential: {
            m_2: '85676623484277624682444820444702467499357910274165013418379125134075325543729',
            a: '29078583023644723417256963951834769429544893561312608041999039725779045478957665610539345669249033643845871310638205359827913345539893604784172221177874151867323789783352069858114677062382329201941336114640094448982492548621745418140287523358455796985452292603814050613022499206350481966450949147798607248367393022400871389441985483251995666110068431356102420069450232712370410071038529237338590022255675451148362600727584994665177285853081799683623674291603640314733666468918666175103622831604402215322289509594157875212406584558973682327127532803373424575230946721521968680075608178586165565162932643378236428403331',
            e: '259344723055062059907025491480697571938277889515152306249728583105665800713306759149981690559193987143012367913206299323899696942213235956742930103927082934306204189453914854568633',
            v: '10113246594919968694243749150533421251903212516176280450944343564431109505938841891625247667364379412129405405348477095610002433568347856509159611335758818756926825063560770314873165029229176344268719893707027252437404047327923906866676449185116008460538437595639211714306227451873006607255100899512311105919649129622793316610076053733506986530767535638972131892478976764607887355989030338392858709274725683511041231799301175492600538984695657494046447608704545830499026706733632944905447307052632450973098625532585070622424882750416943328031030319205075858421333346786928868231555780815068857501287044930625867151895584283719258208379421233099516506594646921971059399550756016776860669930757562757559953692743338803382655236340538001870484617627827300880520094049323022699847759090147376675910494368188266848296015139094',
          },
          r_credential: {
            sigma:
              '1 14C6B4EA30C6A3A2B4D2C6A0E1C0A9B3D5E7F9A1C3E5B7D9F1A3C5E7B9D1F3A5 1 0D8C9F1A3B5D7E9F1A3C5E7B9D1F3A5C7E9B1D3F5A7C9E1B3D5F7A9C1E3B5D7 2',
            c: '7A3B5C1D9E2F4A6B8C0D2E4F6A8B0C2D4E6F8A0B2C4D6E8F0A2B4C6D8E0F2A4',
            vr_prime_prime: '1A2B3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A0B1C2D3E4F5A6B7C8D9E0F1A2',
            witness_signature: {
              sigma_i:
                '1 0A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F0A 1 1F0E9D8C7B6A5F4E3D2C1B0A9F8E7D6C5B4A3F2E1D0C9B8A7F6E5D4C3B2A1F0',
              u_i: '1 1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F0A1B 1 0E9D8C7B6A5F4E3D2C1B0A9F8E7D6C5B4A3F2E1D0C9B8A7F6E5D4C3B2A1F0E',
              g_i: '1 0C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F0A1B2C 1 1D8C7B6A5F4E3D2C1B0A9F8E7D6C5B4A3F2E1D0C9B8A7F6E5D4C3B2A1F0E9D 2',
            },
            g_i: '1 0C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F0A1B2C 1 1D8C7B6A5F4E3D2C1B0A9F8E7D6C5B4A3F2E1D0C9B8A7F6E5D4C3B2A1F0E9D 2',
            i: 12,
            m2: '85676623484277624682444820444702467499357910274165013418379125134075325543729',
          },
        },
        signature_correctness_proof: {
          se: '21478040510275170612337916082115329005924729160138728500731966689768864876350314127582065222070358453091326557476132640512915164393469162400241555486465031352127309617863096642685471579736279753483791845394120052052850579761097059767637641620637246275967251656241939449999728934398401723998520798896177945650388769630721777342623105417576378300802138205906595722648799399722998758345581952810879612170626417882503950639389717949927995386086595370764259106482228888541923217556032007348358437745103150644457074511256162173366561635465131422798361283669038048806849619337895126642478632186566293253597826848134434844979',
          c: '71574462310595963848889785756072396101961922057659218227849729861834355800201',
        },
        rev_reg: {
          accum:
            '21 11E2F5B2D8A3C6E9F1B4D7A0C3E6F9B2D5A8C1E4F7B0D3A6C9E2F5B8D1A4C7E0 21 13B6D9F2A5C8E1B4D7F0A3C6E9B2D5F8A1C4E7B0D3F6A9C2E5B8D1F4A7C0E3B6',
        },
        witness: {
          omega:
            '21 1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F0A1B2C3D4E5F6A7B8C9D0E1F2 21 0E1D2C3B4A5F6E7D8C9B0A1F2E3D4C5B6A7F8E9D0C1B2A3F4E5D6C7B8A9F0E1D',
        },
      },
    })
    record.updatedAt = updatedAt
    record.setTag('custom', 'tag')
    record.metadata.set('meta', { key: 'value' })
    return record
  },
  AnonCredsKeyCorrectnessProofRecord: () => {
    const record = new AnonCredsKeyCorrectnessProofRecord({
      id: 'anoncreds-key-correctness-proof-record-id',
      createdAt,
      credentialDefinitionId,
      value: keyCorrectnessProof,
    })
    record.updatedAt = updatedAt
    record.setTag('custom', 'tag')
    record.metadata.set('meta', { key: 'value' })
    return record
  },
  AnonCredsLinkSecretRecord: () => {
    const record = new AnonCredsLinkSecretRecord({
      id: 'anoncreds-link-secret-record-id',
      linkSecretId: 'ae343b1d-e2af-4706-9aae-2010a7f2c882',
      value: '61519830468598618591226627474346418209069219453066961817624823616866316736018',
    })
    record.createdAt = createdAt
    record.updatedAt = updatedAt
    record.setTag('isDefault', true)
    record.metadata.set('meta', { key: 'value' })
    return record
  },
  AnonCredsRevocationRegistryDefinitionPrivateRecord: () => {
    const record = new AnonCredsRevocationRegistryDefinitionPrivateRecord({
      id: 'anoncreds-revocation-registry-definition-private-record-id',
      revocationRegistryDefinitionId,
      credentialDefinitionId,
      value: {
        value: {
          gamma: '0A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F0A1B',
        },
      },
      state: AnonCredsRevocationRegistryState.Active,
    })
    record.createdAt = createdAt
    record.updatedAt = updatedAt
    record.setTag('custom', 'tag')
    record.metadata.set('meta', { key: 'value' })
    return record
  },
  AnonCredsRevocationRegistryDefinitionRecord: () => {
    const record = new AnonCredsRevocationRegistryDefinitionRecord({
      id: 'anoncreds-revocation-registry-definition-record-id',
      createdAt,
      revocationRegistryDefinitionId,
      revocationRegistryDefinition: {
        issuerId,
        revocDefType: 'CL_ACCUM',
        credDefId: credentialDefinitionId,
        tag: 'revocation',
        value: {
          publicKeys: {
            accumKey: {
              z: '1 0BB3F9A4C1E5D7F9A1B3C5D7E9F1A3B5C7D9E1F3A5B7C9D1E3F5A7B9C1D3E5 1 1A0C2E4F6B8D0A2C4E6F8B0D2A4C6E8F0B2D4A6C8E0F2B4D6A8C0E2F4B6D8A 1 0C3E5F7B9D1A3C5E7F9B1D3A5C7E9F1B3D5A7C9E1F3B5D7A9C1E3F5B7D9A1C 1 1D2F4A6C8E0B2D4F6A8C0E2B4D6F8A0C2E4B6D8F0A2C4E6B8D0F2A4C6E8B0D 2 095E45DDF417D05FB10933FFC63D474548B7FFFF7888802F07FFFFFF7D07A8A8 1 0000000000000000000000000000000000000000000000000000000000000000',
            },
          },
          maxCredNum: 100,
          tailsLocation: 'https://tails.example.com/7Tqg6BwSSWapxgUDm9KKgg',
          tailsHash: '7Tqg6BwSSWapxgUDm9KKgg',
        },
      },
    })
    record.updatedAt = updatedAt
    record.setTag('custom', 'tag')
    record.metadata.set(
      AnonCredsRevocationRegistryDefinitionRecordMetadataKeys.RevocationRegistryDefinitionRegistrationMetadata,
      { didIndyNamespace: 'bcovrin:test' }
    )
    record.metadata.set(AnonCredsRevocationRegistryDefinitionRecordMetadataKeys.RevocationRegistryDefinitionMetadata, {
      issuanceType: 'ISSUANCE_BY_DEFAULT',
    })
    return record
  },
  AnonCredsSchemaRecord: () => {
    const record = new AnonCredsSchemaRecord({
      id: 'anoncreds-schema-record-id',
      createdAt,
      schemaId,
      schema: {
        issuerId,
        name: 'Employee Credential',
        version: '1.0',
        attrNames: ['name', 'age'],
      },
      methodName: 'indy',
    })
    record.updatedAt = updatedAt
    record.setTag('custom', 'tag')
    record.metadata.set(AnonCredsSchemaRecordMetadataKeys.SchemaRegistrationMetadata, {
      didIndyNamespace: 'bcovrin:test',
    })
    record.metadata.set(AnonCredsSchemaRecordMetadataKeys.SchemaMetadata, { seqNo: 400831 })
    return record
  },
})
