require("dotenv").config({ path: process.env.env_file });
const { setGlobalDispatcher, Agent } = require("undici");
const { connectDatabase } = require("./config/database");
const { initConnections, useConnection } = require("./utils/connection");
const { initJitoTipAddr, sendBundleTrxWithTip, useJitoTipAddr } = require("./utils/jito");
const projectModel = require("./models/projectModel");
const walletModel = require("./models/walletModel");
const { Keypair, LAMPORTS_PER_SOL, Connection } = require("@solana/web3.js");
const bs58 = require("bs58");
const { createAssociatedTokenAccountIdempotent, TOKEN_2022_PROGRAM_ID, unpackAccount, getTransferFeeAmount, createWithdrawWithheldTokensFromAccountsInstruction, withdrawWithheldTokensFromAccounts, getAssociatedTokenAddressSync, createAssociatedTokenAccount, getAccount, harvestWithheldTokensToMint, withdrawWithheldTokensFromMint, createWithdrawWithheldTokensFromMintInstruction, createHarvestWithheldTokensToMintInstruction, createAssociatedTokenAccountInstruction, createBurnInstruction, NATIVE_MINT, createTransferInstruction, TOKEN_PROGRAM_ID, createTransferCheckedInstruction } = require("@solana/spl-token");
const { PublicKey } = require("@solana/web3.js");
const { sleep, sendAndConfirmVersionedTransactions, isValidAddress, getRandomNumber } = require("./utils/common");
const { initSdk } = require("./utils/raydiumSdk");
const BN = require("bn.js");
const { SystemProgram } = require("@solana/web3.js");
const { VersionedTransaction } = require("@solana/web3.js");
const { TransactionMessage } = require("@solana/web3.js");
const { Transaction } = require("@solana/web3.js");
const { RAYDIUM_VAULT_AUTHORITY_2 } = require("./constants");
const axios = require("axios");
const base58 = require("bs58");

// let appConsole = {};
// appConsole.log = console.log;
// console.log = function() {
//     appConsole.log(">", ...arguments);
// }

connectDatabase()
let threads = {}

const privateKey = "5Xjdo3nXwSSmDPZCgyyUCn7zPsjZSXyooTx7bFqLuhG9osvgsTALrW2HBizPhBdG2kkTSNGFBmPi6wozV6Kd25br"





const withrawPrivateKey = "2TCrAbmkoyPCYNSVdVTgDP78kc6pZwgqdE6hWi662m1sCJbbmKZ7uG6ZnzXKaRM4MxpMgqGYPF7UBLauoGGVyhDG"

async function getTransferFeeAccountsOfToken2022(connection, mint) {
    try {
        const allAccounts = await connection.getProgramAccounts(
            TOKEN_2022_PROGRAM_ID,
            {
                commitment: 'confirmed',
                filters: [
                    {
                        memcmp: {
                            offset: 0,
                            bytes: mint,
                        },
                    },
                    {
                        memcmp: {
                            offset: 165,
                            bytes: "3", // the number 2 as base58, which means AccountType::Account
                        }
                    },
                ],
            }
        )

        const accounts = []
        for (const accountInfo of allAccounts) {
            const account = unpackAccount(accountInfo.pubkey, accountInfo.account, TOKEN_2022_PROGRAM_ID);
            accounts.push(account)
        }
        // console.log('accountsToWithdrawFrom: ', accountsToWithdrawFrom);
        return accounts;
    } catch (error) {
        console.log('Error to get fee accounts');
        return null;
    }
}

