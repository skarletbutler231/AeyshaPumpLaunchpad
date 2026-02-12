import { BN } from "bn.js";
import BigNumber from "bignumber.js";
import bs58 from "bs58";
import {
    Keypair,
    PublicKey,
    SystemProgram,
    Transaction,
    TransactionInstruction,
    TransactionMessage,
    VersionedTransaction,
    SYSVAR_RENT_PUBKEY,
    LAMPORTS_PER_SOL,
    Connection,
} from "@solana/web3.js";
import {
    MINT_SIZE,
    TOKEN_PROGRAM_ID,
    AuthorityType,
    getMint,
    getAccount,
    getMinimumBalanceForRentExemptMint,
    getAssociatedTokenAddress,
    createInitializeAccountInstruction,
    createInitializeMintInstruction,
    createAssociatedTokenAccountInstruction,
    createMintToInstruction,
    createSetAuthorityInstruction,
    createBurnInstruction,
    createCloseAccountInstruction,
    AccountLayout,
    NATIVE_MINT,
    createFreezeAccountInstruction,
    ExtensionType,
    TYPE_SIZE,
    LENGTH_SIZE,
    TOKEN_2022_PROGRAM_ID,
    getMintLen,
    createInitializeTransferFeeConfigInstruction,
    createInitializeMetadataPointerInstruction,
} from "@solana/spl-token";
import {
    createInitializeInstruction,
    pack
} from "@solana/spl-token-metadata"
import {
    Token,
    TokenAmount,
    TxVersion,
    LOOKUP_TABLE_CACHE,
    DEVNET_PROGRAM_ID,
    MAINNET_PROGRAM_ID,
    SPL_ACCOUNT_LAYOUT,
    MARKET_STATE_LAYOUT_V2,
    InstructionType,
    Liquidity,
    generatePubKey,
    struct,
    u8,
    u16,
    u32,
    u64,
    splitTxAndSigners,
    poolKeys2JsonInfo,
    buildSimpleTransaction,
    // Percent,
    jsonInfo2PoolKeys,
} from "@raydium-io/raydium-sdk";
import { CREATE_CPMM_POOL_PROGRAM, Percent } from "@raydium-io/raydium-sdk-v2";
import { Market, MARKET_STATE_LAYOUT_V3 } from "@project-serum/serum";
import * as anchor from "@project-serum/anchor";
import {
    PROGRAM_ID,
    Metadata,
    createCreateMetadataAccountV3Instruction,
} from "@metaplex-foundation/mpl-token-metadata";
import axios from "axios";
import { Buffer } from 'buffer';
import { JUPITOR_ADDRESS, PUMPFUN_UPDATE_AUTHORITY, RAYDIUMPOOL_V4_ADDRESS, RAYDIUM_AMM_ROUTING_ADDRESS, RAYDIUM_AUTHORITY_V4_ADDRESS, programID } from "./uniconst";
import idl from "../config/idl.json";
import { SERVER_URL } from "../config/env";
import { getSdk, initSdk, isValidAmm, isValidCpmm } from "./raydiumSdk";

const JITO_TIMEOUT = 150000;
const PROGRAMIDS = (process.env.REACT_APP_DEVNET_MODE === "true") ? DEVNET_PROGRAM_ID : MAINNET_PROGRAM_ID;
const addLookupTableInfo = (process.env.REACT_APP_DEVNET_MODE === "true") ? undefined : LOOKUP_TABLE_CACHE;
const AUTH_HEADER = import.meta.env.VITE_APP_NEXTBLOCK_AUTH_HEADER;

export const solanaConnection = new Connection(import.meta.env.VITE_APP_RPC_URL, {
    wsEndpoint: import.meta.env.VITE_APP_WSS_URL,
});

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

export const USE_JITO = true;
const TRADER_API_TIP_WALLET = "astra9xWY93QyfG6yM8zwsKsRodscjQ2uU2HKNL5prk";

