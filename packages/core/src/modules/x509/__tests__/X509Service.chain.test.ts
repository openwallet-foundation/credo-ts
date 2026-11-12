import { NodeInMemoryKeyManagementStorage, NodeKeyManagementService } from '../../../../../node/src'
import { getAgentConfig, getAgentContext } from '../../../../tests'
import { KeyManagementApi, KeyManagementModuleConfig, PublicJwk } from '../../kms'
import { X509Certificate } from '../X509Certificate'
import { X509ModuleConfig } from '../X509ModuleConfig'
import { X509Service } from '../X509Service'
import { X509RevocationCheckMode } from '../X509ValidationOptions'

const agentContext = getAgentContext({ agentConfig: getAgentConfig('X509Service chain') })
const kmsApi = new KeyManagementApi(
  new KeyManagementModuleConfig({
    backends: [new NodeKeyManagementService(new NodeInMemoryKeyManagementStorage())],
  }),
  agentContext
)
agentContext.dependencyManager.registerInstance(KeyManagementApi, kmsApi)
agentContext.dependencyManager.registerInstance(
  X509ModuleConfig,
  new X509ModuleConfig({ revocationCheck: { mode: X509RevocationCheckMode.Disabled } })
)

const day = 24 * 60 * 60 * 1000
const validity = { notBefore: new Date(Date.now() - 30 * day), notAfter: new Date(Date.now() + 30 * day) }

type Issuer = { key: PublicJwk; certificate: X509Certificate }

