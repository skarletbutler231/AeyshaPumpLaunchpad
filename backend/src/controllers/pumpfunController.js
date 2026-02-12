const bs58 = require("bs58");
const {
  Keypair
} = require("@solana/web3.js");

const Project = require("../models/projectModel");
const { PumpKeyPair } = require("../models/keyPairModel");


exports.getPumpKey = async (req, res) => {
  const { tokenUri } = req.body;
  try {
    var count = await PumpKeyPair.countDocuments({ isUsed: { $eq: false } })
    var random = Math.floor(Math.random() * count)

    console.log("count    ", count)
    console.log("random    ", random)

    // select random document in keypairs
    const newPumpKeyPair = await PumpKeyPair.findOne({ isUsed: { $eq: false } }).skip(random)

    if (!newPumpKeyPair) {
      console.log("------ Null PumpFun Mint Address!!! ------")
      res.status(404).json({
        success: false,
        secretKey: null
      });
      return;
    }
    console.log("===".repeat(20), newPumpKeyPair, "===".repeat(20));

    // const keypair = Keypair.generate();
    const keyArray = JSON.parse(newPumpKeyPair.privateKey)
    const privkey = new Uint8Array(keyArray)
    const keypair = Keypair.fromSecretKey(privkey)
    const secretKey = bs58.encode(keypair.secretKey);

    console.log(" =========== new pump keypair ============= ", secretKey);

    newPumpKeyPair.uri = tokenUri;
    newPumpKeyPair.isUsed = true;
    await newPumpKeyPair.save();

    res.status(200).json({
      success: true,
      secretKey
    });

  }

  catch (err) {
    console.log(err);
    res.status(404).json({
      success: false,
      mintAddr: null
    });
  }
}

exports.uploadMetadata = async (req, res) => {
  const { name, symbol, description, tokenUri, twitter, telegram, website } = req.body;
  console.log("Upload metadata...", name, symbol, tokenUri);

  try {
    let formData = new FormData();
    const file = req.files.file;
    console.log(file)
    if (file) {
      // const response = await fetch(icon);
      // if (!response.ok) {
      //   throw new Error(`HTTP error! status: ${response.status}`);
      // }
      // const blob = await response.blob();
      const blob = new Blob([file.data], { type: file.mimetype });
      formData.append("file", blob);
    }
    formData.append("name", name)
    formData.append("symbol", symbol)
    formData.append("description", description ? description : "");
    formData.append("twitter", twitter ? twitter : "");
    formData.append("telegram", telegram ? telegram : "");
    formData.append("website", website ? website : "");
    formData.append("showName", "true");

    let metadataResponse = await fetch("https://pump.fun/api/ipfs", {
      method: "POST",
      body: formData,
    });
    let metadataResponseJSON = await metadataResponse.json();

    const uri = metadataResponseJSON.metadataUri;
    console.log(uri)

    var count = await PumpKeyPair.countDocuments({ isUsed: { $ne: true } })
    var random = Math.floor(Math.random() * count)

    console.log("count    ", count)
    console.log("random    ", random)

    // select random document in keypairs
    const newPumpKeyPair = await PumpKeyPair.findOne({ isUsed: { $ne: true } }).skip(random)

    if (!newPumpKeyPair) {
      console.log("------ Null PumpFun Mint Address!!! ------")
      res.status(404).json({
        success: false,
        mintAddr: null
      });
      return;
    }
    console.log("===".repeat(20), newPumpKeyPair, "===".repeat(20));

    // const keypair = Keypair.generate();
    const keyArray = JSON.parse(newPumpKeyPair.privateKey)
    const privkey = new Uint8Array(keyArray)
    const keypair = Keypair.fromSecretKey(privkey)
    const mintAddr = keypair.publicKey;

    console.log(" =========== new pump keypair ============= ", keypair);

    // newPumpKeyPair.isUsed = true;
    newPumpKeyPair.name = name;
    newPumpKeyPair.symbol = symbol;
    newPumpKeyPair.uri = uri;
    await newPumpKeyPair.save();

    res.status(200).json({
      success: true,
      mintAddr: mintAddr
    });

  }

  catch (err) {
    console.log(err);
    res.status(404).json({
      success: false,
      mintAddr: null
    });
  }
}