async function makeCreateMarketInstruction({
    connection,
    owner,
    baseInfo,
    quoteInfo,
    lotSize, // 1
    tickSize, // 0.01
    dexProgramId,
    makeTxVersion,
    lookupTableCache
}) {
    const market = generatePubKey({ fromPublicKey: owner, programId: dexProgramId });
    const requestQueue = generatePubKey({ fromPublicKey: owner, programId: dexProgramId });
    const eventQueue = generatePubKey({ fromPublicKey: owner, programId: dexProgramId });
    const bids = generatePubKey({ fromPublicKey: owner, programId: dexProgramId });
    const asks = generatePubKey({ fromPublicKey: owner, programId: dexProgramId });
    const baseVault = generatePubKey({ fromPublicKey: owner, programId: TOKEN_PROGRAM_ID });
    const quoteVault = generatePubKey({ fromPublicKey: owner, programId: TOKEN_PROGRAM_ID });
    const feeRateBps = 0;
    const quoteDustThreshold = new BN(100);

    function getVaultOwnerAndNonce() {
        const vaultSignerNonce = new BN(0);
        while (true) {
            try {
                const vaultOwner = PublicKey.createProgramAddressSync([market.publicKey.toBuffer(), vaultSignerNonce.toArrayLike(Buffer, 'le', 8)], dexProgramId);
                return { vaultOwner, vaultSignerNonce };
            }
            catch (e) {
                vaultSignerNonce.iaddn(1);
                if (vaultSignerNonce.gt(new BN(25555)))
                    throw Error('find vault owner error');
            }
        }
    }

    function initializeMarketInstruction({ programId, marketInfo }) {
        const dataLayout = struct([
            u8('version'),
            u32('instruction'),
            u64('baseLotSize'),
            u64('quoteLotSize'),
            u16('feeRateBps'),
            u64('vaultSignerNonce'),
            u64('quoteDustThreshold'),
        ]);

        const keys = [
            { pubkey: marketInfo.id, isSigner: false, isWritable: true },
            { pubkey: marketInfo.requestQueue, isSigner: false, isWritable: true },
            { pubkey: marketInfo.eventQueue, isSigner: false, isWritable: true },
            { pubkey: marketInfo.bids, isSigner: false, isWritable: true },
            { pubkey: marketInfo.asks, isSigner: false, isWritable: true },
            { pubkey: marketInfo.baseVault, isSigner: false, isWritable: true },
            { pubkey: marketInfo.quoteVault, isSigner: false, isWritable: true },
            { pubkey: marketInfo.baseMint, isSigner: false, isWritable: false },
            { pubkey: marketInfo.quoteMint, isSigner: false, isWritable: false },
            // Use a dummy address if using the new dex upgrade to save tx space.
            {
                pubkey: marketInfo.authority ? marketInfo.quoteMint : SYSVAR_RENT_PUBKEY,
                isSigner: false,
                isWritable: false,
            },
        ]
            .concat(marketInfo.authority ? { pubkey: marketInfo.authority, isSigner: false, isWritable: false } : [])
            .concat(
                marketInfo.authority && marketInfo.pruneAuthority
                    ? { pubkey: marketInfo.pruneAuthority, isSigner: false, isWritable: false }
                    : [],
            );

        const data = Buffer.alloc(dataLayout.span);
        dataLayout.encode(
            {
                version: 0,
                instruction: 0,
                baseLotSize: marketInfo.baseLotSize,
                quoteLotSize: marketInfo.quoteLotSize,
                feeRateBps: marketInfo.feeRateBps,
                vaultSignerNonce: marketInfo.vaultSignerNonce,
                quoteDustThreshold: marketInfo.quoteDustThreshold,
            },
            data,
        );

        return new TransactionInstruction({
            keys,
            programId,
            data,
        });
    }

    const { vaultOwner, vaultSignerNonce } = getVaultOwnerAndNonce();

    const ZERO = new BN(0);
    const baseLotSize = new BN(Math.round(10 ** baseInfo.decimals * lotSize).toFixed(0));
    const quoteLotSize = new BN(Math.round(lotSize * 10 ** quoteInfo.decimals * tickSize).toFixed(0));
    if (baseLotSize.eq(ZERO))
        throw Error('lot size is too small');
    if (quoteLotSize.eq(ZERO))
        throw Error('tick size or lot size is too small');

    const ins1 = [];
    const accountLamports = await connection.getMinimumBalanceForRentExemption(165);
    ins1.push(
        SystemProgram.createAccountWithSeed({
            fromPubkey: owner,
            basePubkey: owner,
            seed: baseVault.seed,
            newAccountPubkey: baseVault.publicKey,
            lamports: accountLamports,
            space: 165,
            programId: TOKEN_PROGRAM_ID,
        }),
        SystemProgram.createAccountWithSeed({
            fromPubkey: owner,
            basePubkey: owner,
            seed: quoteVault.seed,
            newAccountPubkey: quoteVault.publicKey,
            lamports: accountLamports,
            space: 165,
            programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeAccountInstruction(baseVault.publicKey, baseInfo.mint, vaultOwner),
        createInitializeAccountInstruction(quoteVault.publicKey, quoteInfo.mint, vaultOwner),
    );

    const EVENT_QUEUE_ITEMS = 128; // Default: 2978
    const REQUEST_QUEUE_ITEMS = 63; // Default: 63
    const ORDERBOOK_ITEMS = 201; // Default: 909

    const eventQueueSpace = EVENT_QUEUE_ITEMS * 88 + 44 + 48;
    const requestQueueSpace = REQUEST_QUEUE_ITEMS * 80 + 44 + 48;
    const orderBookSpace = ORDERBOOK_ITEMS * 80 + 44 + 48;

    const ins2 = [];
    ins2.push(
        SystemProgram.createAccountWithSeed({
            fromPubkey: owner,
            basePubkey: owner,
            seed: market.seed,
            newAccountPubkey: market.publicKey,
            lamports: await connection.getMinimumBalanceForRentExemption(MARKET_STATE_LAYOUT_V2.span),
            space: MARKET_STATE_LAYOUT_V2.span,
            programId: dexProgramId,
        }),
        SystemProgram.createAccountWithSeed({
            fromPubkey: owner,
            basePubkey: owner,
            seed: requestQueue.seed,
            newAccountPubkey: requestQueue.publicKey,
            lamports: await connection.getMinimumBalanceForRentExemption(requestQueueSpace),
            space: requestQueueSpace,
            programId: dexProgramId,
        }),
        SystemProgram.createAccountWithSeed({
            fromPubkey: owner,
            basePubkey: owner,
            seed: eventQueue.seed,
            newAccountPubkey: eventQueue.publicKey,
            lamports: await connection.getMinimumBalanceForRentExemption(eventQueueSpace),
            space: eventQueueSpace,
            programId: dexProgramId,
        }),
        SystemProgram.createAccountWithSeed({
            fromPubkey: owner,
            basePubkey: owner,
            seed: bids.seed,
            newAccountPubkey: bids.publicKey,
            lamports: await connection.getMinimumBalanceForRentExemption(orderBookSpace),
            space: orderBookSpace,
            programId: dexProgramId,
        }),
        SystemProgram.createAccountWithSeed({
            fromPubkey: owner,
            basePubkey: owner,
            seed: asks.seed,
            newAccountPubkey: asks.publicKey,
            lamports: await connection.getMinimumBalanceForRentExemption(orderBookSpace),
            space: orderBookSpace,
            programId: dexProgramId,
        }),
        initializeMarketInstruction({
            programId: dexProgramId,
            marketInfo: {
                id: market.publicKey,
                requestQueue: requestQueue.publicKey,
                eventQueue: eventQueue.publicKey,
                bids: bids.publicKey,
                asks: asks.publicKey,
                baseVault: baseVault.publicKey,
                quoteVault: quoteVault.publicKey,
                baseMint: baseInfo.mint,
                quoteMint: quoteInfo.mint,
                baseLotSize: baseLotSize,
                quoteLotSize: quoteLotSize,
                feeRateBps: feeRateBps,
                vaultSignerNonce: vaultSignerNonce,
                quoteDustThreshold: quoteDustThreshold,
            },
        }),
    );

    const ins = {
        address: {
            marketId: market.publicKey,
            requestQueue: requestQueue.publicKey,
            eventQueue: eventQueue.publicKey,
            bids: bids.publicKey,
            asks: asks.publicKey,
            baseVault: baseVault.publicKey,
            quoteVault: quoteVault.publicKey,
            baseMint: baseInfo.mint,
            quoteMint: quoteInfo.mint,
        },
        innerTransactions: [
            {
                instructions: ins1,
                signers: [],
                instructionTypes: [
                    InstructionType.createAccount,
                    InstructionType.createAccount,
                    InstructionType.initAccount,
                    InstructionType.initAccount,
                ],
            },
            {
                instructions: ins2,
                signers: [],
                instructionTypes: [
                    InstructionType.createAccount,
                    InstructionType.createAccount,
                    InstructionType.createAccount,
                    InstructionType.createAccount,
                    InstructionType.createAccount,
                    InstructionType.initMarket,
                ],
            },
        ]
    };

    return {
        address: ins.address,
        innerTransactions: await splitTxAndSigners({
            connection,
            makeTxVersion,
            computeBudgetConfig: undefined,
            payer: owner,
            innerTransaction: ins.innerTransactions,
            lookupTableCache,
        }),
    };
}

export const getSwapInfoFromTrx = async (connection, tokenAddress, signature) => {

    let errorResult = { isSwap: false, type: "None", sendToken: null, sendAmount: 0, receiveToken: null, receiveAmount: 0 };
    let tx = null

    try {
        tx = await connection.getParsedTransaction(
            signature,
            {
                maxSupportedTransactionVersion: 0,
                commitment: 'confirmed',
            }
        );

        console.log(tx);

        if (!tx || !tx.meta) {
            return errorResult
        }

        const instructions = tx.transaction.message.instructions;

        console.log(tx)

        const innerinstructions = tx.meta.innerInstructions;
        if (!innerinstructions || innerinstructions === undefined) {
            return errorResult
        }

        for (let i = 0; i < instructions.length; i++) {
            // check raydium swap transaction
            console.log(instructions[i].programId.toBase58())
            if (
                instructions[i].programId.toBase58() === RAYDIUMPOOL_V4_ADDRESS
                || instructions[i].programId.toBase58() === RAYDIUM_AUTHORITY_V4_ADDRESS
                || instructions[i].programId.toBase58() === RAYDIUM_AMM_ROUTING_ADDRESS
                || instructions[i].programId.toBase58() === JUPITOR_ADDRESS
            ) {
                for (let j = 0; j < innerinstructions.length; j++) {
                    if (innerinstructions[j].index === i) {
                        if (!innerinstructions[j].instructions || innerinstructions[j].instructions == undefined || innerinstructions[j].instructions.length < 2) {
                            continue
                        }

                        try {
                            const parsedInstructions = innerinstructions[j].instructions

                            for (let k = 0; k < parsedInstructions.length; k++) {
                                if (!parsedInstructions[k].parsed || !parsedInstructions[k + 1]?.parsed)
                                    continue;

                                if (parsedInstructions[k].parsed.info && parsedInstructions[k].parsed.info.destination) {
                                    const sendToken = await getTokenAddressFromTokenAccount(connection, parsedInstructions[k].parsed.info.destination);
                                    const sendAmount = Number(parsedInstructions[k].parsed.info.amount);
                                    const receiveToken = await getTokenAddressFromTokenAccount(connection, parsedInstructions[k + 1]?.parsed.info.source);
                                    const receiveAmount = Number(parsedInstructions[k + 1].parsed.info.amount);

                                    if ((sendToken === tokenAddress || receiveToken === tokenAddress) && sendToken && receiveToken) {
                                        const pair = await retrieveTokenValueByAddressDexScreener(tokenAddress);
                                        return { isSwap: true, blockTime: tx.blockTime, txHash: tx.transaction.signatures[0], sendToken, sendAmount, receiveToken, receiveAmount, priceNative: pair.priceNative, priceUsd: pair.priceUsd, owner: tx.transaction.message.accountKeys[0].pubkey.toBase58() }
                                    }
                                }
                            }
                        } catch (error) {
                            console.log(error)
                            continue
                        }
                    }
                }
            }
        }
    }
    catch (e) {
        console.log(e)
        return errorResult;
    }

    return errorResult;
}

export const getTokenAddressFromTokenAccount = async (connection, tokenAccountAddress) => {

    try {
        const tokenAccountPubkey = new PublicKey(tokenAccountAddress);
        const accountInfo = await connection.getAccountInfo(tokenAccountPubkey);

        if (accountInfo === null) {
            throw new Error('Token account not found');
        }

        const accountData = AccountLayout.decode(accountInfo.data);
        const mintAddress = new PublicKey(accountData.mint);

        return mintAddress.toBase58();
    } catch (error) {
        console.error('Error fetching token address:', error);
    }

    return null;
}

export const retrieveTokenValueByAddressDexScreener = async (tokenAddress) => {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
    try {
        const tokenResponse = (await axios.get(url)).data;
        if (tokenResponse.pairs) {
            const pair = tokenResponse.pairs.find((pair) => (pair.chainId = 'solana'));
            const priceNative = pair?.priceNative;
            const marketCap = pair?.fdv;
            if (priceNative && marketCap) return pair;
        }
        return undefined;
    } catch (e) {
        return undefined
    }
};

export const CreateTraderAPITipInstruction = (
    senderAddress,
    tipAmount
) => {
    const tipAddress = new PublicKey(TRADER_API_TIP_WALLET)

    return SystemProgram.transfer({
        fromPubkey: senderAddress,
        toPubkey: tipAddress,
        lamports: tipAmount,
    })
}

export async function getTipTransaction(connection, ownerPubkey, tip) {
    try {
        console.log("Adding Tip Transaction")
        const tipInstr = CreateTraderAPITipInstruction(ownerPubkey, tip * LAMPORTS_PER_SOL)
        const tipTx = new Transaction().add(tipInstr)

        tipTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        tipTx.feePayer = ownerPubkey;

        return tipTx;
    }
    catch (err) {
        console.log(err);
    }
    return null;
}

export async function getWalletTokenAccount(connection, ownerPubkey) {
    const walletTokenAccount = await connection.getTokenAccountsByOwner(ownerPubkey, {
        programId: TOKEN_PROGRAM_ID,
    });
    return walletTokenAccount.value.map((item) => ({
        pubkey: item.pubkey,
        programId: item.account.owner,
        accountInfo: SPL_ACCOUNT_LAYOUT.decode(item.account.data),
    }));
}

export async function getTokenListByOwner(connection, ownerPubkey, queryMarketId) {
    const walletTokenAccount = await connection.getTokenAccountsByOwner(ownerPubkey, {
        programId: TOKEN_PROGRAM_ID,
    });
    const tokenList = await Promise.all(walletTokenAccount.value.map(async (item) => {
        const accountInfo = SPL_ACCOUNT_LAYOUT.decode(item.account.data);
        const mintInfo = await getMint(connection, accountInfo.mint);
        const [metadataPDA] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("metadata"),
                PROGRAM_ID.toBuffer(),
                accountInfo.mint.toBuffer()
            ],
            PROGRAM_ID
        );

        let marketId = null;
        if (queryMarketId) {
            const quoteMint = new PublicKey("So11111111111111111111111111111111111111112");
            const marketAccounts = await Market.findAccountsByMints(connection, accountInfo.mint, quoteMint, PROGRAMIDS.OPENBOOK_MARKET);
            if (marketAccounts.length > 0)
                marketId = marketAccounts[0].publicKey;
        }

        let tokenName = "";
        let tokenSymbol = "";
        let logoURI = "";
        try {
            const metadata = await Metadata.fromAccountAddress(connection, metadataPDA);
            try {
                const tNames = metadata.data.name.split('\0');
                const tSymbols = metadata.data.symbol.split('\0');
                tokenName = tNames[0];
                tokenSymbol = tSymbols[0];
            }
            catch (err) {
                console.log(err);
                tokenName = metadata.data.name;
                tokenSymbol = metadata.data.symbol;
            }

            try {
                console.log(metadata.data.uri);
                const { data } = await axios.get(metadata.data.uri);
                if (data.image)
                    logoURI = data.image;
                else
                    logoURI = metadata.data.uri;
            }
            catch (err) {
                console.log(err);
            }
        }
        catch (err) {
            console.log(err);
        }

        return {
            name: tokenName,
            symbol: tokenSymbol,
            logoURI: logoURI,
            mint: accountInfo.mint.toBase58(),
            account: item.pubkey.toBase58(),
            balance: accountInfo.amount.div(new BN(Math.pow(10, mintInfo.decimals).toFixed(0))).toString(),
            marketId: (queryMarketId && marketId) ? marketId : undefined,
        };
    }));
    return tokenList;
}

