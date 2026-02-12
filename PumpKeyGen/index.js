const { Keypair } = require("@solana/web3.js");
const mongoose = require('mongoose');

const { PumpKeyPair, BonkKeyPair }  = require("./keyPairModel")

// const MONGO_URI = "mongodb://admin:stanic1000@localhost:27017/sol-launchpad?authSource=admin";
const MONGO_URI="mongodb://127.0.0.1:27017/aeysha_pumplaunch"

connectDatabase = (callback) => {
    console.log("⌛️ Connecting database...", MONGO_URI);
    mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
        .then(() => {
            console.log("✅ Mongoose Connected");
            generatePump();
            // generateBonk();
            if (callback)
                callback();
        });
}

const generatePump = async () => {
    let numWallets = 10000000;

    console.log(`Generating Pump Token...`);

    let round = 1;

    for (let i = 0; ; i++) {
        if (i > numWallets) {
            i = 0;
            round++;
            console.log(`round ${round}`);
        }
        // Generating a new random Solana keypair
        const keypair = Keypair.generate();

        // Getting the private key as a byte array
        const privateKey = "[" + keypair.secretKey.toString() + "]";

        // Getting the public key as a base58 encoded string (i.e. the wallet address)
        const publicKey = keypair.publicKey.toString();

        // console.log(`gen Public Key: ${publicKey}`)
        if (publicKey.endsWith("pump")) {
        // if (publicKey.endsWith("mp")) {

            const newPair = await PumpKeyPair.create({
                publicKey,
                privateKey,
                name: null,
                symbol: null,
                uri: null,
                isUsed: false,
            })

            newPair.save()

            console.log("===== Pump publicKey: ", publicKey)
        } 
        if(i % 10000 === 0) {
            await sleep(10);
        }
    }
}

connectDatabase();


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}