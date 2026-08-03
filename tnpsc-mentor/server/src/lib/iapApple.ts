// ─── App Store purchase verification (StoreKit 2) ───────────────────────────
// The iOS app sends the `jwsRepresentation` of a StoreKit 2 transaction. That is
// a JWS signed by a certificate chain rooted at Apple's own CA, so it can be
// verified entirely offline: no App Store Connect API key, no network round trip,
// nothing that can be down when a user is trying to pay.
//
// What a valid signature buys us, and what it does NOT: it proves Apple issued
// this transaction for this bundle id. It does NOT prove the transaction belongs
// to the account currently calling us — that is what the appAccountToken check
// below is for, and it is the difference between "verified" and "safe".

import { readFileSync } from 'node:fs'
import { Environment, SignedDataVerifier } from '@apple/app-store-server-library'
import { config } from '../config.js'

/**
 * Apple Root CA - G3 (DER, base64), the trust anchor for every StoreKit 2 signed
 * transaction. Public, non-secret, and stable until 2039 — embedded rather than
 * fetched so verification has no runtime dependency on apple.com being reachable.
 * Source: https://www.apple.com/certificateauthority/AppleRootCA-G3.cer
 * SHA-256: 63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79
 */
const APPLE_ROOT_CA_G3_B64 = [
  'MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9v',
  'dCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UE',
  'CgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2',
  'WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmlj',
  'YXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqG',
  'SM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxE',
  'tX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNC',
  'MEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0P',
  'AQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3m',
  'eoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkL',
  'F1vLUagM6BgD56KyKA==',
].join('')

function rootCertificates(): Buffer[] {
  const certs = [Buffer.from(APPLE_ROOT_CA_G3_B64, 'base64')]
  // Escape hatch: if Apple ever rotates the root mid-deployment, a DER file can
  // be dropped in and pointed at without shipping new code.
  const extra = process.env.APPLE_ROOT_CA_PATH
  if (extra) {
    try {
      certs.push(readFileSync(extra))
    } catch {
      /* configured but unreadable — the embedded root still stands */
    }
  }
  return certs
}

export interface AppleTransaction {
  transactionId: string
  originalTransactionId?: string
  productId: string
  /** Our account id, if the app stamped one (it does — see lib/iap.ts). */
  appAccountToken?: string
  purchaseDateMs: number
  /** Minor units in `currency`, when Apple reports price on the transaction. */
  priceMinorUnits?: number
  currency?: string
  environment: 'Sandbox' | 'Production'
}

export class AppleVerifyError extends Error {}

// One verifier per environment; constructing one parses the root cert, so they
// are cached rather than rebuilt per request.
const verifiers = new Map<Environment, SignedDataVerifier>()

function verifierFor(env: Environment): SignedDataVerifier {
  const hit = verifiers.get(env)
  if (hit) return hit
  const v = new SignedDataVerifier(
    rootCertificates(),
    // Online checks would add an OCSP round trip to Apple on the critical path of
    // a payment. The chain and signature are checked either way; a revoked
    // *signing* cert is not a realistic attack against a receipt we also bind to
    // a bundle id, a product id and an account id.
    false,
    env,
    config.appleBundleId,
    // Apple requires the numeric app id for Production. Omitted in Sandbox.
    env === Environment.PRODUCTION ? config.appleAppAppleId : undefined
  )
  verifiers.set(env, v)
  return v
}

/**
 * Verify a StoreKit 2 signed transaction and return its decoded, trusted fields.
 * Throws AppleVerifyError when the JWS is not genuine, is for another app, or
 * has been revoked/refunded.
 *
 * Production is tried first and Sandbox second. That ordering is not cosmetic:
 * TestFlight and App Review both transact in Sandbox against a Production build,
 * so a server that only accepts Production would reject the reviewer's own test
 * purchase and fail the submission.
 */
export async function verifyAppleTransaction(jws: string): Promise<AppleTransaction> {
  if (!jws || typeof jws !== 'string') {
    throw new AppleVerifyError('Missing App Store transaction')
  }

  const order =
    config.isProd && config.appleAppAppleId
      ? [Environment.PRODUCTION, Environment.SANDBOX]
      : [Environment.SANDBOX, Environment.PRODUCTION]

  let lastError: unknown
  for (const env of order) {
    try {
      const payload = await verifierFor(env).verifyAndDecodeTransaction(jws)

      // A refunded or revoked purchase must never grant access, even though its
      // signature stays valid forever.
      if (payload.revocationDate) {
        throw new AppleVerifyError('That purchase was refunded or revoked')
      }
      if (!payload.transactionId || !payload.productId) {
        throw new AppleVerifyError('Incomplete App Store transaction')
      }

      return {
        transactionId: String(payload.transactionId),
        originalTransactionId: payload.originalTransactionId
          ? String(payload.originalTransactionId)
          : undefined,
        productId: String(payload.productId),
        appAccountToken: payload.appAccountToken
          ? String(payload.appAccountToken)
          : undefined,
        purchaseDateMs: Number(payload.purchaseDate ?? Date.now()),
        priceMinorUnits:
          typeof payload.price === 'number' ? Math.round(payload.price) : undefined,
        currency: payload.currency ? String(payload.currency) : undefined,
        environment: env === Environment.PRODUCTION ? 'Production' : 'Sandbox',
      }
    } catch (e) {
      // A revocation is a settled answer, not "try the other environment".
      if (e instanceof AppleVerifyError) throw e
      lastError = e
    }
  }

  throw new AppleVerifyError(
    `App Store transaction could not be verified${
      lastError instanceof Error ? `: ${lastError.message}` : ''
    }`
  )
}