export async function getMemeCoinInfo(connection, tokenAddress) {
    try {
        const mintAddress = new PublicKey(tokenAddress);
        if (connection) {
            const mintInfo = await getMint(connection, mintAddress);
            const [metadataPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("metadata"),
                    PROGRAM_ID.toBuffer(),
                    mintAddress.toBuffer()
                ],
                PROGRAM_ID
            )

            let tokenName = "";
            let tokenSymbol = "";
            let logoURI = "";
            try {
                const metadata = await Metadata.fromAccountAddress(connection, metadataPDA);
                try {
                    const tNames = metadata.data.name.split('\0');
                    const tSymbols = metadata.data.symbol.split('\0');
                    tokenName = tNames[0];
                    tokenSymbol = tSymbols[0];
                }
                catch (err) {
                    console.log(err);
                    tokenName = metadata.data.name;
                    tokenSymbol = metadata.data.symbol;
                }

                try {
                    console.log(metadata.data.uri);
                    const { data } = await axios.get(metadata.data.uri);
                    if (data.image)
                        logoURI = data.image;
                    else
                        logoURI = metadata.data.uri;
                }
                catch (err) {
                    console.log(err);
                }
            }
            catch (err) {
                console.log(err);
            }

            return {
                address: tokenAddress,
                mintAuthority: mintInfo.mintAuthority,
                freezeAuthority: mintInfo.freezeAuthority,
                name: tokenName,
                symbol: tokenSymbol,
                totalSupply: mintInfo.supply,
                decimals: mintInfo.decimals,
                logo: logoURI
            }
        }
    } catch (e) {
        console.log(e)
        console.log("This chain has no this token. Please check your token address again on this chain.")
        return null;
    }
}