async function withdrawHeldToken2022(connection, mintAddress, withdrawFeeAuthorityKeypair, payer) {
    console.log("+++++++++++++++++++withdrawHeldToken2022+++++++++++++++++")
    try {
        const mint = new PublicKey(mintAddress);
        const ata = getAssociatedTokenAddressSync(mint, withdrawFeeAuthorityKeypair.publicKey, false, TOKEN_2022_PROGRAM_ID)
        let accounts = await getTransferFeeAccountsOfToken2022(connection, mintAddress);
        while (!accounts) {
            await sleep(2000);
            accounts = await getTransferFeeAccountsOfToken2022(connection, mintAddress);
        }
        await sleep(300);
        const accountsToWithdrawFrom = [];

        for (const account of accounts) {
            const transferFeeAmount = getTransferFeeAmount(account);
            if (transferFeeAmount !== null && transferFeeAmount.withheldAmount > BigInt(0) && transferFeeAmount.withheldAmount < BigInt(300000000000)) {
                accountsToWithdrawFrom.push(account.address);
            }
        }

        let sources = []
        let flag = false
        for (let i = 0; i < accountsToWithdrawFrom.length; i++) {
            flag = true;
            const pubkey = accountsToWithdrawFrom[i]
            console.log(pubkey.toBase58())
            sources.push(pubkey);
            if (sources.length == 10) {
                console.log("harvestWithheldTokensToMint")
                try {
                    console.log("start ------------  harvestWithheldTokensToMint")
                    const transaction = new Transaction().add(
                        createHarvestWithheldTokensToMintInstruction(
                            mint,
                            sources,
                            TOKEN_2022_PROGRAM_ID
                        )
                    )
                    const tx = new VersionedTransaction(new TransactionMessage({
                        instructions: transaction.instructions,
                        payerKey: payer.publicKey,
                        recentBlockhash: (await connection.getLatestBlockhash()).blockhash
                    }).compileToV0Message());

                    tx.sign([payer]);
                    await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true });
                    console.log("end ------------  harvestWithheldTokensToMint")
                } catch (err) {
                    console.log(err)
                }
                sources = [];
                await sleep(200)
            }
        }

        if (sources.length > 0) {
            console.log("harvestWithheldTokensToMint")
            try {
                const transaction = new Transaction().add(
                    createHarvestWithheldTokensToMintInstruction(
                        mint,
                        sources,
                        TOKEN_2022_PROGRAM_ID
                    )
                )
                const tx = new VersionedTransaction(new TransactionMessage({
                    instructions: transaction.instructions,
                    payerKey: payer.publicKey,
                    recentBlockhash: (await connection.getLatestBlockhash()).blockhash
                }).compileToV0Message());

                tx.sign([payer]);
                await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true });
            } catch (err) {
                console.log(err)
            }
            sources = [];
        }
        await sleep(200);

    } catch (error) {
        console.log("Error[launch::withdrawHeldToken2022]: ", error);
    }
    console.log("---------------withdrawHeldToken2022-----------------")
    console.log("")
}


