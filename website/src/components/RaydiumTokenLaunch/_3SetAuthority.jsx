import { useContext, useEffect, useState } from "react"
import { checkAuthority, getTipTransaction, sendAndConfirmSignedTransactions, setFreezeAuthority, setMintAuthority, USE_JITO } from "../../utils/solana";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AppContext } from "../../App";
import { toast } from "react-toastify";
import { isValidAddress } from "../../utils/methods";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";

export default function _3SetAuthority(props) {
    const {
        SERVER_URL,
        user,
        setLoadingPrompt,
        setOpenLoading,
        signingData,
        sigData
    } = useContext(AppContext);

    const { selectedProject, setStep, type = "raydium" } = props;

    const [revokeMintTokenAddress, setRevokeMintTokenAddress] = useState("");
    const [revokeFreezeTokenAddress, setRevokeFreezeTokenAddress] = useState("")
    const { connected, publicKey, signAllTransactions } = useWallet();
    const { connection } = useConnection();

    useEffect(() => {
        setRevokeFreezeTokenAddress(selectedProject.token?.address);
        setRevokeMintTokenAddress(selectedProject.token?.address);
    }, [selectedProject.token?.address])

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
            const transaction = await setMintAuthority(connection, revokeMintTokenAddress, publicKey, null, type == "token-2022" ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID);
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
            const transaction = await setFreezeAuthority(connection, revokeFreezeTokenAddress, publicKey, null, type == "token-2022" ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID);
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

    const handleContinue = async () => {
        setLoadingPrompt("Checking Authority...");
        setOpenLoading(true);
        const authorityCheck = await checkAuthority(connection, selectedProject.token.address, type == "token-2022" ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID);
        setOpenLoading(false);
        console.log(authorityCheck)
        selectedProject.token.freezeAuthorityRevoked = authorityCheck.freezeAuthorityRevoked;
        selectedProject.token.mintAuthorityRevoked = authorityCheck.mintAuthorityRevoked;
        setStep(p => p + 1);
    }

    return (
        <div className={`w-fit h-full flex flex-col gap-4 justify-center text-white rounded-3xl `}>
            <div className="w-full">
                <div className="flex items-center justify-between w-full h-auto mb-2">
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
                                className="w-[300px] h-full font-medium font-conthrax text-center text-white uppercase px-6 rounded-lg justify-center items-center gap-2.5 inline-flex bg-green-button active:brightness-75 transition duration-100 ease-in-out transform focus:outline-none disabled:bg-gray-normal"
                                disabled={selectedProject?.token?.mintAuthorityRevoked}
                                onClick={handleRevokeMintAuthority}>
                                Revoke (Optional)
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            {/* {
                type != "raydium-fair" && type != "token-2022" &&
                <div className="w-full">
                    <div className="flex items-center justify-between w-full h-auto mb-2">
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
                                    className="outline-none text-orange placeholder:text-gray-border px-2.5 bg-trnasparent w-full h-full"
                                    placeholder="Enter token address"
                                    value={revokeFreezeTokenAddress}
                                    onChange={(e) => setRevokeFreezeTokenAddress(e.target.value)}
                                />
                                <button
                                    className="w-[300px] h-full font-medium font-conthrax text-center text-white uppercase px-6 rounded-lg justify-center items-center gap-2.5 inline-flex bg-gradient-blue-to-purple active:brightness-75 transition duration-100 ease-in-out transform focus:outline-none disabled:bg-gray-normal"
                                    disabled={selectedProject?.token?.freezeAuthorityRevoked}
                                    onClick={handleRevokeFreezeAuthority}>
                                    Revoke (Optional)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            } */}
            <button
                className="w-full h-10 font-medium font-conthrax text-center text-white uppercase px-6 rounded-lg justify-center items-center gap-2.5 inline-flex bg-green-button active:brightness-75 transition duration-100 ease-in-out transform focus:outline-none"
                onClick={handleContinue}>
                Continue
            </button>
        </div>
    )
}