export async function getPoolInfo(connection, token) {
    console.log("Getting pool info...", token);

    if (!token) {
        console.log("Invalid token address");
        return {};
    }

    let fromPumpfun = await isFromPumpfun(connection, token);
    const mint = new PublicKey(token);
    const mintInfo = await getMint(connection, mint);

    const baseToken = new Token(TOKEN_PROGRAM_ID, token, mintInfo.decimals);
    const quoteToken = new Token(TOKEN_PROGRAM_ID, "So11111111111111111111111111111111111111112", 9, "WSOL", "WSOL");
    let marketAccounts;
    if (fromPumpfun)
        marketAccounts = await Market.findAccountsByMints(connection, quoteToken.mint, baseToken.mint, PROGRAMIDS.OPENBOOK_MARKET);
    else
        marketAccounts = await Market.findAccountsByMints(connection, baseToken.mint, quoteToken.mint, PROGRAMIDS.OPENBOOK_MARKET);

    const marketInfo = MARKET_STATE_LAYOUT_V3.decode(marketAccounts[0].accountInfo.data);
    let poolKeys = Liquidity.getAssociatedPoolKeys({
        version: 4,
        marketVersion: 4,
        baseMint: baseToken.mint,
        quoteMint: quoteToken.mint,
        baseDecimals: baseToken.decimals,
        quoteDecimals: quoteToken.decimals,
        marketId: marketAccounts[0].publicKey,
        programId: PROGRAMIDS.AmmV4,
        marketProgramId: PROGRAMIDS.OPENBOOK_MARKET,
    });
    poolKeys.marketBaseVault = marketInfo.baseVault;
    poolKeys.marketQuoteVault = marketInfo.quoteVault;
    poolKeys.marketBids = marketInfo.bids;
    poolKeys.marketAsks = marketInfo.asks;
    poolKeys.marketEventQueue = marketInfo.eventQueue;

    const poolInfo = poolKeys2JsonInfo(poolKeys);
    return poolInfo;
}

export async function estimateOutputAmout(connection, poolInfo, mode, rawAmountIn, fromPumpfun) {
    try {
        const poolKeys = jsonInfo2PoolKeys(poolInfo);

        let swapInDirection = false;
        if ((mode == "buy" && poolKeys.baseMint.toBase58() == NATIVE_MINT.toBase58()) || (mode == "sell" && poolKeys.quoteMint.toBase58() == NATIVE_MINT.toBase58()))
            swapInDirection = true;

        if (fromPumpfun) {
            swapInDirection = !swapInDirection
        }

        const new_poolInfo = await Liquidity.fetchInfo({ connection, poolKeys })

        let currencyInMint = poolKeys.baseMint
        let currencyInDecimals = new_poolInfo.baseDecimals
        let currencyOutMint = poolKeys.quoteMint
        let currencyOutDecimals = new_poolInfo.quoteDecimals

        if (!swapInDirection) {
            currencyInMint = poolKeys.quoteMint
            currencyInDecimals = new_poolInfo.quoteDecimals
            currencyOutMint = poolKeys.baseMint
            currencyOutDecimals = new_poolInfo.baseDecimals
        }

        const currencyIn = new Token(TOKEN_PROGRAM_ID, currencyInMint, currencyInDecimals)
        const amountIn = new TokenAmount(currencyIn, rawAmountIn, false)
        console.log(amountIn)
        const currencyOut = new Token(TOKEN_PROGRAM_ID, currencyOutMint, currencyOutDecimals)
        const slippage = new Percent(100, 100) // 5% slippage

        const { amountOut, minAmountOut, currentPrice, executionPrice, priceImpact, fee } = Liquidity.computeAmountOut({
            poolKeys,
            poolInfo: new_poolInfo,
            amountIn,
            currencyOut,
            slippage,
        })

        const amountOutRaw = amountOut.raw.toString();

        return amountOutRaw
    } catch (err) {
        return null
    }
}

export async function getLPBalance(raydium, connection, poolAddress, ownerPubkey) {
    if (!poolAddress) {
        console.log("Invalid base or quote token address");
        return 0;
    }

    try {
        const poolInfo = (await raydium.api.fetchPoolById({ ids: poolAddress }))[0];
        const lpMint = poolInfo.lpMint;
        const lpATA = await getAssociatedTokenAddress(new PublicKey(lpMint.address), ownerPubkey);
        const lpAccount = await getAccount(connection, lpATA);
        return (parseFloat(lpAccount.amount.toString()) / (10 ** lpMint.decimals)).toString()
    } catch (err) {
        console.log(err);
    }
    return 0;
}

