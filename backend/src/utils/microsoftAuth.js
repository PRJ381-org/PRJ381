const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const { MS_CLIENT_ID, MS_TENANT_ID } = require('../config/env');

let client;
function getClient() {
  if (!client) {
    client = jwksClient({
      jwksUri: `https://login.microsoftonline.com/${MS_TENANT_ID}/discovery/v2.0/keys`,
      cache: true,
      rateLimit: true,
    });
  }
  return client;
}

function getSigningKey(header, callback) {
  getClient().getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

/**
 * Verifies a Microsoft Entra ID token (signature, issuer, audience, expiry).
 * Throws if MS_CLIENT_ID/MS_TENANT_ID aren't configured yet, or if the token is invalid.
 * Resolves with the decoded token payload (contains email, name, etc.) on success.
 */
function verifyMicrosoftIdToken(idToken) {
  if (!MS_CLIENT_ID || !MS_TENANT_ID) {
    throw new Error(
      'Microsoft login is not configured yet (MS_CLIENT_ID / MS_TENANT_ID missing). Ask Chris for the App Registration details.'
    );
  }

  return new Promise((resolve, reject) => {
    jwt.verify(
      idToken,
      getSigningKey,
      {
        audience: MS_CLIENT_ID,
        issuer: `https://login.microsoftonline.com/${MS_TENANT_ID}/v2.0`,
      },
      (err, decoded) => {
        if (err) return reject(err);
        resolve(decoded);
      }
    );
  });
}

module.exports = { verifyMicrosoftIdToken };
