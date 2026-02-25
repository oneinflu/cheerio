'use strict';

const crypto = require('crypto');

// Generate RSA 2048 key pair
function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });
  return { publicKey, privateKey };
}

// Decrypt the request from Meta
// payload: { encrypted_aes_key, initial_vector, encrypted_flow_data }
// privateKeyPem: PEM string of the private key
function decryptRequest(payload, privateKeyPem) {
  const { encrypted_aes_key, initial_vector, encrypted_flow_data } = payload;

  // 1. Decrypt AES key using Private Key (RSA-OAEP-256)
  const encryptedAesKeyBuffer = Buffer.from(encrypted_aes_key, 'base64');
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  
  const aesKey = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    encryptedAesKeyBuffer
  );

  // 2. Decrypt Flow Data using AES-GCM
  const flowDataBuffer = Buffer.from(encrypted_flow_data, 'base64');
  const ivBuffer = Buffer.from(initial_vector, 'base64');
  
  // The tag is appended to the end of the encrypted data in some implementations, 
  // but Meta usually sends it as the last 16 bytes of encrypted_flow_data.
  // Let's assume standard AES-GCM behavior where tag is at the end.
  const authTagLength = 16;
  const authTag = flowDataBuffer.subarray(flowDataBuffer.length - authTagLength);
  const encryptedData = flowDataBuffer.subarray(0, flowDataBuffer.length - authTagLength);

  const decipher = crypto.createDecipheriv('aes-128-gcm', aesKey, ivBuffer);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return {
    decryptedBody: JSON.parse(decrypted.toString('utf8')),
    aesKey,
    initialVector: ivBuffer
  };
}

// Encrypt the response to Meta
// responseData: JSON object
// aesKey: Buffer (decrypted from request)
// initialVector: Buffer (original IV from request)
function encryptResponse(responseData, aesKey, initialVector) {
  // Flip the IV bits for the response
  const flippedIv = Buffer.alloc(initialVector.length);
  for (let i = 0; i < initialVector.length; i++) {
    flippedIv[i] = ~initialVector[i];
  }

  const cipher = crypto.createCipheriv('aes-128-gcm', aesKey, flippedIv);
  
  const dataBuffer = Buffer.from(JSON.stringify(responseData), 'utf8');
  let encrypted = cipher.update(dataBuffer);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Combine encrypted data + auth tag
  const encryptedFlowData = Buffer.concat([encrypted, authTag]);

  return encryptedFlowData.toString('base64');
}

module.exports = {
  generateKeyPair,
  decryptRequest,
  encryptResponse
};