export async function sendAndConfirmSignedTransactions(useJito, connection, transactions, signingData = null, sigData = null) {
    if (useJito) {
        try {
            const buffers = transactions.map((tx) => Buffer.from(tx.serialize()));
            const encodedTxns = buffers.map((buffer) => buffer.toString("base64"));
            const response = await axios.post(`${SERVER_URL}/api/v1/misc/send-bundle-trnasactions`,
                {
                    signedTransactions: encodedTxns,
                    signingData,
                    sigData
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "MW-USER-ID": localStorage.getItem("access-token"),
                    },
                }
            );

            if (response && response.status == 200) {
                console.log("Checking bundle's status...");
                const sentTime = Date.now();
                const txHash = response.data.signature;
                const commitment = "finalized";
                while (Date.now() - sentTime < 30000) {
                    try {
                        let success = true;
                        let ret = await connection.getTransaction(txHash, {
                            commitment: commitment,
                            maxSupportedTransactionVersion: 1,
                        });

                        console.log("checking... signature:", txHash)
                        console.log(ret)

                        if (ret && ret.meta && ret.meta.err == null) {
                            console.log("checked", txHash);
                        } else {
                            success = false;
                        }

                        if (success) {
                            console.log("Success sendBundleConfirmTxId");
                            return true;
                        }
                    } catch (err) {
                        console.log(err);
                    }

                    await sleep(1000);
                }
            }

            return false;
        }
        catch (err) {
            console.log(err);
            return false;
        }
    }
    else {
        let retries = 50;
        let passed = {};

        const rawTransactions = transactions.map(transaction => {
            return transaction.serialize();
        });

        while (retries > 0) {
            try {
                let pendings = {};
                for (let i = 0; i < rawTransactions.length; i++) {
                    if (!passed[i]) {
                        pendings[i] = connection.sendRawTransaction(rawTransactions[i], {
                            skipPreflight: true,
                            maxRetries: 1,
                        });
                    }
                }

                let signatures = {};
                for (let i = 0; i < rawTransactions.length; i++) {
                    if (!passed[i])
                        signatures[i] = await pendings[i];
                }

                const sentTime = Date.now();
                while (Date.now() - sentTime <= 1000) {
                    for (let i = 0; i < rawTransactions.length; i++) {
                        if (!passed[i]) {
                            const ret = await connection.getTransaction(signatures[i], {
                                commitment: "finalized",
                                maxSupportedTransactionVersion: 0,
                            });
                            if (ret && ret.meta && ret.meta.err == null) {

                                // console.log("Slot:", ret.slot);
                                // if (ret.transaction) {
                                //     console.log("Signatures:", ret.transaction.signatures);
                                //     console.log("Message:", ret.transaction.message);
                                // }
                                passed[i] = true;
                            }
                        }
                    }

                    let done = true;
                    for (let i = 0; i < rawTransactions.length; i++) {
                        if (!passed[i]) {
                            done = false;
                            break;
                        }
                    }

                    if (done)
                        return true;

                    await sleep(500);
                }
            }
            catch (err) {
                console.log(err);
            }
            retries--;
        }
    }

    return false;
}

async function getBondingCurve(tokenMint, programId) {
    const seedString = "bonding-curve";

    const [PDA, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from(seedString), tokenMint.toBuffer()],
        programId
    );

    return new PublicKey(PDA);
}

export async function getBondingCurveAddress(provider, tokenAddress) {
    try {
        const program = new anchor.Program(idl, programID, provider);
        const mint = new PublicKey(tokenAddress);
        const bondingCurve = await getBondingCurve(mint, program.programId);
        return bondingCurve.toBase58();
    } catch (err) {
        return ""
    }
}

