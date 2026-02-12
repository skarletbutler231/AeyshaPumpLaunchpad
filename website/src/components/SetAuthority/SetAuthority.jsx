import { useContext, useState } from "react";
import { toast } from "react-toastify";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";

import { AppContext } from "../../App";
import { USE_JITO, setMintAuthority, setFreezeAuthority, sendAndConfirmSignedTransactions, getTipTransaction } from "../../utils/solana";
import { isValidAddress } from "../../utils/methods";
import { PublicKey } from "@solana/web3.js";

export default function SetAuthority({ className }) {
    const {
        SERVER_URL,
        user,
        setLoadingPrompt,
        setOpenLoading,
        signingData,
        sigData,
    } = useContext(AppContext);
    const { connected, publicKey, signAllTransactions } = useWallet();
    const { connection } = useConnection();

    const [revokeMintTokenAddress, setRevokeMintTokenAddress] = useState("");
    const [revokeFreezeTokenAddress, setRevokeFreezeTokenAddress] = useState("");
    const [mintTokenAddress, setMintTokenAddress] = useState("");
    const [mintOwnerAddress, setMintOwnerAddress] = useState("");
    const [freezeTokenAddress, setFreezeTokenAddress] = useState("");
    const [freezeOwnerAddress, setFreezeOwnerAddress] = useState("");

    const handleRevokeMintAuthority = async () => {
        if (!connected) {
            toast.warn("Please connect wallet!");
            return;
        }

        if (!isValidAddress(revokeMintTokenAddress)) {
            toast.warn("Invalid token address to revoke mint authority!");
            return;
        }

        setLoadingPrompt("Revoking mint authority...");
        setOpenLoading(true);
        try {
            const tokenAccountInfo = await connection.getAccountInfo(new PublicKey(revokeMintTokenAddress))
            const tokenProgramId = tokenAccountInfo.owner;
            const transaction = await setMintAuthority(connection, revokeMintTokenAddress, publicKey, null, tokenProgramId);
            if (transaction) {
                let txns = [transaction];
                if (USE_JITO) {
                    const tipTxn = await getTipTransaction(connection, publicKey, user.presets.jitoTip);
                    txns.push(tipTxn);
                }

                const signedTxns = await signAllTransactions(txns);
                const res = await sendAndConfirmSignedTransactions(USE_JITO, connection, signedTxns, signingData, sigData);
                if (res) {
                    toast.success("Succeed to revoke mint authority!");
                }
                else
                    toast.warn("Failed to revoke mint authority!");
            }
        }
        catch (err) {
            console.log(err);
            toast.warn("Failed to revoke mint authority");
        }
        setOpenLoading(false);
    };

    const handleRevokeFreezeAuthority = async () => {
        if (!connected) {
            toast.warn("Please connect wallet!");
            return;
        }

        if (!isValidAddress(revokeFreezeTokenAddress)) {
            toast.warn("Invalid token address to revoke freeze authority!");
            return;
        }

        setLoadingPrompt("Revoking freeze authority...");
        setOpenLoading(true);
        try {
            const tokenAccountInfo = await connection.getAccountInfo(new PublicKey(revokeFreezeTokenAddress))
            const tokenProgramId = tokenAccountInfo.owner;
            const transaction = await setFreezeAuthority(connection, revokeFreezeTokenAddress, publicKey, null, tokenProgramId);
            if (transaction) {
                let txns = [transaction];
                if (USE_JITO) {
                    const tipTxn = await getTipTransaction(connection, publicKey, user.presets.jitoTip);
                    txns.push(tipTxn);
                }

                const signedTxns = await signAllTransactions(txns);
                const res = await sendAndConfirmSignedTransactions(USE_JITO, connection, signedTxns, signingData, sigData);
                if (res) {
                    toast.success("Succeed to revoke freeze authority!");
                }
                else
                    toast.warn("Failed to revoke freeze authority!");
            }
        }
        catch (err) {
            console.log(err);
            toast.warn("Failed to revoke freeze authority");
        }
        setOpenLoading(false);
    };

    const handleSetMintAuthority = async () => {
        if (!connected) {
            toast.warn("Please connect wallet!");
            return;
        }

        if (!isValidAddress(mintTokenAddress)) {
            toast.warn("Invalid token address to set mint authority!");
            return;
        }

        if (!isValidAddress(mintOwnerAddress)) {
            toast.warn("Invalid new mint owner address!");
            return;
        }

        setLoadingPrompt("Setting mint authority...");
        setOpenLoading(true);
        try {
            const tokenAccountInfo = await connection.getAccountInfo(new PublicKey(mintTokenAddress))
            const tokenProgramId = tokenAccountInfo.owner;
            const transaction = await setMintAuthority(connection, mintTokenAddress, publicKey, mintOwnerAddress, tokenProgramId);
            if (transaction) {
                let txns = [transaction];
                if (USE_JITO) {
                    const tipTxn = await getTipTransaction(connection, publicKey, user.presets.jitoTip);
                    txns.push(tipTxn);
                }

                const signedTxns = await signAllTransactions(txns);
                const res = await sendAndConfirmSignedTransactions(USE_JITO, connection, signedTxns, signingData, sigData);
                if (res) {
                    toast.success("Succeed to set mint authority!");
                }
                else
                    toast.warn("Failed to set mint authority!");
            }
        }
        catch (err) {
            console.log(err);
            toast.warn("Failed to set mint authority");
        }
        setOpenLoading(false);
    };

    const handleSetFreezeAuthority = async () => {
        if (!connected) {
            toast.warn("Please connect wallet!");
            return;
        }

        if (!isValidAddress(freezeTokenAddress)) {
            toast.warn("Invalid token address to set freeze authority!");
            return;
        }

        if (!isValidAddress(freezeOwnerAddress)) {
            toast.warn("Invalid new freeze owner address!");
            return;
        }

        setLoadingPrompt("Setting freeze authority...");
        setOpenLoading(true);
        try {
            const tokenAccountInfo = await connection.getAccountInfo(new PublicKey(freezeTokenAddress))
            const tokenProgramId = tokenAccountInfo.owner;
            const transaction = await setFreezeAuthority(connection, freezeTokenAddress, publicKey, freezeOwnerAddress, tokenProgramId);
            if (transaction) {
                let txns = [transaction];
                if (USE_JITO) {
                    const tipTxn = await getTipTransaction(connection, publicKey, user.presets.jitoTip);
                    txns.push(tipTxn);
                }

                const signedTxns = await signAllTransactions(txns);
                const res = await sendAndConfirmSignedTransactions(USE_JITO, connection, signedTxns, signingData, sigData);
                if (res) {
                    toast.success("Succeed to set freeze authority!");
                }
                else
                    toast.warn("Failed to set freeze authority!");
            }
        }
        catch (err) {
            console.log(err);
            toast.warn("Failed to set freeze authority");
        }
        setOpenLoading(false);
    };

    return (
        <div className={`${className} flex flex-col text-white font-sans gap-10 m-auto`}>
            <div className="w-full">
                <div className="flex items-center justify-between w-full h-auto mb-3">
                    <div className="text-left text-sm font-medium text-gray-normal">
                        Revoke Mint Authority
                    </div>
                </div>
                <div className="flex flex-col gap-3">
                    <div className="items-center grow">
                        <div className="text-white text-left">
                            Token Address<span className="pl-1 text-white">*</span>
                        </div>
                        <div
                            className="flex rounded-lg outline outline-1 outline-gray-blue bg-light-black w-full h-10 mt-1 overflow-hidden"
                        >
                            <input
                                className="outline-none text-orange placeholder:text-gray-border px-2.5 bg-transparent w-full h-full"
                                placeholder="Enter token address"
                                value={revokeMintTokenAddress}
                                onChange={(e) => setRevokeMintTokenAddress(e.target.value)}
                            />
                            <button
                                className="w-[200px] h-full font-medium font-conthrax text-center text-white uppercase px-6 rounded-lg justify-center items-center gap-2.5 inline-flex bg-green-button active:brightness-75 transition duration-100 ease-in-out transform focus:outline-none"
                                onClick={handleRevokeMintAuthority}>
                                Revoke
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="w-full">
                <div className="flex items-center justify-between w-full h-auto mb-3">
                    <div className="text-sm font-medium text-gray-normal">
                        Set Mint Authority
                    </div>
                </div>
                <div className="flex flex-col gap-3">
                    <div className="flex justify-between gap-3">
                        <div className="w-1/2 items-center">
                            <div className="text-white text-left">
                                Token Address<span className="pl-1 text-white">*</span>
                            </div>
                            <input
                                className="outline-none rounded-lg text-orange border border-gray-blue placeholder:text-gray-border px-2.5 bg-light-black w-full h-10 mt-1"
                                placeholder="Enter token address"
                                value={mintTokenAddress}
                                onChange={(e) => setMintTokenAddress(e.target.value)}
                            />
                        </div>
                        <div className="w-1/2 items-center">
                            <div className="text-white text-left">
                                New Owner Address<span className="pl-1 text-white">*</span>
                            </div>
                            <input
                                className="outline-none rounded-lg text-orange border border-gray-blue placeholder:text-gray-border px-2.5 bg-light-black w-full h-10 mt-1"
                                placeholder="Enter new owner address"
                                value={mintOwnerAddress}
                                onChange={(e) => setMintOwnerAddress(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="relative flex text-white bg-transparent justify-evenly bg-clip-border">
                        <button
                            className="w-full font-medium font-conthrax text-center text-white uppercase px-6 h-10 rounded-lg justify-center items-center gap-2.5 inline-flex bg-green-button active:brightness-75 transition duration-100 ease-in-out transform focus:outline-none"
                            onClick={handleSetMintAuthority}>
                            Set Authority
                        </button>
                    </div>
                </div>
            </div>
            <div className="w-full">
                <div className="flex items-center justify-between w-full h-auto mb-3">
                    <div className=" text-sm font-medium text-gray-normal">
                        Revoke Freeze Authority
                    </div>
                </div>
                <div className="flex flex-col gap-3">
                    <div className="items-center grow">
                        <div className="text-white text-left">
                            Token Address<span className="pl-1 text-white">*</span>
                        </div>
                        <div
                            className="flex rounded-lg outline outline-1 outline-gray-blue bg-light-black w-full h-10 mt-1 overflow-hidden"
                        >
                            <input
                                className="outline-none text-orange placeholder:text-gray-border px-2.5 bg-transparent w-full h-full"
                                placeholder="Enter token address"
                                value={revokeFreezeTokenAddress}
                                onChange={(e) => setRevokeFreezeTokenAddress(e.target.value)}
                            />
                            <button
                                className="w-[200px] h-full font-medium font-conthrax text-center text-white uppercase px-6 rounded-lg justify-center items-center gap-2.5 inline-flex bg-green-button active:brightness-75 transition duration-100 ease-in-out transform focus:outline-none"
                                onClick={handleRevokeFreezeAuthority}>
                                Revoke
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="w-full">
                <div className="flex items-center justify-between w-full h-auto mb-3">
                    <div className="text-sm font-medium text-gray-normal">
                        Set Freeze Authority
                    </div>
                </div>
                <div className="flex gap-3 mb-3">
                    <div className="w-1/2 items-center">
                        <div className="text-white text-left">
                            Token Address<span className="pl-1 text-white">*</span>
                        </div>

                        <input
                            className="outline-none rounded-lg text-orange border border-gray-blue placeholder:text-gray-border px-2.5 bg-light-black w-full h-10 mt-1"
                            placeholder="Enter token address"
                            value={freezeTokenAddress}
                            onChange={(e) => setFreezeTokenAddress(e.target.value)}
                        />
                    </div>
                    <div className="w-1/2 items-center">
                        <div className="text-white text-left">
                            New Owner Address<span className="pl-1 text-white">*</span>
                        </div>
                        <input
                            className="outline-none rounded-lg text-orange border border-gray-blue placeholder:text-gray-border px-2.5 bg-light-black w-full h-10 mt-1"
                            placeholder="Enter new owner address"
                            value={freezeOwnerAddress}
                            onChange={(e) => setFreezeOwnerAddress(e.target.value)}
                        />
                    </div>
                </div>
                <div className="relative flex text-white bg-transparent justify-evenly bg-clip-border">
                    <button
                        className="w-full font-medium font-conthrax text-center text-white uppercase px-6 h-10 rounded-lg justify-center items-center gap-2.5 inline-flex bg-green-button active:brightness-75 transition duration-100 ease-in-out transform focus:outline-none"
                        onClick={handleSetFreezeAuthority}>
                        Set Authority
                    </button>
                </div>
            </div>
        </div>
    );
}