async function createKey() {
  return PublicJwk.fromPublicJwk((await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk)
}

async function createRoot(commonName: string, certificateValidity = validity): Promise<Issuer> {
  const key = await createKey()
  const certificate = await X509Service.createCertificate(agentContext, {
    authorityKey: key,
    issuer: { commonName },
    validity: certificateValidity,
    extensions: { basicConstraints: { ca: true } },
  })
  return { key, certificate }
}

async function createIntermediate(parent: Issuer, commonName: string, certificateValidity = validity): Promise<Issuer> {
  const key = await createKey()
  const certificate = await X509Service.createCertificate(agentContext, {
    authorityKey: parent.key,
    subjectPublicKey: key,
    issuer: parent.certificate.subject,
    subject: { commonName },
    validity: certificateValidity,
    extensions: { basicConstraints: { ca: true } },
  })
  return { key, certificate }
}

// `signingKey` differs from the key of `parent` for a certificate that only claims to be issued by it
async function createLeaf(parent: Issuer, commonName = 'Leaf', signingKey = parent.key) {
  return await X509Service.createCertificate(agentContext, {
    authorityKey: signingKey,
    subjectPublicKey: await createKey(),
    issuer: parent.certificate.subject,
    subject: { commonName },
    validity,
  })
}

const notIssuedByNext = 'is not issued by the next certificate in the chain'
const noTrustedCertificate = 'No trusted certificate was found'
const unableToVerify = 'Unable to verify the certificate chain'

describe('X509Service chain signatures', () => {
  let root: Issuer
  let intermediate: Issuer
  let signer: Issuer
  let leaf: X509Certificate
  let verifySignature: ReturnType<typeof vi.spyOn>

  const validate = (options: Parameters<typeof X509Service.validateCertificateChain>[1]) =>
    X509Service.validateCertificateChain(agentContext, options)

  beforeAll(async () => {
    // root -> intermediate -> signer -> leaf
    root = await createRoot('Root')
    intermediate = await createIntermediate(root, 'Intermediate')
    signer = await createIntermediate(intermediate, 'Signer')
    leaf = await createLeaf(signer)
  })

  beforeEach(() => {
    verifySignature = vi.spyOn(X509Certificate.prototype, 'verifySignature')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('trusting a self-signed root', () => {
    it('accepts a chain up to a trusted self-signed root, and verifies each signature once', async () => {
      const chain = await validate({
        certificateChain: [leaf, signer.certificate, intermediate.certificate, root.certificate],
        trustedCertificates: [root.certificate],
      })

      expect(chain).toEqual([root.certificate, intermediate.certificate, signer.certificate, leaf])
      // Three links and the self-signed root
      expect(verifySignature).toHaveBeenCalledTimes(4)
    })

    it('accepts a trusted self-signed certificate on its own', async () => {
      await expect(
        validate({ certificateChain: [root.certificate], trustedCertificates: [root.certificate] })
      ).resolves.toEqual([root.certificate])
    })

    it('rejects an empty chain', async () => {
      await expect(validate({ certificateChain: [], trustedCertificates: [root.certificate] })).rejects.toThrow(
        'Certificate chain is empty'
      )
    })

    it('rejects a self-signed root that is not trusted', async () => {
      const certificateChain = [leaf, signer.certificate, intermediate.certificate, root.certificate]

      await expect(validate({ certificateChain, trustedCertificates: [] })).rejects.toThrow(noTrustedCertificate)
      await expect(validate({ certificateChain: [root.certificate], trustedCertificates: [] })).rejects.toThrow(
        noTrustedCertificate
      )
      // @ts-expect-error trustedCertificates is required
      await expect(validate({ certificateChain })).rejects.toThrow()
    })

    it('rejects a certificate that names itself as issuer but was signed with another key', async () => {
      const notSelfSigned = await X509Service.createCertificate(agentContext, {
        authorityKey: await createKey(),
        subjectPublicKey: await createKey(),
        issuer: { commonName: 'Not self-signed' },
        subject: { commonName: 'Not self-signed' },
        validity,
        extensions: { basicConstraints: { ca: true } },
      })
      expect(notSelfSigned.subject).toBe(notSelfSigned.issuer)

      await expect(
        validate({
          certificateChain: [notSelfSigned],
          trustedCertificates: [notSelfSigned],
          allowNonRootTrustedCertificate: false,
        })
      ).rejects.toThrow(unableToVerify)
    })
  })

  describe('order and content of the presented chain', () => {
    it('accepts base64, PEM, DER and instances in one chain', async () => {
      const chain = await validate({
        certificateChain: [
          leaf.toString('base64'),
          signer.certificate.toString('pem'),
          intermediate.certificate.rawCertificate,
        ],
        trustedCertificates: [root.certificate],
      })

      expect(chain.map((certificate) => certificate.subject)).toEqual([
        root.certificate.subject,
        intermediate.certificate.subject,
        signer.certificate.subject,
        leaf.subject,
      ])
    })

    it('rejects a chain that is not ordered leaf first', async () => {
      const trustedCertificates = [root.certificate]

      await expect(
        validate({ certificateChain: [signer.certificate, leaf, intermediate.certificate], trustedCertificates })
      ).rejects.toThrow(`Certificate: '${signer.certificate.subject}' ${notIssuedByNext}: '${leaf.subject}'`)
      await expect(
        validate({ certificateChain: [leaf, intermediate.certificate, signer.certificate], trustedCertificates })
      ).rejects.toThrow(notIssuedByNext)
      await expect(
        validate({
          certificateChain: [root.certificate, intermediate.certificate, signer.certificate, leaf],
          trustedCertificates,
        })
      ).rejects.toThrow(notIssuedByNext)
    })

    it('rejects a chain that skips a certificate, also when the rest of the chain is trusted', async () => {
      await expect(
        validate({ certificateChain: [leaf, intermediate.certificate], trustedCertificates: [root.certificate] })
      ).rejects.toThrow(notIssuedByNext)
      await expect(
        validate({
          certificateChain: [leaf, root.certificate],
          trustedCertificates: [signer.certificate, intermediate.certificate, root.certificate],
        })
      ).rejects.toThrow(notIssuedByNext)
    })

    it('rejects a chain with a certificate that is not part of it', async () => {
      const unrelated = await createIntermediate(await createRoot('Unrelated root'), 'Unrelated')
      const trustedCertificates = [root.certificate]

      // Appended
      await expect(
        validate({
          certificateChain: [leaf, signer.certificate, intermediate.certificate, unrelated.certificate],
          trustedCertificates,
        })
      ).rejects.toThrow(notIssuedByNext)
      // Inserted
      await expect(
        validate({
          certificateChain: [leaf, unrelated.certificate, signer.certificate, intermediate.certificate],
          trustedCertificates,
        })
      ).rejects.toThrow(notIssuedByNext)
      // After the self-signed root
      await expect(
        validate({
          certificateChain: [
            leaf,
            signer.certificate,
            intermediate.certificate,
            root.certificate,
            unrelated.certificate,
          ],
          trustedCertificates,
        })
      ).rejects.toThrow(notIssuedByNext)
    })

    it('rejects a chain with the same certificate twice', async () => {
      await expect(
        validate({ certificateChain: [leaf, leaf, signer.certificate], trustedCertificates: [root.certificate] })
      ).rejects.toThrow(notIssuedByNext)
      await expect(
        validate({
          certificateChain: [leaf, signer.certificate, signer.certificate],
          trustedCertificates: [root.certificate],
        })
      ).rejects.toThrow(notIssuedByNext)
      await expect(
        validate({ certificateChain: [root.certificate, root.certificate], trustedCertificates: [root.certificate] })
      ).rejects.toThrow('Circular dependency')
    })
  })

  describe('completing the chain with trusted certificates', () => {
    it('continues with a trusted root that was not presented, and verifies each signature once', async () => {
      const chain = await validate({
        certificateChain: [leaf, signer.certificate, intermediate.certificate],
        trustedCertificates: [root.certificate],
      })

      expect(chain).toEqual([root.certificate, intermediate.certificate, signer.certificate, leaf])
      expect(chain[0]).toBe(root.certificate)
      expect(chain[3]).toBe(leaf)
      expect(verifySignature).toHaveBeenCalledTimes(4)
    })

    it('continues with several trusted certificates in any order', async () => {
      const expected = [root.certificate, intermediate.certificate, signer.certificate, leaf]

      await expect(
        validate({
          certificateChain: [leaf],
          trustedCertificates: [signer.certificate, intermediate.certificate, root.certificate],
        })
      ).resolves.toEqual(expected)
      await expect(
        validate({
          certificateChain: [leaf, signer.certificate],
          trustedCertificates: [root.certificate, intermediate.certificate],
        })
      ).resolves.toEqual(expected)
    })

    it('accepts a chain that presents the trusted root', async () => {
      await expect(
        validate({
          certificateChain: [leaf, signer.certificate, intermediate.certificate, root.certificate],
          trustedCertificates: [root.certificate],
        })
      ).resolves.toHaveLength(4)
    })

    it('ignores trusted certificates that are not part of the chain', async () => {
      const otherRoot = await createRoot('Other root')

      await expect(
        validate({
          certificateChain: [leaf, signer.certificate, intermediate.certificate],
          trustedCertificates: [otherRoot.certificate, root.certificate],
        })
      ).resolves.toHaveLength(4)
    })

    it('accepts a cross-certified issuer with the name and key of a trusted root', async () => {
      const otherRoot = await createRoot('Other root')
      // The key and name of `root`, issued by `otherRoot`
      const crossCertificate = await X509Service.createCertificate(agentContext, {
        authorityKey: otherRoot.key,
        subjectPublicKey: root.key,
        issuer: otherRoot.certificate.subject,
        subject: root.certificate.subject,
        validity,
        extensions: { basicConstraints: { ca: true } },
      })
      const certificateChain = [leaf, signer.certificate, intermediate.certificate, crossCertificate]

      await expect(validate({ certificateChain, trustedCertificates: [otherRoot.certificate] })).resolves.toEqual([
        otherRoot.certificate,
        crossCertificate,
        intermediate.certificate,
        signer.certificate,
        leaf,
      ])
      await expect(validate({ certificateChain, trustedCertificates: [root.certificate] })).rejects.toThrow(
        noTrustedCertificate
      )
    })

    it('uses the valid trusted root when an expired root has the same name and key', async () => {
      const expiredRoot = await X509Service.createCertificate(agentContext, {
        authorityKey: root.key,
        issuer: { commonName: 'Root' },
        validity: { notBefore: new Date(Date.now() - 30 * day), notAfter: new Date(Date.now() - day) },
        extensions: { basicConstraints: { ca: true } },
      })
      const certificateChain = [leaf, signer.certificate, intermediate.certificate]

      for (const trustedCertificates of [
        [expiredRoot, root.certificate],
        [root.certificate, expiredRoot],
      ]) {
        const chain = await validate({ certificateChain, trustedCertificates })
        expect(chain[0]).toBe(root.certificate)
      }
      await expect(validate({ certificateChain, trustedCertificates: [expiredRoot] })).rejects.toThrow(
        'used after it is allowed'
      )
    })

    it('skips a trusted certificate with another key identifier without verifying a signature', async () => {
      const createSigner = async (parent: Issuer): Promise<Issuer> => {
        const key = await createKey()
        const certificate = await X509Service.createCertificate(agentContext, {
          authorityKey: parent.key,
          subjectPublicKey: key,
          issuer: parent.certificate.subject,
          subject: { commonName: 'Signer with key identifier' },
          validity,
          extensions: { basicConstraints: { ca: true }, subjectKeyIdentifier: { include: true } },
        })
        return { key, certificate }
      }
      const signerWithKeyId = await createSigner(intermediate)
      const sameNameOtherKey = await createSigner(intermediate)
      const leafWithKeyId = await X509Service.createCertificate(agentContext, {
        authorityKey: signerWithKeyId.key,
        subjectPublicKey: await createKey(),
        issuer: signerWithKeyId.certificate.subject,
        subject: { commonName: 'Leaf' },
        validity,
        extensions: { authorityKeyIdentifier: { include: true } },
      })
      verifySignature.mockClear()

      await expect(
        validate({
          certificateChain: [leafWithKeyId],
          trustedCertificates: [sameNameOtherKey.certificate, signerWithKeyId.certificate],
        })
      ).resolves.toEqual([signerWithKeyId.certificate, leafWithKeyId])
      // Only against the signer with the matching key identifier
      expect(verifySignature).toHaveBeenCalledTimes(1)
    })

    it('rejects a chain when none of the trusted certificates is part of it', async () => {
      const otherRoot = await createRoot('Other root')
      const certificateChain = [leaf, signer.certificate, intermediate.certificate, root.certificate]

      await expect(validate({ certificateChain, trustedCertificates: [otherRoot.certificate] })).rejects.toThrow(
        noTrustedCertificate
      )
      await expect(validate({ certificateChain, trustedCertificates: [] })).rejects.toThrow(noTrustedCertificate)
      // Also without the root in the chain
      await expect(
        validate({ certificateChain: certificateChain.slice(0, 3), trustedCertificates: [otherRoot.certificate] })
      ).rejects.toThrow(noTrustedCertificate)
      await expect(
        validate({ certificateChain: certificateChain.slice(0, 3), trustedCertificates: [] })
      ).rejects.toThrow(noTrustedCertificate)
    })

    it('rejects a chain up to another root with the name of the trusted root', async () => {
      const otherRoot = await createRoot('Root')
      const leafOfOtherRoot = await createLeaf(otherRoot)

      await expect(
        validate({
          certificateChain: [leafOfOtherRoot, otherRoot.certificate],
          trustedCertificates: [root.certificate],
        })
      ).rejects.toThrow(noTrustedCertificate)
      await expect(
        validate({ certificateChain: [leafOfOtherRoot], trustedCertificates: [root.certificate] })
      ).rejects.toThrow(noTrustedCertificate)
    })
  })

  describe('trusted certificates that are not a root', () => {
    it('accepts a trusted intermediate or leaf without its issuer, and returns the chain from there', async () => {
      await expect(
        validate({
          certificateChain: [leaf, signer.certificate, intermediate.certificate],
          trustedCertificates: [intermediate.certificate],
        })
      ).resolves.toEqual([intermediate.certificate, signer.certificate, leaf])
      await expect(validate({ certificateChain: [leaf], trustedCertificates: [leaf] })).resolves.toEqual([leaf])
    })

    it('returns the chain from a trusted certificate in the middle of the chain', async () => {
      await expect(
        validate({
          certificateChain: [leaf, signer.certificate, intermediate.certificate, root.certificate],
          trustedCertificates: [signer.certificate],
        })
      ).resolves.toEqual([signer.certificate, leaf])
    })

    it('still rejects a broken link above a trusted certificate', async () => {
      const unrelated = await createRoot('Unrelated root')

      await expect(
        validate({
          certificateChain: [leaf, signer.certificate, unrelated.certificate],
          trustedCertificates: [signer.certificate],
        })
      ).rejects.toThrow(notIssuedByNext)
    })

    describe('with allowNonRootTrustedCertificate: false', () => {
      const allowNonRootTrustedCertificate = false

      it('accepts a trusted root', async () => {
        await expect(
          validate({
            certificateChain: [leaf, signer.certificate, intermediate.certificate],
            trustedCertificates: [root.certificate],
            allowNonRootTrustedCertificate,
          })
        ).resolves.toHaveLength(4)
      })

      it('accepts a trusted intermediate whose issuer is presented or trusted', async () => {
        await expect(
          validate({
            certificateChain: [leaf, signer.certificate, intermediate.certificate, root.certificate],
            trustedCertificates: [intermediate.certificate],
            allowNonRootTrustedCertificate,
          })
        ).resolves.toEqual([intermediate.certificate, signer.certificate, leaf])
        await expect(
          validate({
            certificateChain: [leaf, signer.certificate],
            trustedCertificates: [intermediate.certificate, root.certificate],
            allowNonRootTrustedCertificate,
          })
        ).resolves.toHaveLength(4)
      })

      it('rejects a trusted intermediate or leaf without its issuer', async () => {
        await expect(
          validate({
            certificateChain: [leaf, signer.certificate, intermediate.certificate],
            trustedCertificates: [intermediate.certificate],
            allowNonRootTrustedCertificate,
          })
        ).rejects.toThrow(unableToVerify)
        await expect(
          validate({ certificateChain: [leaf], trustedCertificates: [leaf], allowNonRootTrustedCertificate })
        ).rejects.toThrow(unableToVerify)
      })
    })
  })

  describe('forged and changed certificates', () => {
    it('rejects a leaf that names the issuer but was signed with another key', async () => {
      const forgedLeaf = await createLeaf(signer, 'Forged leaf', await createKey())

      await expect(
        validate({
          certificateChain: [forgedLeaf, signer.certificate, intermediate.certificate],
          trustedCertificates: [root.certificate],
        })
      ).rejects.toThrow(notIssuedByNext)
      await expect(
        validate({
          certificateChain: [forgedLeaf, signer.certificate, intermediate.certificate, root.certificate],
          trustedCertificates: [root.certificate],
        })
      ).rejects.toThrow(notIssuedByNext)
      // The trusted issuer is not used to complete the chain either
      await expect(
        validate({ certificateChain: [forgedLeaf], trustedCertificates: [signer.certificate, root.certificate] })
      ).rejects.toThrow(noTrustedCertificate)
    })

    it('rejects an intermediate that names the root but was signed with another key', async () => {
      const forgedIntermediate = await createIntermediate({ ...root, key: await createKey() }, 'Forged intermediate')
      const leafOfForgedIntermediate = await createLeaf(forgedIntermediate)

      await expect(
        validate({
          certificateChain: [leafOfForgedIntermediate, forgedIntermediate.certificate],
          trustedCertificates: [root.certificate],
        })
      ).rejects.toThrow(noTrustedCertificate)
      await expect(
        validate({
          certificateChain: [leafOfForgedIntermediate, forgedIntermediate.certificate, root.certificate],
          trustedCertificates: [root.certificate],
        })
      ).rejects.toThrow(notIssuedByNext)
    })

    it('rejects a leaf signed with the key of the issuer but naming another issuer', async () => {
      const otherName = { ...signer, certificate: intermediate.certificate }
      const leafNamingOtherIssuer = await createLeaf(otherName, 'Leaf naming other issuer', signer.key)
      expect(leafNamingOtherIssuer.issuer).toBe(intermediate.certificate.subject)

      await expect(
        validate({
          certificateChain: [leafNamingOtherIssuer, signer.certificate, intermediate.certificate],
          trustedCertificates: [root.certificate],
        })
      ).rejects.toThrow(notIssuedByNext)
    })

    it('rejects a certificate whose signature was changed', async () => {
      const changedLeaf = leaf.rawCertificate
      changedLeaf[changedLeaf.length - 1] ^= 0x01
      const changedSigner = signer.certificate.rawCertificate
      changedSigner[changedSigner.length - 1] ^= 0x01

      await expect(
        validate({
          certificateChain: [changedLeaf, signer.certificate, intermediate.certificate],
          trustedCertificates: [root.certificate],
        })
      ).rejects.toThrow(notIssuedByNext)
      await expect(
        validate({
          certificateChain: [leaf, changedSigner, intermediate.certificate],
          trustedCertificates: [root.certificate],
        })
      ).rejects.toThrow(notIssuedByNext)
      await expect(
        validate({ certificateChain: [changedLeaf], trustedCertificates: [signer.certificate, root.certificate] })
      ).rejects.toThrow(noTrustedCertificate)
    })
  })

  describe('validity period', () => {
    it('rejects an expired intermediate in a chain with valid signatures', async () => {
      const expiredIntermediate = await createIntermediate(root, 'Expired intermediate', {
        notBefore: new Date(Date.now() - 30 * day),
        notAfter: new Date(Date.now() - day),
      })
      const leafOfExpiredIntermediate = await createLeaf(expiredIntermediate)

      await expect(
        validate({
          certificateChain: [leafOfExpiredIntermediate, expiredIntermediate.certificate],
          trustedCertificates: [root.certificate],
        })
      ).rejects.toThrow('used after it is allowed')
    })

    it('rejects a trusted root that completes the chain but is expired', async () => {
      await expect(
        validate({
          certificateChain: [leaf, signer.certificate, intermediate.certificate],
          trustedCertificates: [root.certificate],
          verificationDate: new Date(validity.notAfter.getTime() + day),
        })
      ).rejects.toThrow('used after it is allowed')
    })

    it('rejects a trusted leaf that is expired or not yet valid', async () => {
      const options = { certificateChain: [leaf], trustedCertificates: [leaf] }

      await expect(
        validate({ ...options, verificationDate: new Date(validity.notAfter.getTime() + day) })
      ).rejects.toThrow('used after it is allowed')
      await expect(
        validate({ ...options, verificationDate: new Date(validity.notBefore.getTime() - day) })
      ).rejects.toThrow('used before it is allowed')
    })

    it('does not check the validity of certificates above the trusted certificate', async () => {
      const expiredRoot = await createRoot('Expired root', {
        notBefore: new Date(Date.now() - 30 * day),
        notAfter: new Date(Date.now() - day),
      })
      const intermediateOfExpiredRoot = await createIntermediate(expiredRoot, 'Intermediate of expired root')
      const certificateChain = [intermediateOfExpiredRoot.certificate, expiredRoot.certificate]

      await expect(
        validate({ certificateChain, trustedCertificates: [intermediateOfExpiredRoot.certificate] })
      ).resolves.toEqual([intermediateOfExpiredRoot.certificate])
      await expect(validate({ certificateChain, trustedCertificates: [expiredRoot.certificate] })).rejects.toThrow(
        'used after it is allowed'
      )
    })
  })
})
