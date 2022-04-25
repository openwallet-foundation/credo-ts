/*
 * Copyright 2020 - MATTR Limited
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { PublicJsonWebKey } from "./JsonWebKey";

/**
 * Interface for the public key definition entry in a DID Document.
 * @see https://w3c-ccg.github.io/did-spec/#public-keys
 */
export interface DidDocumentPublicKey {
  /**
   * Fully qualified identifier of this public key, e.g. did:example:entity.id#keys-1
   */
  readonly id: string;

  /**
   * The type of this public key, as defined in: https://w3c-ccg.github.io/ld-cryptosuite-registry/
   */
  readonly type: string;

  /**
   * The DID of the controller of this key.
   */
  readonly controller?: string;

  /**
   * The value of the public key in Base58 format. Only one value field will be present.
   */
  readonly publicKeyBase58?: string;

  /**
   * Public key in JWK format.
   * @see https://w3c-ccg.github.io/did-spec/#public-keys
   */
  readonly publicKeyJwk?: PublicJsonWebKey;

  /**
   * Public key in HEX format.
   * @see https://w3c-ccg.github.io/did-spec/#public-keys
   */
  readonly publicKeyHex?: string;
}
