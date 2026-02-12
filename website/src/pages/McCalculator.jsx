import { useState } from "react";

import TopBar from "../components/TopBar/TopBar";
import { Card } from "../components/Card/Card";
import { ExtendedButton } from "../components/Buttons/Buttons";

const McCalculator = () => {
    const [pageIndex, setPageIndex] = useState(0);

    // for raydium
    const [marketCap, setMarketCap] = useState(100000);
    const [solPrice, setSolPrice] = useState(200);
    const [initialSolLiquidity, setInitialSolLiquidity] = useState(5)
    const [initialTokenLiquidity, setInitialTokenLiquidity] = useState(100)
    const [snipedSol, setSnipedSol] = useState(50)
    const [snipedTokenPercent, setSnipedTokenPercent] = useState(90)

    // for pumpfun
    const [marketCapPump, setMarketCapPump] = useState(100000)
    const [solPricePump, setSolPricePump] = useState(200)
    const [snipedSolPump, setSnipedSolPump] = useState(50)
    const [snipedTokenPercentPump, setSnipedTokenPercentPump] = useState(90)

    const calculateRaydium = () => {
        const _solAmount = Math.sqrt(initialTokenLiquidity / 100 * (marketCap / solPrice) * initialSolLiquidity)
        setSnipedSol(_solAmount)
        const _tokenPercent = _solAmount * solPrice * 100 / marketCap
        setSnipedTokenPercent(100 - _tokenPercent)
    }

    const calculatePumpfun = () => {
        const _solAmount = Math.sqrt((marketCapPump / solPricePump) * 30) - 30
        setSnipedSolPump(_solAmount)
        const _tokenPercent = ((30 / (30 + _solAmount)) - 0.21) / 0.79;
        setSnipedTokenPercentPump((1 - _tokenPercent) * 100)
    }

    return (
        <div className="w-screen h-screen flex flex-col max-[1800px]:items-start items-center overflow-auto">
            <div className="flex flex-col mx-6 my-3">
                <TopBar />
                <div className="flex gap-6 my-8 justify-center">
                    <Card className="!w-[800px] rounded-3xl border-8 border-card-border py-6">
                        <div className='container-gradient w-full !p-px mb-6 flex !rounded-md !border !border-solid !border-gray-border gap-px text-md'>
                            <div className={`${pageIndex == 0 ? "bg-gradient-blue-to-purple" : ""} w-1/2 rounded-md p-[1px]`}>
                                <ExtendedButton className={`${pageIndex == 0 ? "bg-black/50" : "bg-transparent hover:bg-gray-highlight"} !h-full w-full uppercase`} onClick={() => setPageIndex(0)}>Raydium</ExtendedButton>
                            </div>
                            <div className={`${pageIndex == 1 ? "bg-gradient-blue-to-purple" : ""} w-1/2 rounded-md p-[1px]`}>
                                <ExtendedButton className={`${pageIndex == 1 ? "bg-black/50" : "bg-transparent hover:bg-gray-highlight"} !h-full w-full uppercase`} onClick={() => setPageIndex(1)}>Pump.fun</ExtendedButton>
                            </div>
                        </div>
                        {
                            pageIndex == 0 ?
                                <div className={`w-full flex flex-col text-white font-sans gap-10 m-auto`}>
                                    <div className="flex flex-col gap-3">
                                        <div className="items-center grow grid grid-cols-2 gap-2">
                                            <div>
                                                <div className="text-white text-left">
                                                    Target Market Cap ($)<span className="pl-1 text-white">*</span>
                                                </div>
                                                <div
                                                    className="flex rounded-lg outline outline-1 outline-gray-blue bg-light-black w-full h-10 mt-1 overflow-hidden"
                                                >
                                                    <input
                                                        className="outline-none text-orange placeholder:text-gray-border px-2.5 bg-trnasparent w-full h-full"
                                                        placeholder="100000"
                                                        value={marketCap}
                                                        onChange={(e) => setMarketCap(e.target.value)}
                                                        type="number"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-white text-left">
                                                    Sol Price ($)<span className="pl-1 text-white">*</span>
                                                </div>
                                                <div
                                                    className="flex rounded-lg outline outline-1 outline-gray-blue bg-light-black w-full h-10 mt-1 overflow-hidden"
                                                >
                                                    <input
                                                        className="outline-none text-orange placeholder:text-gray-border px-2.5 bg-trnasparent w-full h-full"
                                                        placeholder="200"
                                                        value={solPrice}
                                                        onChange={(e) => setSolPrice(e.target.value)}
                                                        type="number"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="items-center grow grid grid-cols-2 gap-2">
                                            <div>
                                                <div className="text-white text-left">
                                                    Sol Amount of Initial Liquidity (SOL)<span className="pl-1 text-white">*</span>
                                                </div>
                                                <div
                                                    className="flex rounded-lg outline outline-1 outline-gray-blue bg-light-black w-full h-10 mt-1 overflow-hidden"
                                                >
                                                    <input
                                                        className="outline-none text-orange placeholder:text-gray-border px-2.5 bg-trnasparent w-full h-full"
                                                        placeholder="100000"
                                                        value={initialSolLiquidity}
                                                        onChange={(e) => setInitialSolLiquidity(e.target.value)}
                                                        type="number"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-white text-left">
                                                    Token Percent of Initial Liquidity (%)<span className="pl-1 text-white">*</span>
                                                </div>
                                                <div
                                                    className="flex rounded-lg outline outline-1 outline-gray-blue bg-light-black w-full h-10 mt-1 overflow-hidden"
                                                >
                                                    <input
                                                        className="outline-none text-orange placeholder:text-gray-border px-2.5 bg-trnasparent w-full h-full"
                                                        placeholder="100"
                                                        value={initialTokenLiquidity}
                                                        onChange={(e) => setInitialTokenLiquidity(e.target.value)}
                                                        type="number"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            className="w-full h-full font-medium font-conthrax text-center text-white uppercase px-6 py-4 rounded-lg justify-center items-center gap-2.5 inline-flex bg-gradient-blue-to-purple active:brightness-75 transition duration-100 ease-in-out transform focus:outline-none"
                                            onClick={calculateRaydium}>
                                            Calculate
                                        </button>
                                        <div className="h-0 w-full border-t-[1px] border-gray-normal" />
                                        <div className="items-center grow grid grid-cols-2 gap-2">
                                            <div>
                                                <div className="text-white text-left">
                                                    Sol Amount To Snipe (SOL)<span className="pl-1 text-white">*</span>
                                                </div>
                                                <div
                                                    className="flex rounded-lg outline outline-1 outline-gray-blue bg-light-black w-full h-10 mt-1 overflow-hidden"
                                                >
                                                    <input
                                                        className="outline-none text-orange placeholder:text-gray-border px-2.5 bg-trnasparent w-full h-full"
                                                        placeholder="30"
                                                        value={snipedSol}
                                                        onChange={(e) => setSnipedSol(e.target.value)}
                                                        type="number"
                                                        disabled
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-white text-left">
                                                    Token Percent To Snipe (%)<span className="pl-1 text-white">*</span>
                                                </div>
                                                <div
                                                    className="flex rounded-lg outline outline-1 outline-gray-blue bg-light-black w-full h-10 mt-1 overflow-hidden"
                                                >
                                                    <input
                                                        className="outline-none text-orange placeholder:text-gray-border px-2.5 bg-trnasparent w-full h-full"
                                                        placeholder="80"
                                                        value={snipedTokenPercent}
                                                        onChange={(e) => setSnipedTokenPercent(e.target.value)}
                                                        type="number"
                                                        disabled
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div> :
                                pageIndex == 1 &&
                                <div className={`w-full flex flex-col text-white font-sans gap-10 m-auto`}>
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center justify-between w-full h-auto mb-3">
                                            <div className=" text-sm font-medium text-gray-normal">
                                                You can correct value when the target marketcap is greater than 100000.
                                            </div>
                                        </div>
                                        <div className="items-center grow grid grid-cols-2 gap-2">
                                            <div>
                                                <div className="text-white text-left">
                                                    Target Market Cap ($)<span className="pl-1 text-white">*</span>
                                                </div>
                                                <div
                                                    className="flex rounded-lg outline outline-1 outline-gray-blue bg-light-black w-full h-10 mt-1 overflow-hidden"
                                                >
                                                    <input
                                                        className="outline-none text-orange placeholder:text-gray-border px-2.5 bg-trnasparent w-full h-full"
                                                        placeholder="100000"
                                                        value={marketCapPump}
                                                        onChange={(e) => setMarketCapPump(e.target.value)}
                                                        type="number"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-white text-left">
                                                    Sol Price ($)<span className="pl-1 text-white">*</span>
                                                </div>
                                                <div
                                                    className="flex rounded-lg outline outline-1 outline-gray-blue bg-light-black w-full h-10 mt-1 overflow-hidden"
                                                >
                                                    <input
                                                        className="outline-none text-orange placeholder:text-gray-border px-2.5 bg-trnasparent w-full h-full"
                                                        placeholder="200"
                                                        value={solPricePump}
                                                        onChange={(e) => setSolPricePump(e.target.value)}
                                                        type="number"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            className="w-full h-full font-medium font-conthrax text-center text-white uppercase px-6 py-4 rounded-lg justify-center items-center gap-2.5 inline-flex bg-gradient-blue-to-purple active:brightness-75 transition duration-100 ease-in-out transform focus:outline-none"
                                            onClick={calculatePumpfun}>
                                            Calculate
                                        </button>
                                        <div className="h-0 w-full border-t-[1px] border-gray-normal" />
                                        <div className="items-center grow grid grid-cols-2 gap-2">
                                            <div>
                                                <div className="text-white text-left">
                                                    Sol Amount To Snipe (SOL)<span className="pl-1 text-white">*</span>
                                                </div>
                                                <div
                                                    className="flex rounded-lg outline outline-1 outline-gray-blue bg-light-black w-full h-10 mt-1 overflow-hidden"
                                                >
                                                    <input
                                                        className="outline-none text-orange placeholder:text-gray-border px-2.5 bg-trnasparent w-full h-full"
                                                        placeholder="30"
                                                        value={snipedSolPump}
                                                        onChange={(e) => setSnipedSolPump(e.target.value)}
                                                        type="number"
                                                        disabled
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-white text-left">
                                                    Token Percent To Snipe (%)<span className="pl-1 text-white">*</span>
                                                </div>
                                                <div
                                                    className="flex rounded-lg outline outline-1 outline-gray-blue bg-light-black w-full h-10 mt-1 overflow-hidden"
                                                >
                                                    <input
                                                        className="outline-none text-orange placeholder:text-gray-border px-2.5 bg-trnasparent w-full h-full"
                                                        placeholder="80"
                                                        value={snipedTokenPercentPump}
                                                        onChange={(e) => setSnipedTokenPercentPump(e.target.value)}
                                                        type="number"
                                                        disabled
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                        }
                    </Card>
                </div>
            </div>
        </div>
    )
}

export default McCalculator