const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  SYSVAR_RENT_PUBKEY
} = require("@solana/web3.js");

const {
  getMint,
  getAccount,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
  createCloseAccountInstruction,
  AccountLayout,
  createInitializeAccountInstruction,
} = require("@solana/spl-token");
const { 
  PumpSdk,
  OnlinePumpSdk
} = require('@pump-fun/pump-sdk');

const dotenv = require('dotenv');
dotenv.config();

const connection = new Connection(process.env.SOLANA_RPC_URL, "confirmed");
const pumpSdk = new PumpSdk();
const onlinePumpSdk =  new OnlinePumpSdk(connection);
const anchor = require('@project-serum/anchor');
const base58 = require("bs58");

const { EVENT_AUTH, feeRecipient, pumpfunGlobalAccount, programID, pumpfunGlobalVolumeAccumulator, pumpfunFeeConfig, pumpfunFeeProgram, pumpContractId } = require("../constants/index");
const { useConnection } = require("./connection");
const { bufferFromUInt64 } = require("./common");
const { TransactionInstruction } = require("@solana/web3.js");

const wsolRentLamports = 2039290;

function getCreatorVaultPDA(creator) {
  const [creatorVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("creator-vault"), creator.toBuffer()],
    new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P") // pumpfun program ID,
  );
  return creatorVault;
}

function getBondingCurvePDA(mint) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), mint.toBuffer()],
    new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P") // pumpfun program ID,
  )[0];
}

function getGlobalVolumeAccumulatorPDA() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("global_volume_accumulator")],
    new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P") // pumpfun program ID,
  )[0];
}

function getUserVolumeAccumulatorPDA(user) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("user_volume_accumulator"), user.toBuffer()],
    new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P") // pumpfun program ID,
  )[0];
}

exports.getSolAmountsSimulate = async (initSolReserve, initTokenReserve, tokenList, extraWallets, slippage) => {
  let tokenReserve = initTokenReserve;
  let solReserve = initSolReserve;

  let solAmounts = [];

  let totalSol = 0;

  let solAmount = 0;

  for (let i = 0; i < tokenList.length; i++) {
    let tokenAmount = tokenList[i];

    solAmount = getAmountIn(tokenAmount, solReserve, tokenReserve)
    solAmount -= 1;
    solAmounts.push(solAmount);

    tokenReserve -= tokenAmount;
    solReserve += solAmount;
  }

  for (let i = 0; i < extraWallets.length; i++) {
    if (extraWallets[i].sim.buy.tokenAmount !== "") {
      const solBalance = await getBalance(new PublicKey(extraWallets[i].address));
      let tokenAmount = extraWallets[i].sim.buy.tokenAmount;

      let solAmount = getAmountIn(tokenAmount, solReserve, tokenReserve);
      solAmount -= 1;

      let maxSolAmount = Number(solBalance) * 0.98 / LAMPORTS_PER_SOL - 0.02;

      if (maxSolAmount >= solAmount * (1 + slippage / 100)) {
        solAmounts.push(solAmount);

        tokenReserve -= tokenAmount;
        solReserve += solAmount;
        continue;
      }

      solAmount = maxSolAmount * 100 / (100 + slippage);
      if (maxSolAmount <= 0.01) solAmount = 0;

      tokenAmount = getAmountOut(solAmount, solReserve, tokenReserve);

      solAmounts.push(solAmount);

      extraWallets[i].sim.buy.tokenAmount = tokenAmount;
      if (tokenAmount == 0) extraWallets[i].sim.buy.tokenAmount = ""

      tokenReserve -= tokenAmount;
      solReserve += solAmount;
    }
  }

  solAmounts.forEach(amount => {
    totalSol += amount;
  })

  console.log("solAmount to buy All tokens", totalSol);

  return solAmounts;
}

exports.getKeypairFromBs58 = (bs58String) => {
  const privateKeyObject = base58.decode(bs58String);
  const privateKey = Uint8Array.from(privateKeyObject);
  const keypair = Keypair.fromSecretKey(privateKey);
  return keypair;
}


