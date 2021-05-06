/* eslint-disable no-console */
import indy from 'indy-sdk'
import type { CredDefId } from 'indy-sdk'
import { Subject } from 'rxjs'
import { Agent, ConnectionRecord } from '..'
import {
  ensurePublicDidIsOnLedger,
  makeConnection,
  registerDefinition,
  registerSchema,
  SubjectInboundTransporter,
  SubjectOutboundTransporter,
  waitForCredentialRecord,
  genesisPath,
} from './helpers'
import {
  CredentialRecord,
  CredentialState,
  CredentialPreview,
  CredentialPreviewAttribute,
} from '../modules/credentials'
import { InitConfig } from '../types'
import { JsonTransformer } from '../utils/JsonTransformer'

import testLogger from './logger'

// Adding tests here...