import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AppContext } from "../../App";
import { isValidAddress } from "../../utils/methods";
import { useContext, useEffect, useState } from "react";
import { createOpenBookMarket, getTipTransaction, sendAndConfirmSignedTransactions, USE_JITO } from "../../utils/solana";
import { toast } from "react-toastify";

export default function _4OpenBookMarket(props) {
    const {
        SERVER_URL,
        user,
        setLoadingPrompt,
        setOpenLoading,
        signingData,
        sigData,
    } = useContext(AppContext);

    const { selectedProject, setStep } = props;

    const { connected, publicKey, signAllTransactions } = useWallet();
    const { connection } = useConnection();

    const [baseTokenAddress, setBaseTokenAddress] = useState("");
    const [quoteTokenAddress, setQuoteTokenAddress] = useState("So11111111111111111111111111111111111111112");
    const [minOrderSize, setMinOrderSize] = useState("1");
    const [minPriceTickSize, setMinPriceTickSize] = useState("0.00001");

    const inputCSSString = "token-deploy-input rounded-xl outline-none text-orange placeholder:text-gray-border px-2.5 w-full h-8 mt-1";

    useEffect(() => {
        setBaseTokenAddress(selectedProject?.token?.address)
    }, [selectedProject?.token?.address])

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
                selectedProject.token.marketId = marketId.toBase58();
                toast.success("Succeed to create OpenBook market!");
                setStep(p => p + 1);
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
        <div className={`w-[600px] flex flex-col text-white font-sans gap-3 m-auto`}>
            <div className="w-full flex flex-col gap-4">
                <div className="flex gap-2">
                    <div className="w-1/2">
                        <div className="text-white text-left">
                            Base Token Address<span className="pl-1 text-white">*</span>
                        </div>
                        <input
                            className={inputCSSString}
                            placeholder="Enter base token address"
                            value={baseTokenAddress}
                            onChange={(e) => setBaseTokenAddress(e.target.value)}
                        />
                    </div>
                    <div className="w-1/2">
                        <div className="text-white text-left">
                            Quote Token Address<span className="pl-1 text-white">*</span>
                        </div>
                        <input
                            className={inputCSSString}
                            placeholder="Enter quote token address"
                            disabled
                            value={quoteTokenAddress}
                            onChange={(e) => setQuoteTokenAddress(e.target.value)}
                        />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-1">
                        <div className="text-white text-left">
                            Minimum Order Size<span className="pl-1 text-white">*</span>
                        </div>
                        <input
                            className={inputCSSString}
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
                            className={inputCSSString}
                            placeholder="Enter minimum price tick size"
                            value={minPriceTickSize}
                            onChange={(e) => setMinPriceTickSize(e.target.value)}
                        />
                    </div>
                </div>
                <div className="relative flex mt-2 text-white bg-transparent justify-evenly bg-clip-border">
                    <button
                        className="w-full font-medium font-conthrax text-center text-white uppercase px-6 h-10 rounded-lg justify-center items-center gap-2.5 inline-flex bg-green-button active:scale-95 transition duration-100 ease-in-out transform focus:outline-none"
                        onClick={handleCreate}
                    >
                        Create Market
                    </button>
                </div>
            </div>
        </div>
    );
} 