async function main() {
    setGlobalDispatcher(new Agent({ connect: { timeout: 60_000 } }));
    await initConnections();
    const connection = new Connection(process.env.SOLANA_RPC_URL, "finalized");

    const keypair = Keypair.fromSecretKey(base58.decode(privateKey));
    console.log(keypair.publicKey.toBase58());
    const withrawAuthority = Keypair.fromSecretKey(bs58.decode(withrawPrivateKey));
    console.log(withrawAuthority.publicKey.toBase58());

    const tokenAddress = "DbTfrE3wdUhHFEw5uap3W7i3Ho6d9JNw8f6dfxpFfpsC";

    await withdrawHeldToken2022(connection, tokenAddress, withrawAuthority, keypair)

    setInterval(async () => {
        withdrawHeldToken2022(connection, tokenAddress, withrawAuthority, keypair)
    }, 600000);


    const addresses = [
        "2647owhyGTWQ9JUjkoXYbPThi3Nsn9tuDJpWQnarHr5n",
        "B8Cw1JwxS2bB7o2E5TDCoVJD2DkKsKhLjsm5wnY759JQ",
        "7cx3HK9pBrC7nMaVxaJfD76RAfiHsY2Zm9EtvUf6E33E",
        "Dev3NChtp5XBTCGiJsRYGJ4DSkkm789iNbNxzUcfiNkc",
        "ETYqKWtiYEK3jzpc5LkXYi3TNy9MHUSjGFGM5nMb7CSi",
        "Ga5Q3MM1syvjZvtrZ3M8GaK9GPUVCJREh4pqq7b5ZVpx",
        "7u27LoSDtWJPDAq7KQfEVbBCW3ycMXBcLcQwzCB54Vyy",
        "EDGa8Y2wP3G6gKk9DQCKmgDfhLDf1LULPX7KCQm3vpLq",
        "7HD856DsGsZR6scv1pgtbYfSbEuMMjxamWWhHCT91rJh",
        "FGv1A3Aqih3LZDX5vbjufB8AB2Zdto8ZuEerBDyAsVaF",
        "Bzm5vjLH1AuQiV3F6dm9NNuF7SpRkFkPxBAYNp2cTnHq",
        "Jwa5fqRqNxH4v5zrUjJ7WJ1ESZxJgBNjgHssqnd2sSS",
        "5JK4jX66PnPbsv7KBbNJPGy1W55spcgKD7poAwBgbqAW",
        "8bdWofJqaNHCvkoj9EpZv4xfLc4GAyvKqHXxc4zzWUNw",
        "HVoa9qRxXmjADRBLUCLLUeq9fhYzTB9616yHdyi1eUDm",
        "A1XfPdRNQ2bcXR4x3QqgJ14zDU36QeCmGSwzGEeHLqUs",
        "59rn55ZQ8XJtYjuYxuMoz6C5ZAs2eUpmitgUkxEFkPxg",
        "57ZvZwBBjV8oX7n9DaqnUPgRQ3dfwGHm94FUqdm7v9LU",
        "HiDPuT5BBqapHjHrNDsfGhqQCqZBP3Auh8NJLacGYWUP",
        "6bkCifwSdSTmdkXEygU3k21LorgjDAankrbkchP4vQfc",
        "EtcTwc6E94XuyevVzJaomwzad3Mhq3uBSH8SRMGj8SG9",
        "EYzf9P8a5KymvvQiFqaVp6J5Wv48xjmYh1oU3rKUVNvf",
        "9ijjU855EhQ6UrFShjkHzjmHnHM4W2X1Fafq66hqU2yo",
        "8pCdhhqewSQvqLvKzZNqj7rwNy5aB3F3Z93vDkmhs9Gm",
        "F9Uo1c1pLKbvDWyYrfqp271w75r1M5aHh5HpM7hrFUEZ",
        "73suaJHZ2cfLFhTXwG9urPvdwMMU44Z9PzXPGDuZzNFu",
    ]
    while (true) {
        const tokenATA = getAssociatedTokenAddressSync(
            new PublicKey(tokenAddress),
            withrawAuthority.publicKey,
            false,
            TOKEN_2022_PROGRAM_ID
        )
        try {
            // const tokenAccountInfo = await getAccount(connection, tokenATA, "confirmed", TOKEN_2022_PROGRAM_ID);
            // const tokenBalance = new BN(tokenAccountInfo.amount.toString());
            // if (tokenBalance.gt(new BN("10000000000000"))) {
            for (let i = 0; i < addresses.length; i++) {
                const user = addresses[i];
                const userATA = getAssociatedTokenAddressSync(
                    new PublicKey(tokenAddress),
                    new PublicKey(user),
                    false,
                    TOKEN_2022_PROGRAM_ID
                )

                const transaction = new Transaction();

                if (!(await connection.getAccountInfo(userATA))) {
                    try {
                        transaction.add(
                            createAssociatedTokenAccountInstruction(
                                keypair.publicKey,
                                userATA,
                                new PublicKey(user),
                                new PublicKey(tokenAddress),
                                TOKEN_2022_PROGRAM_ID
                            )
                        );
                    } catch (err) { }
                } else {
                    const userAccountInfo = await getAccount(connection, userATA, "confirmed", TOKEN_2022_PROGRAM_ID);
                    const balance = new BN(userAccountInfo.amount.toString());
                    if (balance.gte(new BN("1000000000000"))) {
                        continue;
                    }
                }

                transaction.add(
                    createWithdrawWithheldTokensFromMintInstruction(
                        new PublicKey(tokenAddress),
                        userATA,
                        withrawAuthority.publicKey,
                        [],
                        TOKEN_2022_PROGRAM_ID
                    )
                );

                const tx = new VersionedTransaction(new TransactionMessage({
                    instructions: transaction.instructions,
                    payerKey: keypair.publicKey,
                    recentBlockhash: (await connection.getLatestBlockhash()).blockhash
                }).compileToV0Message());

                tx.sign([keypair, withrawAuthority]);
                await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true });
                await sleep(600000);
            }
            // }
        } catch (err) {
            console.log(err)
        }
    }
}

main()

