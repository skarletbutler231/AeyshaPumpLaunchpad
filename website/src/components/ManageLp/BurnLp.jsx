import { useContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";

import { AppContext } from "../../App";
import { USE_JITO, getLPBalance, removeLiquidityByPercent, burnLPByPercent, sendAndConfirmSignedTransactions, getTipTransaction } from "../../utils/solana";
import { isValidAddress } from "../../utils/methods";
import { GradientButton } from "../Buttons/Buttons";
import { PublicKey } from "@solana/web3.js";

export default function BurnLp({ className }) {
    const {
        SERVER_URL,
        user,
        setLoadingPrompt,
        setOpenLoading,
        signingData,
        sigData,
        raydium
    } = useContext(AppContext);
    const { connected, publicKey, signAllTransactions } = useWallet();
    const { connection } = useConnection();

    const [burnBaseTokenAddress, setBurnBaseTokenAddress] = useState("");
    const [burnQuoteTokenAddress, setBurnQuoteTokenAddress] = useState("So11111111111111111111111111111111111111112");
    const [burnLpBalance, setBurnLpBalance] = useState("0");
    const [burnLpPercent, setBurnLpPercent] = useState("");

    useEffect(() => {
        if (connected && isValidAddress(burnBaseTokenAddress) && isValidAddress(burnQuoteTokenAddress)) {
            getLPBalance(raydium, connection, burnBaseTokenAddress, burnQuoteTokenAddress, publicKey).then((resposne) => {
                setBurnLpBalance(resposne);
            });
        }
        else
            setBurnLpBalance("0");
    }, [connected, connection, publicKey, burnBaseTokenAddress, burnQuoteTokenAddress]);

    const handleBurnLP = async () => {
        if (!connected) {
            toast.warn("Please connect wallet!");
            return;
        }

        if (!isValidAddress(burnBaseTokenAddress)) {
            toast.warn("Invalid base token address!");
            return;
        }

        if (!isValidAddress(burnQuoteTokenAddress)) {
            toast.warn("Invalid quote token address!");
            return;
        }

        const percent = parseFloat(burnLpPercent);
        if (isNaN(percent) || percent <= 0 || percent > 100) {
            toast.warn("Invalid percent value!");
            return;
        }

        setLoadingPrompt("Burning LP...");
        setOpenLoading(true);
        try {
            const tokenAccountInfo = await connection.getAccountInfo(new PublicKey(burnBaseTokenAddress));
            const tokenProgramId = tokenAccountInfo.owner;
            const transaction = await burnLPByPercent(raydium, connection, burnBaseTokenAddress, burnQuoteTokenAddress, percent, publicKey, tokenProgramId);
            if (transaction) {
                let txns = [transaction];
                if (USE_JITO) {
                    const tipTxn = await getTipTransaction(connection, publicKey, user.presets.jitoTip);
                    txns.push(tipTxn);
                }
                const signedTxns = await signAllTransactions(txns);
                const res = await sendAndConfirmSignedTransactions(USE_JITO, connection, signedTxns, signingData, sigData);
                if (res) {
                    const balance = await getLPBalance(raydium, connection, burnBaseTokenAddress, burnQuoteTokenAddress, publicKey);
                    setBurnLpBalance(balance);

                    toast.success("Succeed to burn LP!");
                }
                else
                    toast.warn("Failed to burn LP!");
            }
            else
                toast.warn("Failed to burn LP!");
        }
        catch (err) {
            console.log(err);
            toast.warn("Failed to burn LP!");
        }
        setOpenLoading(false);
    };

    return (
        <div className={`${className} flex flex-col text-white gap-6 m-auto`}>
            <div className="flex flex-col gap-4">
                <h2 className="text-left text-lg">Burn LP Token</h2>
                <div className="">
                    <div className="text-white text-left">
                        Base Token Address<span className="pl-1 text-white">*</span>
                    </div>
                    <input
                        className="outline-none rounded-lg text-orange border border-gray-blue placeholder:text-gray-border px-2.5 bg-light-black w-full h-10 mt-1"
                        placeholder="Enter base token address"
                        value={burnBaseTokenAddress}
                        onChange={(e) => setBurnBaseTokenAddress(e.target.value)}
                    />
                </div>
                <div className="">
                    <div className="text-white text-left">
                        Quote Token Address<span className="pl-1 text-white">*</span>
                    </div>
                    <input
                        className="outline-none rounded-lg text-orange border border-gray-blue placeholder:text-gray-border px-2.5 bg-light-black w-full h-10 mt-1"
                        placeholder="Enter quote token address"
                        disabled
                        value={burnQuoteTokenAddress}
                        onChange={(e) => setBurnQuoteTokenAddress(e.target.value)}
                    />
                </div>
                <div className="">
                    <div className="flex justify-between">
                        <div className="text-white text-left">
                            % to burn LP<span className="pl-1 text-white">*</span>
                        </div>
                        <p className="text-right text-orange">Balance: {burnLpBalance}</p>
                    </div>
                    <input
                        className="outline-none rounded-lg text-orange border border-gray-blue placeholder:text-gray-border px-2.5 bg-light-black w-full h-10 mt-1"
                        placeholder="Enter % amount to burn LP"
                        value={burnLpPercent}
                        onChange={(e) => setBurnLpPercent(e.target.value)}
                    />
                </div>
                <input
                    id="steps-range" 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={Number(burnLpPercent)} 
                    onChange={(e) => setBurnLpPercent(e.target.value.toString())}
                    step="0.5" 
                    class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                />
            </div>
            <div className="relative flex mt-2 text-white bg-transparent justify-evenly bg-clip-border">
                <button
                    className="w-full font-medium text-center text-white uppercase px-6 h-10 rounded-lg justify-center items-center gap-2.5 inline-flex bg-green-button active:scale-95 transition duration-100 ease-in-out transform focus:outline-none font-conthrax"
                    onClick={handleBurnLP}>
                    Burn LP
                </button>
            </div>
        </div>
    );
}
