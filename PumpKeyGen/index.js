const { Keypair } = require("@solana/web3.js");
const mongoose = require("mongoose");

const { pumpKeyPairSchema } = require("./keyPairModel");

const SOURCE_DB_URI = "mongodb://127.0.0.1:27017/aeysha_pumplaunch";
const DEST_DB_URI = "mongodb://127.0.0.1:27017/sol_multipump_db";

let PumpKeyPairSource;
let PumpKeyPairDest;

const connectDatabases = async (callback) => {
    console.log("⌛️ Connecting source DB...", SOURCE_DB_URI);
    const sourceConn = mongoose.createConnection(SOURCE_DB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
    console.log("⌛️ Connecting destination DB...", DEST_DB_URI);
    const destConn = mongoose.createConnection(DEST_DB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    await Promise.all([
        new Promise((resolve, reject) => {
            sourceConn.once("open", () => {
                console.log("✅ Source DB (aeysha_pumplaunch) connected");
                resolve();
            });
            sourceConn.on("error", reject);
        }),
        new Promise((resolve, reject) => {
            destConn.once("open", () => {
                console.log("✅ Destination DB (sol_multipump_db) connected");
                resolve();
            });
            destConn.on("error", reject);
        }),
    ]);

    PumpKeyPairSource = sourceConn.model("PumpKeyPair", pumpKeyPairSchema);
    PumpKeyPairDest = destConn.model("PumpKeyPair", pumpKeyPairSchema);

    // await copySourceToDest();
    generatePump();
    if (callback) callback();
};

async function copySourceToDest() {
    console.log("⌛️ Copying existing PumpKeyPair from aeysha_pumplaunch → sol_multipump_db...");
    const cursor = PumpKeyPairSource.find({}).cursor();
    let copied = 0;
    let skipped = 0;
    for await (const doc of cursor) {
        const exists = await PumpKeyPairDest.findOne({ publicKey: doc.publicKey });
        if (!exists) {
            await PumpKeyPairDest.create({
                publicKey: doc.publicKey,
                privateKey: doc.privateKey,
                name: doc.name,
                symbol: doc.symbol,
                uri: doc.uri,
                isUsed: doc.isUsed,
            });
            copied++;
        } else {
            skipped++;
        }
    }
    console.log(`✅ Copy done: ${copied} inserted, ${skipped} already existed in sol_multipump_db`);
}

const generatePump = async () => {
    const numWallets = 10000000;
    console.log("Generating Pump Token...");

    let round = 1;

    for (let i = 0; ; i++) {
        if (i > numWallets) {
            i = 0;
            round++;
            console.log(`round ${round}`);
        }
        const keypair = Keypair.generate();
        const privateKey = "[" + keypair.secretKey.toString() + "]";
        const publicKey = keypair.publicKey.toString();

        if (publicKey.endsWith("pump")) {
            const payload = {
                publicKey,
                privateKey,
                name: null,
                symbol: null,
                uri: null,
                isUsed: false,
            };

            await PumpKeyPairSource.create(payload);
            const existsInDest = await PumpKeyPairDest.findOne({ publicKey });
            if (!existsInDest) {
                await PumpKeyPairDest.create(payload);
            }
            console.log("===== Pump publicKey: ", publicKey);
        }
        if (i % 10000 === 0) {
            await sleep(10);
        }
    }
};

connectDatabases();


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}