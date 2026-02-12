import { useContext, useState } from "react";
import { toast } from "react-toastify";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";

import { AppContext } from "../../App";
import NotifyAddressDialog from "../Dialogs/NotifyAddressDialog";
import { USE_JITO, createOpenBookMarket, sendAndConfirmSignedTransactions, getTipTransaction } from "../../utils/solana";
import { isValidAddress } from "../../utils/methods";

export default function OpenBookMarket({ className }) {
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

    const [baseTokenAddress, setBaseTokenAddress] = useState("");
    const [quoteTokenAddress, setQuoteTokenAddress] = useState("So11111111111111111111111111111111111111112");
    const [minOrderSize, setMinOrderSize] = useState("");
    const [minPriceTickSize, setMinPriceTickSize] = useState("");
    const [notifyAddressDialog, setNotifyAddressDialog] = useState(false);
    const [notifyTitle, setNotifyTitle] = useState("");
    const [notifyAddress, setNotifyAddress] = useState("");

    const handleCreate = async () => {
        if (!connected) {
            toast.warn("Please connect wallet!");
            return;
        }

        if (!isValidAddress(baseTokenAddress)) {
            toast.warn("Invalid base token address!");
            return;
        }

        if (!isValidAddress(quoteTokenAddress)) {
            toast.warn("Invalid quote token address!");
            return;
        }

        const orderSize = parseFloat(minOrderSize);
        if (isNaN(orderSize) || orderSize <= 0) {
            toast.warn("Invalid minimum order size!");
            return;
        }

        const tickSize = parseFloat(minPriceTickSize);
        if (isNaN(tickSize) || tickSize <= 0) {
            toast.warn("Invalid minimum price tick size!");
            return;
        }

        setLoadingPrompt("Creating OpenBook market...");
        setOpenLoading(true);
        try {
            const { marketId, transactions } = await createOpenBookMarket(connection, baseTokenAddress, quoteTokenAddress, orderSize, tickSize, publicKey);
            if (!transactions) {
                setNotifyTitle("Market ID");
                setNotifyAddress(marketId.toBase58());
                setNotifyAddressDialog(true);
                toast.success("Already created OpenBook market!");
                setOpenLoading(false);
                return;
            }

            let txns = [...transactions];
            if (USE_JITO) {
                const tipTxn = await getTipTransaction(connection, publicKey, user.presets.jitoTip);
                txns.push(tipTxn);
            }
            const signedTxns = await signAllTransactions(txns);
            const res = await sendAndConfirmSignedTransactions(USE_JITO, connection, signedTxns, signingData, sigData);
            if (res) {
                setNotifyTitle("Market ID");
                setNotifyAddress(marketId.toBase58());
                setNotifyAddressDialog(true);
                toast.success("Succeed to create OpenBook market!");
            }
            else
                toast.warn("Failed to create OpenBook market!");
        }
        catch (err) {
            console.log(err);
            toast.warn("Failed to create OpenBook market!");
        }
        setOpenLoading(false);
    };

    return (
        <div className={`${className} flex flex-col text-white font-sans gap-3 m-auto`}>
            <NotifyAddressDialog isOpen={notifyAddressDialog} title={notifyTitle} address={notifyAddress} onClose={() => setNotifyAddressDialog(false)} />
            <div className="w-full">
                <div className="flex items-center justify-between w-full h-auto mb-5">
                    <div className="m-auto mt-5 text-xl font-medium text-white">
                        Create OpenBook Market
                    </div>
                </div>
                <div className="flex flex-col gap-4">
                    <div className="">
                        <div className="text-white text-left">
                            Base Token Address<span className="pl-1 text-white">*</span>
                        </div>
                        <input
                            className="outline-none rounded-lg text-orange border border-gray-blue placeholder:text-gray-border px-2.5 bg-light-black w-full h-8 mt-1"
                            placeholder="Enter base token address"
                            value={baseTokenAddress}
                            onChange={(e) => setBaseTokenAddress(e.target.value)}
                        />
                    </div>
                    <div className="">
                        <div className="text-white text-left">
                            Quote Token Address<span className="pl-1 text-white">*</span>
                        </div>
                        <input
                            className="outline-none rounded-lg text-orange border border-gray-blue placeholder:text-gray-border px-2.5 bg-light-black w-full h-8 mt-1"
                            placeholder="Enter quote token address"
                            disabled
                            value={quoteTokenAddress}
                            onChange={(e) => setQuoteTokenAddress(e.target.value)}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-1">
                            <div className="text-white text-left">
                                Minimum Order Size<span className="pl-1 text-white">*</span>
                            </div>
                            <input
                                className="outline-none rounded-lg text-orange border border-gray-blue placeholder:text-gray-border px-2.5 bg-light-black w-full h-8 mt-1"
                                placeholder="Enter minimum order size"
                                value={minOrderSize}
                                onChange={(e) => setMinOrderSize(e.target.value)}
                            />
                        </div>
                        <div className="col-span-1">
                            <div className="text-white text-left">
                                Minimum Price Tick Size<span className="pl-1 text-white">*</span>
                            </div>
                            <input
                                className="outline-none rounded-lg text-orange border border-gray-blue placeholder:text-gray-border px-2.5 bg-light-black w-full h-8 mt-1"
                                placeholder="Enter minimum price tick size"
                                value={minPriceTickSize}
                                onChange={(e) => setMinPriceTickSize(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="relative flex mt-2 text-white bg-transparent justify-evenly bg-clip-border">
                        <button
                            className="w-full font-medium text-center text-white uppercase px-6 h-10 rounded-lg justify-center items-center gap-2.5 inline-flex bg-gradient-blue-to-purple active:scale-95 transition duration-100 ease-in-out transform focus:outline-none"
                            onClick={handleCreate}
                        >
                            Create Market
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