exports.getPumpPoolKeys = async (
  program,
  tokenMint,
  is_v2 = false,
) => {
  const mint = tokenMint;
  console.log("new Mint Address: ", mint.toString());
  const mintAuthority = await getMintAuthority(program.programId);
  const bondingCurve = await getBondingCurve(mint, program.programId);
  const bondingCurveAta = await getAssociatedTokenAddress(
    mint,
    bondingCurve,
    true,
    is_v2 ? TOKEN_2022_PROGRAM_ID: TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const metadataAccount = await getMetadataAccount(mint);

  return [mint, mintAuthority, bondingCurve, bondingCurveAta, metadataAccount]
}


/**
 * @function: buildInitializeTx()
 * @description: build Initizalize transaction
 * @param target
 * @returns
 */
exports.buildInitializeTx = async (target, destination) => {
  const tx = new Transaction();

  const seed = destination.toString().slice(0, 20);
  const wsolAccount = await PublicKey.createWithSeed(
    target,
    seed,
    TOKEN_PROGRAM_ID
  )


  const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");

  const createUserAtaIx = SystemProgram.createAccountWithSeed({
    fromPubkey: target,
    basePubkey: target,
    seed: seed,
    newAccountPubkey: wsolAccount,
    lamports: wsolRentLamports,
    space: AccountLayout.span,
    programId: TOKEN_PROGRAM_ID
  });

  const initializeUserAtaIx = createInitializeAccountInstruction(
    wsolAccount,
    WSOL_MINT,
    target,
    TOKEN_PROGRAM_ID
  );

  const stateAccount = PublicKey.findProgramAddressSync(
    [Buffer.from("state"), target.toBuffer()],
    new PublicKey(pumpContractId) // pumpfun program ID,
  )[0];

  console.log("stateAccount", stateAccount);
  const keys = [
    { pubkey: target, isSigner: false, isWritable: true },
    { pubkey: stateAccount, isSigner: false, isWritable: true },
    { pubkey: target, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  // Create instruction data buffer (discriminator + target public key)
  const instructionDiscriminator = Buffer.from("afaf6d1f0d989bed", "hex");
  const data = Buffer.concat([
    instructionDiscriminator,
  ]);

  // Create the transaction instruction
  const initializeIx = new TransactionInstruction({
    keys: keys,
    programId: new PublicKey(pumpContractId),
    data: data
  });

  tx.add(createUserAtaIx, initializeUserAtaIx, initializeIx);
  return tx;
}

/**
 * @function: buildRecoverTx()
 * @description: build Recover transaction
 * @param target
 * @param destination
 * @param feeAmount
 * @returns
 */
exports.buildRecoverTx = async (
  target,
  destination,
  feeAmount
) => {
  const tx = new Transaction();

  const stateAccount = PublicKey.findProgramAddressSync(
    [Buffer.from("state"), target.toBuffer()],
    new PublicKey(pumpContractId) // pumpfun program ID,
  )[0];

  const seed = destination.toString().slice(0, 20);
  const wsolAccount = await PublicKey.createWithSeed(
    target,
    seed,
    TOKEN_PROGRAM_ID
  )

  const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
  // const wsolAccount = getAssociatedTokenAddressSync(WSOL_MINT, target, false);

  // const createWsolIx = createAssociatedTokenAccountInstruction(
  //   target,    // payer who signs and pays rent
  //   wsolAccount,      // ata address to create
  //   target,    // token account owner
  //   WSOL_MINT  // WSOL mint address
  // );

  const keys = [
    { pubkey: stateAccount, isSigner: false, isWritable: true },
    { pubkey: target, isSigner: true, isWritable: true },
    { pubkey: destination, isSigner: false, isWritable: true },
    { pubkey: wsolAccount, isSigner: false, isWritable: true },
    { pubkey: WSOL_MINT, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: new PublicKey("SysvarRent111111111111111111111111111111111"), isSigner: false, isWritable: false },
  ];

  const instructionDiscriminator = Buffer.from("6cd8263a6d927411", "hex");
  const data = Buffer.concat([
    instructionDiscriminator,
    bufferFromUInt64(feeAmount.toString())
  ]);

  // Create the transaction instruction
  const recoverIx = new TransactionInstruction({
    keys: keys,
    programId: new PublicKey(pumpContractId),
    data: data
  });

  tx.add(recoverIx);
  // tx.add(createWsolIx, recoverIx);

  return tx;
}

/**
 * @function: buildBuyTxBufferContract()
 * @description: build buy transaction
 * @param signerKeypair
 * @param mint
 * @param tokenAmount
 * @param creator
 * @returns
 */
exports.buildBuyTxBufferContract = async (
  signerKeypair,
  mint,
  tokenAmount,
  creator,
  feeAmount,
  isToken2022 = false,
) => {
  const bondingCurve = getBondingCurvePDA(mint);
  const [associatedBondingCurve] = PublicKey.findProgramAddressSync(
    [
      bondingCurve.toBuffer(),
      isToken2022 ? TOKEN_2022_PROGRAM_ID.toBuffer() : TOKEN_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const creatorVaultPDA = getCreatorVaultPDA(creator);

  const user = signerKeypair.publicKey;
  const userAta = getAssociatedTokenAddressSync(mint, user, true, isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID);
  const userVolumeAccumulator = getUserVolumeAccumulatorPDA(user);

  const decimals = 6;
  const finalAmount = tokenAmount;

  console.log(`Buy token(${mint.toString()}) ${finalAmount}`);

  //creating tx;
  const tx = new Transaction();

  tx.add(
    createAssociatedTokenAccountInstruction(
      user,
      userAta,
      user,
      mint,
      isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID
    )
  );

  const keys = [
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: new PublicKey(pumpfunGlobalAccount), isSigner: false, isWritable: false },
    { pubkey: new PublicKey(feeRecipient), isSigner: false, isWritable: true },
    { pubkey: bondingCurve, isSigner: false, isWritable: true },
    { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
    { pubkey: userAta, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: creatorVaultPDA, isSigner: false, isWritable: true },
    { pubkey: new PublicKey(EVENT_AUTH), isSigner: false, isWritable: false },
    { pubkey: new PublicKey(programID), isSigner: false, isWritable: false },
    { pubkey: new PublicKey(pumpfunGlobalVolumeAccumulator), isSigner: false, isWritable: true },
    { pubkey: userVolumeAccumulator, isSigner: false, isWritable: true },
    { pubkey: new PublicKey(pumpfunFeeConfig), isSigner: false, isWritable: false },
    { pubkey: new PublicKey(pumpfunFeeProgram), isSigner: false, isWritable: false },
    { pubkey: user, isSigner: true, isWritable: true },
  ];

  // Create the instruction data buffer
  const instructionDiscriminator = Buffer.from("09a61df3f8b357a6", "hex");
  const data = Buffer.concat([
    instructionDiscriminator,
    bufferFromUInt64(Math.floor(finalAmount * 10 ** decimals)),
    bufferFromUInt64(feeAmount.toString()),
  ]);

  // Create the transaction instruction
  const buyIx = new TransactionInstruction({
    keys: keys,
    programId: new PublicKey(pumpContractId),
    data: data
  });
  tx.add(buyIx);

  return tx;
}

/**
 * @function: buildMintTx()
 * @description: build mint transaction
 * @param program
 * @param signerKeypair
 * @param tokenMint
 * @param tokenName
 * @param tokenSymbol
 * @param tokenUri
 * @returns
 */
exports.buildMintTx = async (
  program,
  signerKeypair,
  tokenMint,
  tokenName,
  tokenSymbol,
  tokenUri
) => {
  //creating tx;
  const tx = new Transaction();

  const snipeIx = await program.methods
    .create(tokenName, tokenSymbol, tokenUri, signerKeypair.publicKey)
    .accountsPartial({
      mint: tokenMint,
      user: signerKeypair.publicKey,
    })
    .instruction();
  tx.add(snipeIx);

  return tx;
}

/**
 * @function: buildMintBuyTx()
 * @description: build mint&buy transaction
 * @param program
 * @param connection
 * @param signerKeypair
 * @param tokenMint
 * @param maxSolCost
 * @param tokenAmount
 * @returns
 */
exports.buildMintBuyTx = async (
  program,
  connection,
  signerKeypair,
  tokenMint,
  maxSolCost,
  tokenAmount,
  creator
) => {
  const mint = new PublicKey(tokenMint);

  const creatorVaultPDA = getCreatorVaultPDA(creator);

  const user = signerKeypair.publicKey;
  const userAta = getAssociatedTokenAddressSync(mint, user, true);
  const signerTokenAccount = getAssociatedTokenAddressSync(
    mint,
    user,
    true,
    TOKEN_PROGRAM_ID
  );

  const decimals = 6;
  const finalAmount = tokenAmount;

  console.log(`Buy token(${mint.toString()}) ${finalAmount}`);

  //creating tx;
  const tx = new Transaction();

  tx.add(
    createAssociatedTokenAccountInstruction(
      user,
      signerTokenAccount,
      user,
      mint
    )
  );

  const snipeIx = await program.methods
    .buy(
      new anchor.BN(finalAmount * 10 ** decimals),
      new anchor.BN(maxSolCost * LAMPORTS_PER_SOL)
    )
    .accountsPartial({
      feeRecipient: feeRecipient,
      mint: mint,
      associatedUser: userAta,
      user: user,
      creatorVault: creatorVaultPDA
    })
    .instruction();
  tx.add(snipeIx);

  return tx;
}

exports.buildMintBuyTxV2 = async (
  signerKeypair,
  tokenMint,
  tokenName,
  tokenSymbol,
  tokenUri,
  maxSolCost,
  tokenAmount,
  creator,
  isForSnipe = false
) => {
  const mint = new PublicKey(tokenMint);

  const globalData = await onlinePumpSdk.fetchGlobal();
  const user = signerKeypair.publicKey;

  const decimals = 6;
  const finalAmount = tokenAmount;

  console.log(`Buy token(${mint.toString()}) ${finalAmount}`);

  //creating tx;
  const tx = new Transaction();

  const snipeIx = await pumpSdk.createV2AndBuyInstructions({
    global: globalData,
    mint,
    name: tokenName,
    symbol: tokenSymbol,
    uri: tokenUri,
    creator,
    user,
    amount: new anchor.BN(finalAmount * 10 ** decimals),    
    solAmount: new anchor.BN(maxSolCost)
  })

  if (isForSnipe) {
    tx.add(...snipeIx.slice(-3));
  } else {
    tx.add(...snipeIx);
  }

  return tx;
}

/**
 * @function: buildMintBuyTxBuffer()
 * @description: build buy transaction
 * @param signerKeypair
 * @param tokenMint
 * @param maxSolCost
 * @param tokenAmount
 * @returns
 */
exports.buildMintBuyTxBuffer = async (
  signerKeypair,
  mint,
  maxSolCost,
  tokenAmount,
  creator
) => {
  const bondingCurve = getBondingCurvePDA(mint);
  const [associatedBondingCurve] = PublicKey.findProgramAddressSync(
    [
      bondingCurve.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const creatorVaultPDA = getCreatorVaultPDA(creator);

  const user = signerKeypair.publicKey;
  const userAta = getAssociatedTokenAddressSync(mint, user, true);
  const userVolumeAccumulator = getUserVolumeAccumulatorPDA(user);

  const decimals = 6;
  const finalAmount = tokenAmount;

  console.log(`Buy token(${mint.toString()}) ${finalAmount}`);

  //creating tx;
  const tx = new Transaction();

  tx.add(
    createAssociatedTokenAccountInstruction(
      user,
      userAta,
      user,
      mint
    )
  );

  const keys = [
    { pubkey: new PublicKey(pumpfunGlobalAccount), isSigner: false, isWritable: false },
    { pubkey: new PublicKey(feeRecipient), isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: bondingCurve, isSigner: false, isWritable: true },
    { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
    { pubkey: userAta, isSigner: false, isWritable: true },
    { pubkey: user, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: creatorVaultPDA, isSigner: false, isWritable: true },
    { pubkey: new PublicKey(EVENT_AUTH), isSigner: false, isWritable: false },
    { pubkey: new PublicKey(programID), isSigner: false, isWritable: false },
    { pubkey: new PublicKey(pumpfunGlobalVolumeAccumulator), isSigner: false, isWritable: true },
    { pubkey: userVolumeAccumulator, isSigner: false, isWritable: true },
    { pubkey: new PublicKey(pumpfunFeeConfig), isSigner: false, isWritable: false },
    { pubkey: new PublicKey(pumpfunFeeProgram), isSigner: false, isWritable: false },
  ];

  // Create the instruction data buffer
  const data = Buffer.concat([
    bufferFromUInt64("16927863322537952870"),
    bufferFromUInt64(Math.floor(finalAmount * 10 ** decimals)),
    bufferFromUInt64(maxSolCost.toString())
  ]);

  // Create the transaction instruction
  const buyIx = new TransactionInstruction({
    keys: keys,
    programId: new PublicKey(programID),
    data: data
  });
  tx.add(buyIx);

  return tx;
}

/**
 * @function: buildSellTxBuffer()
 * @description: build sell transaction
 * @param signerKeypair
 * @param tokenMint
 * @param maxSolCost
 * @param tokenAmount
 * @param creator
 * @param isClose
 * @returns
 */
exports.buildSellTxBuffer = async (
  signerKeypair,
  mint,
  minSolAmount,
  tokenAmount,
  creator,
  isClose = false,
  isToken2022 = false
) => {
  const bondingCurve = getBondingCurvePDA(mint);
  const [associatedBondingCurve] = PublicKey.findProgramAddressSync(
    [
      bondingCurve.toBuffer(),
      isToken2022 ? TOKEN_2022_PROGRAM_ID.toBuffer() : TOKEN_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const creatorVaultPDA = getCreatorVaultPDA(creator);

  const user = signerKeypair.publicKey;
  const userAta = getAssociatedTokenAddressSync(mint, user, true, isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID);

  const decimals = 6;
  const finalAmount = tokenAmount;

  console.log(`Sell token(${mint.toString()}) ${finalAmount}`);

  //creating tx;
  const tx = new Transaction();

  const keys = [
    { pubkey: new PublicKey(pumpfunGlobalAccount), isSigner: false, isWritable: false },
    { pubkey: new PublicKey(feeRecipient), isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: bondingCurve, isSigner: false, isWritable: true },
    { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
    { pubkey: userAta, isSigner: false, isWritable: true },
    { pubkey: user, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: creatorVaultPDA, isSigner: false, isWritable: true },
    { pubkey: isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: new PublicKey(EVENT_AUTH), isSigner: false, isWritable: false },
    { pubkey: new PublicKey(programID), isSigner: false, isWritable: false },
    { pubkey: new PublicKey(pumpfunFeeConfig), isSigner: false, isWritable: false },
    { pubkey: new PublicKey(pumpfunFeeProgram), isSigner: false, isWritable: false },
  ];

  // Create the instruction data buffer
  const data = Buffer.concat([
    bufferFromUInt64("12502976635542562355"),
    bufferFromUInt64(Math.floor(finalAmount * 10 ** decimals)),
    bufferFromUInt64(minSolAmount.toString())
  ]);

  // Create the transaction instruction
  const sellTx = new TransactionInstruction({
    keys: keys,
    programId: new PublicKey(programID),
    data: data
  });
  tx.add(sellTx);

  // Close token ATA account
  if (isClose) {
    tx.add(
      createCloseAccountInstruction(
        userAta,
        user,
        user,
        [],
        isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID
      )
    );
  }

  return tx;
}

/**
 * @function: buildMintBuyTxLamports()
 * @description: build mint&buy transaction
 * @param program
 * @param connection
 * @param signerKeypair
 * @param tokenMint
 * @param maxSolCost
 * @param tokenAmount
 * @returns
 */
exports.buildMintBuyTxLamports = async (
  program,
  signerKeypair,
  mint,
  maxSolCost,
  tokenAmount,
  creator
) => {

  const creatorVaultPDA = getCreatorVaultPDA(creator);

  const user = signerKeypair.publicKey;
  const userAta = getAssociatedTokenAddressSync(mint, user, true);
  const signerTokenAccount = getAssociatedTokenAddressSync(
    mint,
    user,
    true,
    TOKEN_PROGRAM_ID
  );

  const decimals = 6;
  const finalAmount = tokenAmount;

  console.log(`Buy token(${mint.toString()}) ${finalAmount}`);

  //creating tx;
  const tx = new Transaction();

  tx.add(
    createAssociatedTokenAccountInstruction(
      user,
      signerTokenAccount,
      user,
      mint
    )
  );

  console.log("program buy", program);

  const snipeIx = await program.methods
    .buy(
      new anchor.BN(finalAmount * 10 ** decimals),
      new anchor.BN(maxSolCost)
    )
    .accountsPartial({
      feeRecipient: feeRecipient,
      mint: mint,
      associatedUser: userAta,
      user: user,
      creatorVault: creatorVaultPDA
    })
    .instruction();
  tx.add(snipeIx);

  return tx;
}

// given an input amount of an asset and pair reserves, returns the maximum output amount of the other asset
function getAmountOut(amountIn, reserveIn, reserveOut) {
  let amountInWithFee = amountIn * 997;
  let numerator = amountInWithFee * reserveOut;
  let denominator = reserveIn * 1000 + amountInWithFee;
  let amountOut = numerator / denominator;

  return amountOut;
}

// given an output amount of an asset and pair reserves, returns a required input amount of the other asset
function getAmountIn(amountOut, reserveIn, reserveOut) {
  let numerator = reserveIn * amountOut * 1000;
  let denominator = (reserveOut - amountOut) * 997;
  let amountIn = numerator / denominator + 1;

  return amountIn;
}

function getTokenAmounts(
  initSolReserve,
  initTokenReserve,
  solList
) {
  // const initTokenReserve = 1073000000;
  // const initSolReserve = 30.000000002;

  let tokenAmount = 0;
  let tokenReserve = initTokenReserve;
  let solReserve = initSolReserve;
  let tokenPrice = 0;
  let tokenAmounts = [];

  for (let i = 0; i < solList.length; i++) {
    let solAmount = solList[i];
    tokenPrice = solReserve / tokenReserve;

    tokenAmount = getAmountOut(solAmount, solReserve, tokenReserve);

    tokenAmounts.push(tokenAmount);

    tokenReserve -= tokenAmount;
    solReserve += solAmount;
  }

  return tokenAmounts;
}

exports.calcTokenAmounts = async (connection, program, mint, solNumbers) => {
  const bondingCurve = await getBondingCurve(mint, program.programId);
  const [bondingCurveData, mintData] = await Promise.all([
    program.account.bondingCurve.fetch(bondingCurve),
    connection.getParsedAccountInfo(mint),
  ]);

  //@ts-ignore
  const decimals = mintData.value?.data.parsed.info.decimals;
  const virtualTokenReserves = (
    bondingCurveData.virtualTokenReserves
  ).toNumber();
  const virtualSolReserves = (
    bondingCurveData.virtualSolReserves
  ).toNumber();

  const adjustedVirtualTokenReserves = virtualTokenReserves / 10 ** decimals;
  const adjustedVirtualSolReserves = virtualSolReserves / LAMPORTS_PER_SOL;
  const virtualTokenPrice =
    adjustedVirtualSolReserves / adjustedVirtualTokenReserves;

  const tokenAmounts = getTokenAmounts(
    adjustedVirtualSolReserves,
    adjustedVirtualTokenReserves,
    solNumbers
  );

  return tokenAmounts;
}

exports.calcTokenAmount = async (connection, program, mint, solNumber) => {
  const bondingCurve = await getBondingCurve(mint, program.programId);
  const [bondingCurveData, mintData] = await Promise.all([
    program.account.bondingCurve.fetch(bondingCurve),
    connection.getParsedAccountInfo(mint),
  ]);

  //@ts-ignore
  const decimals = mintData.value?.data.parsed.info.decimals;
  const virtualTokenReserves = (
    bondingCurveData.virtualTokenReserves
  ).toNumber();
  const virtualSolReserves = (
    bondingCurveData.virtualSolReserves
  ).toNumber();

  const adjustedVirtualTokenReserves = virtualTokenReserves / 10 ** decimals;
  const adjustedVirtualSolReserves = virtualSolReserves / LAMPORTS_PER_SOL;
  const virtualTokenPrice =
    adjustedVirtualSolReserves / adjustedVirtualTokenReserves;

  const tokenAmounts = getTokenAmounts(
    adjustedVirtualSolReserves,
    adjustedVirtualTokenReserves,
    [solNumber]
  );

  return tokenAmounts[0];
}

/**
 * @function: buildBuyTx()
 * @description: generate buy transaction
 * @param program
 * @param connection
 * @param signerKeypair
 * @param tokenMint
 * @param numberAmount
 * @param maxSolCost
 * @param priorityFee
 * @param tokenAmount
 * @returns
 */
exports.buildBuyTx = async (
  program,
  connection,
  signerKeypair,
  tokenMint,
  numberAmount,
  maxSolCost,
  tokenAmount,
  bondingCurveParam = null,
) => {
  const mint = new PublicKey(tokenMint);
  const decimals = 6;

  const pumpSDK = new PumpSdk(connection);

  let bondingCurve = bondingCurveParam;

  if (!bondingCurve) {
    const bondingCurvePDA = pumpSDK.bondingCurvePda(mint);
    const bondingCurveInfo = await connection.getAccountInfo(bondingCurvePDA)

    if (!bondingCurveInfo) {
      console.log("Bonding curve info is null");
      return [];
    }

    bondingCurve = pumpSDK.decodeBondingCurve(bondingCurveInfo);
  }

  const creatorVaultPDA = pumpSDK.creatorVaultPda(bondingCurve.creator);

  const globalState = new PublicKey(
    "4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf"
  ); // fixed

  const user = signerKeypair.publicKey;
  const userAta = getAssociatedTokenAddressSync(mint, user, true);
  const userAtaInfo = await connection.getAccountInfo(userAta);

  const finalAmount = tokenAmount ? tokenAmount : (await this.calcTokenAmount(connection, program, mint, numberAmount))

  console.log(`Buy token(${mint.toString()}) ${finalAmount}`);

  //creating tx;
  const tx = new Transaction();

  if (!userAtaInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        user,
        userAta,
        user,
        mint
      )
    );
  }

  const buyIx = await program.methods
    .buy(
      new anchor.BN(finalAmount * 10 ** decimals),
      new anchor.BN(maxSolCost * LAMPORTS_PER_SOL)
    )
    .accountsPartial({
      feeRecipient: feeRecipient,
      mint: mint,
      associatedUser: userAta,
      user: user,
      creatorVault: creatorVaultPDA
    })
    .instruction();
  tx.add(buyIx);

  return tx;
}

/**
 * @function: buildBuyTxWithBuffer()
 * @description: generate buy transaction
 * @param program
 * @param connection
 * @param signerKeypair
 * @param tokenMint
 * @param numberAmount
 * @param maxSolCost
 * @param priorityFee
 * @param tokenAmount
 * @returns
 */
exports.buildBuyTxWithBuffer = async (
  program,
  connection,
  signerKeypair,
  tokenMint,
  numberAmount,
  maxSolCost,
  tokenAmount,
  bondingCurveParam = null,
  isToken2022 = false,
) => {
  const mint = new PublicKey(tokenMint);
  const decimals = 6;

  const pumpSDK = new PumpSdk(connection);

  let bondingCurve = bondingCurveParam;

  const bondingCurvePDA = getBondingCurvePDA(mint);

  if (!bondingCurve) {

    try {
      const bondingCurveInfo = await connection.getAccountInfo(bondingCurvePDA)
      
      if (!bondingCurveInfo) {
        console.log("Bonding curve info is null");
        return [];
      }

      bondingCurve = pumpSDK.decodeBondingCurve(bondingCurveInfo);

    } catch (error) {
      console.log(error);
      return [];
    }
  }

  const [associatedBondingCurve] = PublicKey.findProgramAddressSync(
    [
      bondingCurvePDA.toBuffer(),
      isToken2022 ? TOKEN_2022_PROGRAM_ID.toBuffer() : TOKEN_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const user = signerKeypair.publicKey;
  const userAta = getAssociatedTokenAddressSync(mint, user, true, isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID);
  const userVolumeAccumulator = getUserVolumeAccumulatorPDA(user);
  const creatorVaultPDA = getCreatorVaultPDA(bondingCurve.creator);

  const finalAmount = tokenAmount ? tokenAmount : (await this.calcTokenAmount(connection, program, mint, numberAmount))

  console.log(`Buy token(${mint.toString()}) ${finalAmount}`);

  const tx = new Transaction();

  try {
    await getAccount(connection, userAta, "confirmed", isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID);
  } catch (error) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        user,
        userAta,
        user,
        mint,
        isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID
      )
    );
  }

  const keys = [
    { pubkey: new PublicKey(pumpfunGlobalAccount), isSigner: false, isWritable: false },
    { pubkey: new PublicKey(feeRecipient), isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: bondingCurvePDA, isSigner: false, isWritable: true },
    { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
    { pubkey: userAta, isSigner: false, isWritable: true },
    { pubkey: user, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: creatorVaultPDA, isSigner: false, isWritable: true },
    { pubkey: new PublicKey(EVENT_AUTH), isSigner: false, isWritable: false },
    { pubkey: new PublicKey(programID), isSigner: false, isWritable: false },
    { pubkey: new PublicKey(pumpfunGlobalVolumeAccumulator), isSigner: false, isWritable: true },
    { pubkey: userVolumeAccumulator, isSigner: false, isWritable: true },
    { pubkey: new PublicKey(pumpfunFeeConfig), isSigner: false, isWritable: false },
    { pubkey: new PublicKey(pumpfunFeeProgram), isSigner: false, isWritable: false },
  ];

  // Create the instruction data buffer
  const data = Buffer.concat([
    bufferFromUInt64("16927863322537952870"),
    bufferFromUInt64(Math.floor(finalAmount * 10 ** decimals)),
    bufferFromUInt64(Math.floor(maxSolCost * LAMPORTS_PER_SOL))
  ]);

  // Create the transaction instruction
  const buyIx = new TransactionInstruction({
    keys: keys,
    programId: new PublicKey(programID),
    data: data
  });
  tx.add(buyIx);

  return tx;
}

/**
 * @function: buildSellTx()
 * @description: build sell transaction
 * @param program
 * @param connection
 * @param signerKeypair
 * @param tokenMint
 * @param percentage
 * @param tokenAmount
 * @returns
 */
exports.buildSellTx = async (
  program,
  connection,
  signerKeypair,
  tokenMint,
  percentage,
  tokenAmount
) => {
  const mint = new PublicKey(tokenMint);
  
  const user = signerKeypair.publicKey;
  const userAta = getAssociatedTokenAddressSync(mint, user, true);
  const decimals = 6;
  
  let finalAmount = 0;
  if (tokenAmount == 0) {
    let tokenBalance = 0;
    while (1) {
      tokenBalance = await this.getSafeTokenBalance(
        userAta.publicKey.toBase58(),
        mint.toBase58()
      );
      if (tokenBalance > 0)
        break;
    }
    finalAmount = (tokenBalance * percentage) / 100;
  } else finalAmount = tokenAmount;

  console.log(`Sell token(${mint.toString()}) ${finalAmount}`);

  //creating tx;
  const tx = new Transaction();

  const snipeIx = await program.methods
    .sell(new anchor.BN(finalAmount * 10 ** decimals), new anchor.BN(0 * LAMPORTS_PER_SOL))
    .accountsPartial({
      feeRecipient: feeRecipient,
      mint: mint,
      associatedUser: userAta,
      user: user,
    })
    .instruction();
  tx.add(snipeIx);

  return tx;
}

/**
 * @function: buildSellTxWithBuffer()
 * @description: build sell transaction
 * @param program
 * @param connection
 * @param signerKeypair
 * @param tokenMint
 * @param percentage
 * @param tokenAmount
 * @returns
 */
exports.buildSellTxWithBuffer = async (
  program,
  connection,
  signerKeypair,
  tokenMint,
  percentage,
  tokenAmount,
  isToken2022 = false,
) => {
  const mint = new PublicKey(tokenMint);
  
  const user = signerKeypair.publicKey;
  const userAta = getAssociatedTokenAddressSync(mint, user, true, isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID);
  const bondingCurvePDA = getBondingCurvePDA(mint);
  const decimals = 6;
  
  let finalAmount = 0;
  if (tokenAmount == 0) {
    let tokenBalance = 0;
    while (1) {
      tokenBalance = await this.getSafeTokenBalance(
        userAta.toBase58(),
        mint.toBase58()
      );
      if (tokenBalance > 0)
        break;
    }
    finalAmount = (tokenBalance * percentage) / 100;
  } else finalAmount = tokenAmount;

  console.log(`Sell token(${mint.toString()}) ${finalAmount}`);

  //creating tx;
  const tx = new Transaction();

  const pumpSDK = new PumpSdk(connection);

  let bondingCurve;
  try {
    const bondingCurveInfo = await connection.getAccountInfo(bondingCurvePDA)
    
    if (!bondingCurveInfo) {
      console.log("Bonding curve info is null");
      return [];
    }

    bondingCurve = pumpSDK.decodeBondingCurve(bondingCurveInfo);

  } catch (error) {
    console.log(error);
    return [];
  }

  const [associatedBondingCurve] = PublicKey.findProgramAddressSync(
    [
      bondingCurvePDA.toBuffer(),
      isToken2022 ? TOKEN_2022_PROGRAM_ID.toBuffer() : TOKEN_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const creatorVaultPDA = getCreatorVaultPDA(bondingCurve.creator);

  const keys = [
    { pubkey: new PublicKey(pumpfunGlobalAccount), isSigner: false, isWritable: false },
    { pubkey: new PublicKey(feeRecipient), isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: bondingCurvePDA, isSigner: false, isWritable: true },
    { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
    { pubkey: userAta, isSigner: false, isWritable: true },
    { pubkey: user, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: creatorVaultPDA, isSigner: false, isWritable: true },
    { pubkey: isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: new PublicKey(EVENT_AUTH), isSigner: false, isWritable: false },
    { pubkey: new PublicKey(programID), isSigner: false, isWritable: false },
    { pubkey: new PublicKey(pumpfunFeeConfig), isSigner: false, isWritable: false },
    { pubkey: new PublicKey(pumpfunFeeProgram), isSigner: false, isWritable: false },
  ];

  // Create the instruction data buffer
  const data = Buffer.concat([
    bufferFromUInt64("12502976635542562355"),
    bufferFromUInt64(Math.round(finalAmount * 10 ** decimals)),
    bufferFromUInt64((0))
  ]);

  // Create the transaction instruction
  const sellTx = new TransactionInstruction({
    keys: keys,
    programId: new PublicKey(programID),
    data: data
  });
  tx.add(sellTx);

  return tx;
}

exports.getSafeSolBalance = async (walletAddr) => {
  let solBalance = -1;
  while (1) {
    solBalance = await getBalance(walletAddr);
    if (solBalance !== -1) break;
    await sleep(50);
  }
  return solBalance;
}

exports.getSafeTokenBalance = async (
  walletAddr,
  tokenMintAddr
) => {
  let tokenBalance = -1;
  while (1) {
    tokenBalance = await getTokenAccountBalance(
      new PublicKey(walletAddr),
      new PublicKey(tokenMintAddr)
    );
    if (tokenBalance !== -1) break;
    await sleep(50);
  }
  return tokenBalance;
}

/**
 * @function: getTokenAccountBalance()
 * @description: Get token balance from wallet
 * @param walletAddress : target wallet address
 * @param mintAddress : token mint address
 * @returns
 */
async function getTokenAccountBalance(
  walletAddress,
  mintAddress
) {
  const { connection } = useConnection();
  try {
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletAddress,
      { mint: mintAddress }
    );

    // Extract the token amount from the first account (if multiple accounts exist)
    const balance =
      tokenAccounts.value[0]?.account.data.parsed.info.tokenAmount.uiAmount;
    return balance || 0;
  } catch (e) {
    console.log("get token balance error: ", e);
    return -1;
  }
}

/**
 * @func: getBalance
 * @description: Get sol amount from target wallet
 * @param walletPublicKey : target wallet address
 * @returns : sol amount (LAMPORTS_PER_SOL)
 */
async function getBalance(walletPublicKey) {
  const { connection } = useConnection();
  if (connection === null || connection === undefined) return -1;

  try {
    const balance = await connection.getBalance(walletPublicKey);
    return balance;
  } catch (err) {
    console.log("get sol balance error: ", err);
    return -1;
  }
}

// given an output amount of an asset and pair reserves, returns a required input amount of the other asset
function getAmountIn(amountOut, reserveIn, reserveOut) {
  let numerator = reserveIn * amountOut * 1000;
  let denominator = (reserveOut - amountOut) * 997;
  let amountIn = numerator / denominator + 1;

  return amountIn;
}

/**
 * @function: getMintAuthority()
 * @description: get mint authority from Program
 * @param tokenMint
 * @param programId
 * @returns
 */
async function getMintAuthority(programId) {
  const seedString = "mint-authority";

  const [PDA, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from(seedString)],
    programId
  );

  return new PublicKey(PDA);
}

/**
 * @function: getBondingCurve()
 * @description: get bonding curve according to mint address
 * @param tokenMint : token mint address
 * @param programId : program ID
 * @returns
 */
async function getBondingCurve(tokenMint, programId) {
  const seedString = "bonding-curve";

  const [PDA, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from(seedString), tokenMint.toBuffer()],
    programId
  );

  return new PublicKey(PDA);
}

/**
 * @function: getMetadataAccount()
 * @description: get metadata account from Program
 * @param tokenMint
 * @param programId
 * @returns
 */
async function getMetadataAccount(tokenMint) {
  const seedString = "metadata";

  const [PDA, bump] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(seedString),
      new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").toBuffer(),
      tokenMint.toBuffer(),
    ],
    new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
  );

  return new PublicKey(PDA);
}