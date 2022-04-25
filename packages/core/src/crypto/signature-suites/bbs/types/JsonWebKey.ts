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

export enum JwkKty {
  OctetKeyPair = "OKP",
  EC = "EC",
  RSA = "RSA"
}

export interface JwkEc {
  readonly kty: JwkKty.EC;
  readonly crv: string;
  readonly d?: string;
  readonly x?: string;
  readonly y?: string;
  readonly kid?: string;
}

export interface JwkOctetKeyPair {
  readonly kty: JwkKty.OctetKeyPair;
  readonly crv: string;
  readonly d?: string;
  readonly x?: string;
  readonly y?: string;
  readonly kid?: string;
}

export interface JwkRsa {
  readonly kty: JwkKty.RSA;
  readonly e: string;
  readonly n: string;
}

export interface JwkRsaPrivate extends JwkRsa {
  readonly d: string;
  readonly p: string;
  readonly q: string;
  readonly dp: string;
  readonly dq: string;
  readonly qi: string;
}
export type JsonWebKey = JwkOctetKeyPair | JwkEc | JwkRsa | JwkRsaPrivate;
export type PublicJsonWebKey = JwkOctetKeyPair | JwkEc | JwkRsa;