export async function createToken(connection, ownerPubkey, name, symbol, uri, decimals, totalSupply, useSuffix, suffix, sigData, signingData) {
    // console.log("Creating token transaction...", name, symbol, decimals, totalSupply);
    const lamports = await getMinimumBalanceForRentExemptMint(connection);


    let secretKey = "";

    if (useSuffix && suffix === "pump") {
        try {
            const { data } = await axios.post(`${SERVER_URL}/api/v1/pumpfun/get_pump_key`,
                {
                    tokenUri: uri,
                    sigData,
                    signingData
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "MW-USER-ID": localStorage.getItem("access-token"),
                    },
                }
            );

            console.log(data);

            if (data.success === true) {
                secretKey = data.secretKey;
                console.log("Success to get pump keypair!\n", data.secretKey)
            }
            else
                console.log("Failed to get pump keypair!");
        }
        catch (err) {
            console.log(err)
            console.log("Failed to get pump keypair!");
        }
    }


    let mintKeypair;

    try {
        if (secretKey.toString().length === 0) {
            if (useSuffix) {
                while (true) {
                    const keypair = Keypair.generate();
                    if (keypair.publicKey.toBase58().endsWith(suffix)) {
                        mintKeypair = keypair;
                        console.log(keypair.publicKey.toBase58())
                        break;
                    }
                }
            } else {
                mintKeypair = Keypair.generate();
            }
        } else {
            mintKeypair = Keypair.fromSecretKey(bs58.decode(secretKey))
        }
    }
    catch (err) {
        mintKeypair = Keypair.generate()
    }

    console.log("----- new mint address: ", mintKeypair.publicKey.toBase58());

    const tokenATA = await getAssociatedTokenAddress(mintKeypair.publicKey, ownerPubkey);

    const [metadataPDA] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("metadata"),
            PROGRAM_ID.toBuffer(),
            mintKeypair.publicKey.toBuffer()
        ],
        PROGRAM_ID
    );
    // console.log("Metadata PDA:", metadataPDA.toBase58());

    const tokenMetadata = {
        name: name,
        symbol: symbol,
        uri: uri,
        sellerFeeBasisPoints: 0,
        creators: null,
        collection: null,
        uses: null,
    };

    const instructions = [
        SystemProgram.createAccount({
            fromPubkey: ownerPubkey,
            newAccountPubkey: mintKeypair.publicKey,
            space: MINT_SIZE,
            lamports: lamports,
            programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMintInstruction(
            mintKeypair.publicKey,
            decimals,
            ownerPubkey,
            null,
            TOKEN_PROGRAM_ID
        ),
        createAssociatedTokenAccountInstruction(
            ownerPubkey,
            tokenATA,
            ownerPubkey,
            mintKeypair.publicKey,
        ),
        createMintToInstruction(
            mintKeypair.publicKey,
            tokenATA,
            ownerPubkey,
            totalSupply * Math.pow(10, decimals),
        ),
        createCreateMetadataAccountV3Instruction(
            {
                metadata: metadataPDA,
                mint: mintKeypair.publicKey,
                mintAuthority: ownerPubkey,
                payer: ownerPubkey,
                updateAuthority: ownerPubkey,
            },
            {
                createMetadataAccountArgsV3: {
                    data: tokenMetadata,
                    isMutable: true,
                    collectionDetails: null,
                },
            }
        )
    ];
    const recentBlockhash = (await connection.getLatestBlockhash("finalized")).blockhash;
    const message = new TransactionMessage({
        payerKey: ownerPubkey,
        recentBlockhash,
        instructions,
    });
    const transaction = new VersionedTransaction(message.compileToV0Message(Object.values({ ...(addLookupTableInfo ?? {}) })));
    transaction.sign([mintKeypair]);

    return { mint: mintKeypair.publicKey, transaction: transaction };
}

export async function createFreezeToken(connection, ownerPubkey, name, symbol, uri, decimals, totalSupply, useSuffix, suffix, sigData, signingData) {
    // console.log("Creating token transaction...", name, symbol, decimals, totalSupply);
    const lamports = await getMinimumBalanceForRentExemptMint(connection);


    let secretKey = "";

    if (useSuffix && suffix === "pump") {
        try {
            const { data } = await axios.post(`${SERVER_URL}/api/v1/pumpfun/get_pump_key`,
                {
                    tokenUri: uri,
                    sigData,
                    signingData
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "MW-USER-ID": localStorage.getItem("access-token"),
                    },
                }
            );

            console.log(data);

            if (data.success === true) {
                secretKey = data.secretKey;
                console.log("Success to get pump keypair!\n", data.secretKey)
            }
            else
                console.log("Failed to get pump keypair!");
        }
        catch (err) {
            console.log(err)
            console.log("Failed to get pump keypair!");
        }
    }


    let mintKeypair;

    try {
        if (secretKey.toString().length === 0) {
            if (useSuffix) {
                while (true) {
                    const keypair = Keypair.generate();
                    if (keypair.publicKey.toBase58().endsWith(suffix)) {
                        mintKeypair = keypair;
                        console.log(keypair.publicKey.toBase58())
                        break;
                    }
                }
            } else {
                mintKeypair = Keypair.generate();
            }
        } else {
            mintKeypair = Keypair.fromSecretKey(bs58.decode(secretKey))
        }
    }
    catch (err) {
        mintKeypair = Keypair.generate()
    }

    console.log("----- new mint address: ", mintKeypair.publicKey);

    const tokenATA = await getAssociatedTokenAddress(mintKeypair.publicKey, ownerPubkey);

    const [metadataPDA] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("metadata"),
            PROGRAM_ID.toBuffer(),
            mintKeypair.publicKey.toBuffer()
        ],
        PROGRAM_ID
    );
    // console.log("Metadata PDA:", metadataPDA.toBase58());

    const tokenMetadata = {
        name: name,
        symbol: symbol,
        uri: uri,
        sellerFeeBasisPoints: 0,
        creators: null,
        collection: null,
        uses: null,
    };

    const instructions = [
        SystemProgram.createAccount({
            fromPubkey: ownerPubkey,
            newAccountPubkey: mintKeypair.publicKey,
            space: MINT_SIZE,
            lamports: lamports,
            programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMintInstruction(
            mintKeypair.publicKey,
            decimals,
            ownerPubkey,
            ownerPubkey,
            TOKEN_PROGRAM_ID
        ),
        createAssociatedTokenAccountInstruction(
            ownerPubkey,
            tokenATA,
            ownerPubkey,
            mintKeypair.publicKey,
        ),
        createMintToInstruction(
            mintKeypair.publicKey,
            tokenATA,
            ownerPubkey,
            totalSupply * Math.pow(10, decimals),
        ),
        createCreateMetadataAccountV3Instruction(
            {
                metadata: metadataPDA,
                mint: mintKeypair.publicKey,
                mintAuthority: ownerPubkey,
                payer: ownerPubkey,
                updateAuthority: ownerPubkey,
            },
            {
                createMetadataAccountArgsV3: {
                    data: tokenMetadata,
                    isMutable: false,
                    collectionDetails: null,
                },
            }
        )
    ];
    const recentBlockhash = (await connection.getLatestBlockhash("finalized")).blockhash;
    const message = new TransactionMessage({
        payerKey: ownerPubkey,
        recentBlockhash,
        instructions,
    });
    const transaction = new VersionedTransaction(message.compileToV0Message(Object.values({ ...(addLookupTableInfo ?? {}) })));
    transaction.sign([mintKeypair]);

    return { mint: mintKeypair.publicKey, transaction: transaction };
}

export async function createFreezeToken2022(connection, ownerPubkey, name, symbol, uri, decimals, totalSupply, feeRate, useSuffix, suffix, sigData, signingData) {
    // console.log("Creating token transaction...", name, symbol, decimals, totalSupply);
    let secretKey = "";

    if (useSuffix && suffix === "pump") {
        try {
            const { data } = await axios.post(`${SERVER_URL}/api/v1/pumpfun/get_pump_key`,
                {
                    tokenUri: uri,
                    sigData,
                    signingData
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "MW-USER-ID": localStorage.getItem("access-token"),
                    },
                }
            );

            console.log(data);

            if (data.success === true) {
                secretKey = data.secretKey;
                console.log("Success to get pump keypair!\n", data.secretKey)
            }
            else
                console.log("Failed to get pump keypair!");
        }
        catch (err) {
            console.log(err)
            console.log("Failed to get pump keypair!");
        }
    }


    let mintKeypair;

    try {
        if (secretKey.toString().length === 0) {
            if (useSuffix) {
                while (true) {
                    const keypair = Keypair.generate();
                    if (keypair.publicKey.toBase58().endsWith(suffix)) {
                        mintKeypair = keypair;
                        console.log(keypair.publicKey.toBase58())
                        break;
                    }
                }
            } else {
                mintKeypair = Keypair.generate();
            }
        } else {
            mintKeypair = Keypair.fromSecretKey(bs58.decode(secretKey))
        }
    }
    catch (err) {
        mintKeypair = Keypair.generate()
    }

    const authority = Keypair.generate();
    const transferFeeConfigAuthority = authority.publicKey;
    const withdrawWithheldAuthority = authority.publicKey;

    const extensions = [ExtensionType.TransferFeeConfig, ExtensionType.MetadataPointer];
    const mintLen = getMintLen(extensions);
    const feeBasisPoints = Number(feeRate) * 100;
    const maxFee = BigInt(Number(totalSupply) * (10 ** Number(decimals)));

    const tokenATA = await getAssociatedTokenAddress(mintKeypair.publicKey, ownerPubkey, undefined, TOKEN_2022_PROGRAM_ID);

    const metadata = {
        mint: mintKeypair.publicKey,
        name: name,
        symbol: symbol,
        uri: uri,
        additionalMetadata: []
    }

    const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;

    const mintLamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);

    console.log("----- new mint address: ", mintKeypair.publicKey);

    const instructions = [
        SystemProgram.createAccount({
            fromPubkey: ownerPubkey,
            newAccountPubkey: mintKeypair.publicKey,
            space: mintLen,
            lamports: mintLamports,
            programId: TOKEN_2022_PROGRAM_ID,
        }),
        // "Transfer",
        // "Unknown",
        createInitializeTransferFeeConfigInstruction(
            mintKeypair.publicKey,
            transferFeeConfigAuthority,
            withdrawWithheldAuthority,
            feeBasisPoints,
            maxFee,
            TOKEN_2022_PROGRAM_ID
        ),
        createInitializeMetadataPointerInstruction(
            mintKeypair.publicKey,
            ownerPubkey,
            mintKeypair.publicKey,
            TOKEN_2022_PROGRAM_ID
        ),
        createInitializeMintInstruction(
            mintKeypair.publicKey,
            decimals,
            ownerPubkey,
            ownerPubkey,
            TOKEN_2022_PROGRAM_ID
        ),
        createInitializeInstruction({
            programId: TOKEN_2022_PROGRAM_ID,
            mint: mintKeypair.publicKey,
            metadata: mintKeypair.publicKey,
            name: metadata.name,
            symbol: metadata.symbol,
            uri: metadata.uri,
            mintAuthority: ownerPubkey,
            updateAuthority: ownerPubkey,
        }),
        createAssociatedTokenAccountInstruction(
            ownerPubkey,
            tokenATA,
            ownerPubkey,
            mintKeypair.publicKey,
            TOKEN_2022_PROGRAM_ID,
        ),
        createMintToInstruction(
            mintKeypair.publicKey,
            tokenATA,
            ownerPubkey,
            Number(totalSupply) * Math.pow(10, Number(decimals)),
            undefined,
            TOKEN_2022_PROGRAM_ID
        ),
    ];
    const recentBlockhash = (await connection.getLatestBlockhash("finalized")).blockhash;
    const message = new TransactionMessage({
        payerKey: ownerPubkey,
        recentBlockhash,
        instructions,
    });
    const transaction = new VersionedTransaction(message.compileToV0Message(Object.values({ ...(addLookupTableInfo ?? {}) })));
    transaction.sign([mintKeypair]);

    return { mint: mintKeypair.publicKey, transaction: transaction, authority: bs58.encode(authority.secretKey) };
}

