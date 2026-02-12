const { PumpAmmSdk, Direction } = require("@pump-fun/pump-swap-sdk");
const { Keypair, PublicKey, Transaction } = require("@solana/web3.js");
const BN = require("bn.js");
const { useConnection } = require("./connection");

exports.buildPumpSwapSellTx = async (
    pool,
    signerKeypair,
    tokenAmount
) => {
    const { connection } = useConnection();
    const pumpAmmSdk = new PumpAmmSdk(connection);

    const swapInstructions = await pumpAmmSdk.swapBaseInstructions(
        pool,
        new BN(tokenAmount * 10 ** 6),
        100,
        "baseToQuote",
        signerKeypair.publicKey
    )

    const tx = new Transaction();
    tx.add(...swapInstructions);

    return tx;
}

exports.buildPumpSwapBuyTx = async (
    pool,
    signerKeypair,
    solAmount
) => {
    const { connection } = useConnection();
    const pumpAmmSdk = new PumpAmmSdk(connection);

    const swapInstructions = await pumpAmmSdk.swapQuoteInstructions(
        pool,
        new BN(solAmount * 10 ** 9),
        100,
        "quoteToBase",
        signerKeypair.publicKey
    )

    const tx = new Transaction();
    tx.add(...swapInstructions);

    return tx;
}