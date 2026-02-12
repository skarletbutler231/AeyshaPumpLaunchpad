const { PublicKey } = require("@solana/web3.js");
const nacl = require('tweetnacl')


exports.verifySignature = (signingData, signature, publicKey) => {
    const encodedMessage = new TextEncoder().encode(JSON.stringify(signingData));
    // Convert the signature to Uint8Array if needed
    const signatureUint8 = Uint8Array.from(signature);

    // Convert the public key to Uint8Array
    const publicKeyUint8 = new PublicKey(publicKey).toBytes();

    // Verify the signature
    return nacl.sign.detached.verify(encodedMessage, signatureUint8, publicKeyUint8);
};