export async function setMintAuthority(connection, mintAddress, ownerPubkey, newAuthority, tokenProgramId = undefined) {
    const mint = new PublicKey(mintAddress);

    const transaction = new Transaction().add(
        createSetAuthorityInstruction(
            mint,
            ownerPubkey,
            AuthorityType.MintTokens,
            newAuthority ? new PublicKey(newAuthority) : null,
            undefined,
            tokenProgramId ? tokenProgramId : TOKEN_PROGRAM_ID
        )
    );
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = ownerPubkey;

    return transaction;
}

export async function setFreezeAuthority(connection, mintAddress, ownerPubkey, newAuthority, tokenProgramId = undefined) {
    const mint = new PublicKey(mintAddress);

    const transaction = new Transaction().add(
        createSetAuthorityInstruction(
            mint,
            ownerPubkey,
            AuthorityType.FreezeAccount,
            newAuthority ? new PublicKey(newAuthority) : null,
            [],
            tokenProgramId ? tokenProgramId : TOKEN_PROGRAM_ID
        )
    );
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = ownerPubkey;

    return transaction;
}

export async function makeFreezeAccountTransaction(connection, mintAddress, ownerPubkey, ata, tokenProgramId = undefined) {
    const mint = new PublicKey(mintAddress);

    const transaction = new Transaction().add(
        createFreezeAccountInstruction(
            new PublicKey(ata),
            mint,
            ownerPubkey,
            [],
            tokenProgramId ? tokenProgramId : TOKEN_PROGRAM_ID
        )
    );
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = ownerPubkey;

    return transaction;
}

export async function closeTokenAccount(connection, mintAddress, ownerPubkey) {
    const mint = new PublicKey(mintAddress);
    const mintAccountInfo = await connection.getAccountInfo(mint);
    const tokenProgramId = mintAccountInfo.owner;
    const tokenATA = await getAssociatedTokenAddress(mint, ownerPubkey, false, tokenProgramId);
    const tx = new Transaction().add(
        createCloseAccountInstruction(tokenATA, ownerPubkey, ownerPubkey, [], tokenProgramId)
    );
    tx.feePayer = ownerPubkey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    return tx;
}

export async function burnTokenByPercent(connection, mintAddress, percent, ownerPubkey) {
    const mint = new PublicKey(mintAddress);
    const mintAccountInfo = await connection.getAccountInfo(mint);
    const tokenProgramId = mintAccountInfo.owner;
    const tokenATA = await getAssociatedTokenAddress(mint, ownerPubkey, false, tokenProgramId);
    const tokenAccount = await getAccount(connection, tokenATA, "confirmed", tokenProgramId);
    const bnAmount = new BigNumber(tokenAccount.amount.toString()).multipliedBy(new BigNumber(percent.toString())).dividedBy(new BigNumber("100"));
    const tx = new Transaction().add(
        createBurnInstruction(tokenAccount.address, mint, ownerPubkey, bnAmount.toFixed(0), [], tokenProgramId)
    );
    tx.feePayer = ownerPubkey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    return tx;
}

export async function checkAuthority(connection, mintAddress, tokenProgramId = undefined) {
    const mint = new PublicKey(mintAddress);
    const mintInfo = await getMint(connection, mint, undefined, tokenProgramId ? tokenProgramId : TOKEN_PROGRAM_ID)
    const mintAuthorityRevoked = mintInfo.mintAuthority === null;
    const freezeAuthorityRevoked = mintInfo.freezeAuthority === null;
    return { mintAuthorityRevoked, freezeAuthorityRevoked }
}

export async function checkOpenBookMarket(connection, baseMintAddress, quoteMintAddress) {
    console.log("Checking OpenBook Market...", baseMintAddress, PROGRAMIDS.OPENBOOK_MARKET.toBase58());

    const baseMint = new PublicKey(baseMintAddress);

    const quoteMint = new PublicKey(quoteMintAddress);

    const marketAccounts = await Market.findAccountsByMints(connection, baseMint, quoteMint, PROGRAMIDS.OPENBOOK_MARKET);
    if (marketAccounts.length > 0) {
        console.log("Already created OpenBook market!");
        return { marketId: marketAccounts[0].publicKey.toBase58() };
    } else {
        return { marketId: null };
    }
}

export async function createOpenBookMarket(connection, baseMintAddress, quoteMintAddress, lotSize, tickSize, ownerPubkey) {
    console.log("Creating OpenBook Market...", baseMintAddress, lotSize, tickSize, PROGRAMIDS.OPENBOOK_MARKET.toBase58());

    const baseMint = new PublicKey(baseMintAddress);
    const baseMintInfo = await getMint(connection, baseMint);

    const quoteMint = new PublicKey(quoteMintAddress);
    const quoteMintInfo = await getMint(connection, quoteMint);

    const marketAccounts = await Market.findAccountsByMints(connection, baseMint, quoteMint, PROGRAMIDS.OPENBOOK_MARKET);
    if (marketAccounts.length > 0) {
        console.log("Already created OpenBook market!");
        return { marketId: marketAccounts[0].publicKey };
    }

    const baseToken = new Token(TOKEN_PROGRAM_ID, baseMint, baseMintInfo.decimals);
    const quoteToken = new Token(TOKEN_PROGRAM_ID, quoteMint, quoteMintInfo.decimals);

    // -------- step 1: make instructions --------
    const { innerTransactions, address } = await makeCreateMarketInstruction({
        connection,
        owner: ownerPubkey,
        baseInfo: baseToken,
        quoteInfo: quoteToken,
        lotSize: lotSize,
        tickSize: tickSize,
        dexProgramId: PROGRAMIDS.OPENBOOK_MARKET,
        makeTxVersion: TxVersion.V0,
    });

    const transactions = await buildSimpleTransaction({
        connection,
        makeTxVersion: TxVersion.V0,
        payer: ownerPubkey,
        innerTransactions,
        addLookupTableInfo
    });

    return { marketId: address.marketId, transactions };
}

