import { useContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { BN } from "bn.js";
import {
    PublicKey,
} from "@solana/web3.js";
import {
    getMint,
    getAccount,
    getAssociatedTokenAddress,
} from "@solana/spl-token";

import { AppContext } from "../../App";
import { USE_JITO, burnTokenByPercent, closeTokenAccount, sendAndConfirmSignedTransactions, getTipTransaction } from "../../utils/solana";
import { isValidAddress } from "../../utils/methods";
import { ExtendedButton, GradientButton } from "../Buttons/Buttons";

export default function TokenAccount({ className }) {
    const {
        SERVER_URL,
        user,
        setLoadingPrompt,
        setOpenLoading,
        signingData,
        sigData
    } = useContext(AppContext);
    const { connected, publicKey, signAllTransactions } = useWallet();
    const { connection } = useConnection();

    const [pageIndex, setPageIndex] = useState(0);

    const [burnTokenAddress, setBurnTokenAddress] = useState("");
    const [burnTokenBalance, setBurnTokenBalance] = useState("0");
    const [burnTokenPercent, setBurnTokenPercent] = useState("");
    const [closeTokenAddress, setCloseTokenAddress] = useState("");

    const updateBalance = async (connection, tokenAddress, owner) => {
        console.log("Updating balance...", tokenAddress, owner.toBase58());
        try {
            const mint = new PublicKey(tokenAddress);
            const mintAccountInfo = await connection.getAccountInfo(mint);
            const tokenProgramId = mintAccountInfo.owner;
            const mintInfo = await getMint(connection, mint, "confirmed", tokenProgramId);
            const tokenATA = await getAssociatedTokenAddress(mint, owner, false, tokenProgramId);
            const accountInfo = await getAccount(connection, tokenATA, "confirmed", tokenProgramId);
            const balance = new BN(accountInfo.amount).div(new BN(Math.pow(10, mintInfo.decimals))).toString();
            return balance;
        }
        catch (err) {
            console.log(err);
            return "0";
        }
    };

    useEffect(() => {
        if (connected && isValidAddress(burnTokenAddress)) {
            updateBalance(connection, burnTokenAddress, publicKey).then(response => {
                setBurnTokenBalance(response);
            });
        }
        else
            setBurnTokenBalance("0");
    }, [connected, connection, publicKey, burnTokenAddress]);

    const handleBurnToken = async () => {
        if (!connected) {
            toast.warn("Please connect wallet!");
            return;
        }

        if (!isValidAddress(burnTokenAddress)) {
            toast.warn("Invalid token address!");
            return;
        }

        const percent = parseFloat(burnTokenPercent);
        if (isNaN(percent) || percent <= 0 || percent > 100) {
            toast.warn("Invalid percent value!");
            return;
        }

        setLoadingPrompt("Burning token...");
        setOpenLoading(true);
        try {
            const transaction = await burnTokenByPercent(connection, burnTokenAddress, percent, publicKey);
            let txns = [transaction];
            if (USE_JITO) {
                const tipTxn = await getTipTransaction(connection, publicKey, user.presets.jitoTip);
                txns.push(tipTxn);
            }
            const signedTxns = await signAllTransactions(txns);
            const res = await sendAndConfirmSignedTransactions(USE_JITO, connection, signedTxns, signingData, sigData);
            if (res) {
                const balance = await updateBalance(connection, burnTokenAddress, publicKey);
                setBurnTokenBalance(balance);
                toast.success("Succeed to burn token!");
            }
            else
                toast.warn("Failed to burn token!");
        }
        catch (err) {
            console.log(err);
            toast.warn("Failed to burn token!");
        }
        setOpenLoading(false);
    };

    const handleCloseTokenAccount = async () => {
        if (!connected) {
            toast.warn("Please connect wallet!");
            return;
        }

        if (!isValidAddress(closeTokenAddress)) {
            toast.warn("Invalid token address!");
            return;
        }

        setLoadingPrompt("Closing token account...");
        setOpenLoading(true);
        try {
            const balance = await updateBalance(connection, closeTokenAddress, publicKey);
            if (balance !== "0") {
                toast.warn("Balance of token must be 0!");
                setOpenLoading(false);
                return;
            }

            const transaction = await closeTokenAccount(connection, closeTokenAddress, publicKey);
            let txns = [transaction];
            if (USE_JITO) {
                const tipTxn = await getTipTransaction(connection, publicKey, user.presets.jitoTip);
                txns.push(tipTxn);
            }
            const signedTxns = await signAllTransactions(txns);
            const res = await sendAndConfirmSignedTransactions(USE_JITO, connection, signedTxns, signingData, sigData);
            if (res)
                toast.success("Succeed to close token account!");
            else
                toast.warn("Failed to close token account!");
        }
        catch (err) {
            console.log(err);
            toast.warn("Failed to close token account!");
        }
        setOpenLoading(false);
    };

    return (
        <div className={`${className} flex flex-col text-white gap-3 m-auto`}>
            <div className="w-full mb-10">
                <div className="flex flex-col gap-4">
                    <div className="">
                        <div className="text-white text-left">
                            Token Address<span className="pl-1 text-green-normal">*</span>
                        </div>
                        <input
                            className="outline-none rounded-lg text-orange border border-gray-blue placeholder:text-gray-border px-2.5 bg-light-black w-full h-10 mt-1"
                            placeholder="Enter token address"
                            value={burnTokenAddress}
                            onChange={(e) => setBurnTokenAddress(e.target.value)}
                        />
                    </div>
                    <div className="">
                        <div className="flex justify-between">
                            <div className="text-white text-left">
                                % to burn token
                            </div>
                            <p className="text-right text-orange">Balance: {burnTokenBalance}</p>
                        </div>
                        <input
                            className="outline-none rounded-lg text-orange border border-gray-blue placeholder:text-gray-border px-2.5 bg-light-black w-full h-10 mt-1"
                            placeholder="Enter % amount to burn token"
                            value={burnTokenPercent}
                            onChange={(e) => setBurnTokenPercent(e.target.value)}
                        />
                    </div>
                    <input
                        id="steps-range"
                        type="range"
                        min="0"
                        max="100"
                        value={Number(burnTokenPercent)}
                        onChange={(e) => setBurnTokenPercent(e.target.value.toString())}
                        step="0.5"
                        class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                    <div className="relative flex mt-2 text-white bg-transparent justify-evenly bg-clip-border">
                        <button
                            className="w-full font-medium text-center text-white uppercase px-6 h-10 rounded-lg justify-center items-center gap-2.5 inline-flex bg-green-button active:brightness-75 transition duration-100 ease-in-out transform focus:outline-none font-conthrax"
                            onClick={handleBurnToken}>
                            Burn Token
                        </button>
                    </div>
                </div>
            </div>
            <div className="w-full border-t border-dashed border-gray-highlight">
                <div className="flex items-center justify-between w-full h-auto mb-5">
                    <div className="m-auto mt-10 text-xl font-medium text-white font-conthrax">
                        Close Token Account
                    </div>
                </div>
                <div className="flex flex-col gap-3">
                    <div className="flex flex-row items-end justify-center gap-2">
                        <div className="grow">
                            <div className="text-white text-left">
                                Token Address<span className="pl-1 text-white">*</span>
                            </div>
                            <div
                                className="flex rounded-lg outline outline-1 outline-gray-blue bg-light-black w-full h-10 mt-1 overflow-hidden"
                            >
                                <input
                                    className="outline-none text-orange placeholder:text-gray-border px-2.5 bg-transparent w-full h-full"
                                    placeholder="Enter token address (mint)"
                                    value={closeTokenAddress}
                                    onChange={(e) => setCloseTokenAddress(e.target.value)}
                                />
                                <button
                                    className="w-[200px] font-medium text-center text-white uppercase px-6 h-10 rounded-lg justify-center items-center gap-2.5 inline-flex bg-green-button active:brightness-75 transition duration-100 ease-in-out transform focus:outline-none font-conthrax"
                                    onClick={handleCloseTokenAccount}>
                                    Close Account
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
