import { useContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";

import { AppContext } from "../../App";
import { USE_JITO, getLPBalance, removeLiquidityByPercent, burnLPByPercent, sendAndConfirmSignedTransactions, getTipTransaction } from "../../utils/solana";
import { isValidAddress } from "../../utils/methods";
import { GradientButton } from "../Buttons/Buttons";
import axios from "axios";
import { PublicKey } from "@solana/web3.js";

export default function RemoveLp({ className }) {
    const {
        SERVER_URL,
        user,
        setLoadingPrompt,
        setOpenLoading,
        currentProject,
        sigData,
        signingData,
        poolInfo,
        raydium
    } = useContext(AppContext);
    const { connected, publicKey, signAllTransactions } = useWallet();
    const { connection } = useConnection();

    const [removeBaseTokenAddress, setRemoveBaseTokenAddress] = useState("");
    const [removeQuoteTokenAddress, setRemoveQuoteTokenAddress] = useState("So11111111111111111111111111111111111111112");
    const [removeLpBalance, setRemoveLpBalance] = useState("0");
    const [removeLpPercent, setRemoveLpPercent] = useState("");
    const [removePoolAddress, setRemovePoolAddress] = useState("");

    useEffect(() => {
        if (connected && isValidAddress(removePoolAddress)) {
            getLPBalance(raydium, connection, removePoolAddress, publicKey).then((resposne) => {
                setRemoveLpBalance(resposne);
            });
        }
        else
            setRemoveLpBalance("0");
    }, [connected, connection, publicKey, removePoolAddress]);

    const handleRemoveLiquidity = async () => {
        if (!connected) {
            toast.warn("Please connect wallet!");
            return;
        }

        const percent = parseFloat(removeLpPercent);
        if (isNaN(percent) || percent <= 0 || percent > 100) {
            toast.warn("Invalid percent value!");
            return;
        }

        setLoadingPrompt("Removing liquidity...");
        setOpenLoading(true);
        try {
            const transactions = await removeLiquidityByPercent(raydium, connection, removePoolAddress, percent, publicKey);
            if (transactions) {
                let txns = [...transactions];
                if (USE_JITO) {
                    const tipTxn = await getTipTransaction(connection, publicKey, user.presets.jitoTip);
                    txns.push(tipTxn);
                }

                try {
                    await axios.post(`${SERVER_URL}/api/v1/project/remove-lp`,
                        {
                            projectId: currentProject._id,
                            poolInfo,
                            token: removePoolAddress,
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
                } catch (err) {
                }

                console.log(txns)

                const signedTxns = await signAllTransactions(txns);
                const res = await sendAndConfirmSignedTransactions(USE_JITO, connection, signedTxns, signingData, sigData);
                if (res) {
                    const balance = await getLPBalance(raydium, connection, removePoolAddress, publicKey);
                    setRemoveLpBalance(balance);
                    toast.success("Succeed to remove liquidity!");
                }
                else
                    toast.warn("Failed to remove liquidity!");
            }
            else
                toast.warn("Failed to remove liquidity!");
        }
        catch (err) {
            console.log(err);
            toast.warn("Failed to remove liquidity!");
        }
        setOpenLoading(false);
    };

    return (
        <div className={`${className} flex flex-col text-white gap-6 m-auto`}>
            <div className="flex flex-col gap-4">
                <h2 className="text-left text-lg">Remove Liquidity</h2>
                <div className="">
                    <div className="text-white text-left">
                        Pool Address<span className="pl-1 text-white">*</span>
                    </div>
                    <input
                        className="outline-none rounded-lg text-orange border border-gray-blue placeholder:text-gray-border px-2.5 bg-light-black w-full h-10 mt-1"
                        placeholder="Enter base token address"
                        value={removePoolAddress}
                        onChange={(e) => setRemovePoolAddress(e.target.value)}
                    />
                </div>
                <div className="">
                    <div className="flex justify-between">
                        <div className="text-white text-left">
                            % to remove liquidity<span className="pl-1 text-white">*</span>
                        </div>
                        <p className="text-right text-orange">Balance: {removeLpBalance}</p>
                    </div>
                    <input
                        className="outline-none rounded-lg text-orange border border-gray-blue placeholder:text-gray-border px-2.5 bg-light-black w-full h-10 mt-1"
                        placeholder="Enter % amount to remove liquidity"
                        value={removeLpPercent}
                        onChange={(e) => setRemoveLpPercent(e.target.value)}
                    />
                </div>
                <input
                    id="steps-range"
                    type="range"
                    min="0"
                    max="100"
                    value={Number(removeLpPercent)}
                    onChange={(e) => setRemoveLpPercent(e.target.value.toString())}
                    step="0.5"
                    class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                />
                <div className="text-right">Total Cost: 0.01 SOL</div>
            </div>
            <div className="relative flex mt-2 text-white bg-transparent justify-evenly bg-clip-border">
                <button
                    className="w-full font-medium text-center text-white uppercase px-6 h-10 rounded-lg justify-center items-center gap-2.5 inline-flex bg-green-button active:scale-95 transition duration-100 ease-in-out transform focus:outline-none font-conthrax"
                    onClick={handleRemoveLiquidity}>
                    Remove Liquidity
                </button>
            </div>
        </div>
    );
}