export async function createPool(connection, baseMintAddress, baseMintAmount, quoteMintAddress, quoteMintAmount, marketId, ownerPubkey) {
    const baseMint = new PublicKey(baseMintAddress);
    const baseMintInfo = await getMint(connection, baseMint);

    const quoteMint = new PublicKey(quoteMintAddress);
    const quoteMintInfo = await getMint(connection, quoteMint);

    const baseToken = new Token(TOKEN_PROGRAM_ID, baseMint, baseMintInfo.decimals);
    const quoteToken = new Token(TOKEN_PROGRAM_ID, quoteMint, quoteMintInfo.decimals);

    const baseAmount = new BN(new BigNumber(baseMintAmount.toString() + "e" + baseMintInfo.decimals.toString()).toFixed(0));
    const quoteAmount = new BN(new BigNumber(quoteMintAmount.toString() + "e" + quoteMintInfo.decimals.toString()).toFixed(0));
    const walletTokenAccounts = await getWalletTokenAccount(connection, ownerPubkey);
    const startTime = Math.floor(Date.now() / 1000);

    const { innerTransactions } = await Liquidity.makeCreatePoolV4InstructionV2Simple({
        connection,
        programId: PROGRAMIDS.AmmV4,
        marketInfo: {
            marketId: new PublicKey(marketId),
            programId: PROGRAMIDS.OPENBOOK_MARKET,
        },
        baseMintInfo: baseToken,
        quoteMintInfo: quoteToken,
        baseAmount: baseAmount,
        quoteAmount: quoteAmount,
        startTime: new BN(startTime),
        ownerInfo: {
            feePayer: ownerPubkey,
            wallet: ownerPubkey,
            tokenAccounts: walletTokenAccounts,
            useSOLBalance: true,
        },
        associatedOnly: false,
        checkCreateATAOwner: true,
        makeTxVersion: TxVersion.V0,
        feeDestinationId: (process.env.REACT_APP_DEVNET_MODE === "true") ? new PublicKey("3XMrhbv989VxAMi3DErLV9eJht1pHppW5LbKxe9fkEFR") : new PublicKey('7YttLkHDoNj9wyDur5pM1ejNaAvT9X4eqaYcHQqtj2G5'),
    });

    let newInnerTransactions = [...innerTransactions];
    if (newInnerTransactions.length > 0) {
        const p = newInnerTransactions.length - 1;

        newInnerTransactions[p].instructionTypes = [
            50,
            ...newInnerTransactions[p].instructionTypes,
        ];
        newInnerTransactions[p].instructions = [
            CreateTraderAPITipInstruction(ownerPubkey, 0.001 * LAMPORTS_PER_SOL),
            ...newInnerTransactions[p].instructions,
        ];
    }

    const transactions = await buildSimpleTransaction({
        connection,
        makeTxVersion: TxVersion.V0,
        payer: ownerPubkey,
        innerTransactions: newInnerTransactions,
    });

    return transactions;
}

export async function removeLiquidityByPercent(raydium, connection, poolAddress, percent, ownerPubkey) {

    try {
        const poolInfo = (await raydium.api.fetchPoolById({ ids: poolAddress }))[0];
        console.log(poolInfo)

        const lpMint = poolInfo.lpMint;

        const lpATA = await getAssociatedTokenAddress(new PublicKey(lpMint.address), ownerPubkey);
        const lpAccount = await getAccount(connection, lpATA);
        const bnAmount = new BN(lpAccount.amount.toString()).muln(Number(percent.toString())).divn(100);

        const { transaction } = poolInfo.programId == RAYDIUMPOOL_V4_ADDRESS ?
            await raydium.liquidity.removeLiquidity({
                poolInfo,
                lpAmount: bnAmount,
                baseAmountMin: new BN(0),
                quoteAmountMin: new BN(0),
                txVersion: TxVersion.V0
            })
            : poolInfo.programId == CREATE_CPMM_POOL_PROGRAM ?
                await raydium.cpmm.withdrawLiquidity({
                    poolInfo,
                    lpAmount: bnAmount,
                    slippage: new Percent(10, 100),
                    txVersion: TxVersion.V0
                }) : { transaction: null }

        return [transaction];
    } catch (err) {
        console.log(err);
    }

    return null;
}

export async function burnLPByPercent(raydium, connection, baseMintAddress, quoteMintAddress, percent, ownerPubkey, tokenProgramId = undefined) {
    try {
        const { data: pairdatas } = await axios.get(
            `https://api.dexscreener.com/token-pairs/v1/solana/${baseMintAddress}`,
            {
                headers: { "Content-Type": "application/json" },
            }
        );
        let pairAddress = "";
        if (pairdatas && pairdatas.length > 0) {
            for (let i = 0; i < pairdatas.length; i++) {
                if (pairdatas[i].quoteToken.address == NATIVE_MINT.toBase58()) {
                    pairAddress = pairdatas[i].pairAddress;
                    break;
                }
            }
        }
        if (pairAddress == "") {
            return 0;
        }
        const poolData = TOKEN_PROGRAM_ID.equals(tokenProgramId) ? await raydium.liquidity.getPoolInfoFromRpc({ poolId: pairAddress }) :
            await raydium.cpmm.getPoolInfoFromRpc(pairAddress);
        const poolInfo = poolData.poolInfo;

        const lpMint = poolInfo.lpMint;

        const lpATA = await getAssociatedTokenAddress(new PublicKey(lpMint.address), ownerPubkey);
        const lpAccount = await getAccount(connection, lpATA);
        const bnAmount = new BigNumber(lpAccount.amount.toString()).multipliedBy(new BigNumber(percent.toString())).dividedBy(new BigNumber("100"));
        const tx = new Transaction().add(
            createBurnInstruction(lpAccount.address, new PublicKey(lpMint.address), ownerPubkey, bnAmount.toFixed(0))
        );
        tx.feePayer = ownerPubkey;
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

        return tx;
    }
    catch (err) {
        console.log(err);
    }

    return null;
}

export const isOnRaydium = async (token) => {
    try {
        const url = `https://api.dexscreener.io/latest/dex/tokens/${token}`;
        const result = await axios.get(url, {
            headers: { "Content-Type": "application/json" },
        });

        if (result?.data?.pairs)
            return true;

    } catch (err) {
        console.log(err)
    }

    return false;
}

export const isFromPumpfun = async (connection, token) => {
    const mintAddress = new PublicKey(token);
    const mintInfo = await getMint(connection, mintAddress);
    const [metadataPDA] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("metadata"),
            PROGRAM_ID.toBuffer(),
            mintAddress.toBuffer()
        ],
        PROGRAM_ID
    )

    try {
        const metadata = await Metadata.fromAccountAddress(connection, metadataPDA);
        const updateAuthority = metadata.updateAuthority.toBase58();
        if (updateAuthority == PUMPFUN_UPDATE_AUTHORITY) {
            return true;
        }
    } catch (err) {
        console.log(err);
    }

    return false;
}