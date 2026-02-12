import { useContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { FaRegCopy } from "react-icons/fa";
import BigNumber from "bignumber.js";
import Modal from "../Base/Modal";
import { ellipsisAddress, formatNumber } from "../../utils/methods";
import AdvancedModal from "./AdvancedModal";
import { ExtendedButton } from "../Buttons/Buttons";
import { AppContext } from "../../App";

export default function SimulationDialog({ isOpen, zombie, tokenInfo, buyTokenAmount, tokenAmountInLP, solAmountInLP, onClose, handleDownloadSimuation, handleSimulateAgain, handleBundle, handleDisperseSOL }) {
    const { solInfo } = useContext(AppContext);
    const [copied, setCopied] = useState(false);
    const zombieAmount = zombie.value && (new BigNumber(zombie.value.toString() + "e-9")).gt(0) ? Number(Number(new BigNumber(zombie.value.toString() + "e-9").toString()).toFixed(3)) + 0.001 : "0";

    const copyToClipboard = async (key, text) => {
        if ('clipboard' in navigator) {
            await navigator.clipboard.writeText(text);
            toast.success("Copied");
            setCopied({
                ...copied,
                [key]: true,
            });
            setTimeout(() => setCopied({
                ...copied,
                [key]: false,
            }), 2000);
        }
        else
            console.error('Clipboard not supported');
    };

    const afterSolAmountInLP = solAmountInLP * tokenAmountInLP / (tokenAmountInLP - buyTokenAmount);
    const price = afterSolAmountInLP / (tokenAmountInLP - buyTokenAmount) * (solInfo ? solInfo.price : 1).toFixed(12)
    const marketcap = price * (tokenInfo?.totalSupply ? tokenInfo.totalSupply : 1000000000)

    return (
        <AdvancedModal isOpen={isOpen} onClose={onClose}>
            <div className="flex flex-col p-6 w-[550px] font-sans">
                <div className="flex items-center justify-center w-full h-auto px-5 py-3 rounded-t-md">
                    <div className="text-lg font-conthrax text-center font-medium text-white uppercase">
                        Simulation Result
                    </div>
                </div>
                <div className="flex flex-col w-full h-auto  md:py-0 rounded-b-md">
                    <div className="flex items-center justify-center">
                        <label className="block my-1 text-xs text-center">
                            Deposit at least the following amount of SOL into each Zombie wallet
                        </label>
                    </div>
                    <div className="mt-3">
                        <div className="flex justify-between gap-4">
                            <label className="my-1 text-sm text-white">
                                Please Deposit on Zombie wallet:
                            </label>
                            <div className="flex items-center gap-1 text-sm text-gray-normal">
                                {
                                    zombie.address ?
                                        ellipsisAddress(zombie.address) :
                                        "NOT SET"
                                }
                                {
                                    (copied["zombie_address"] ?
                                        (<svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 mx-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>) :
                                        (<FaRegCopy className="w-3.5 h-3.5 mx-1 transition ease-in-out transform cursor-pointer active:scale-95 duration-100" onClick={() => copyToClipboard("zombie_address", zombie.address ? zombie.address : "")} />))
                                }
                            </div>
                        </div>
                        <div className="w-full rounded-[10px] border-solid border border-[#2D3350] bg-[#111215] font-conthrax p-2 text-xs text-left font-bold text-yellow-normal">{zombieAmount} SOL</div>
                    </div>
                    <div className="mt-3">
                        <div className="flex justify-between gap-4">
                            <label className="my-1 text-sm text-white">
                                Token Bundle Amount*
                            </label>
                        </div>
                        <div className="w-full rounded-[10px] border-solid border border-[#2D3350] bg-[#111215] font-conthrax p-2 text-xs text-left font-bold text-yellow-normal">{buyTokenAmount}</div>
                    </div>
                    <div className="mt-3">
                        <div className="flex justify-between gap-4">
                            <label className="my-1 text-sm text-white">
                                Token Price After Bundle*
                            </label>
                        </div>
                        <div className="w-full rounded-[10px] border-solid border border-[#2D3350] bg-[#111215] font-conthrax p-2 text-xs text-left font-bold text-yellow-normal">{price} {solInfo ? "USD" : "SOL"}</div>
                    </div>
                    <div className="mt-3">
                        <div className="flex justify-between gap-4">
                            <label className="my-1 text-sm text-white">
                                Market Cap After Bundle*
                            </label>
                        </div>
                        <div className="w-full rounded-[10px] border-solid border border-[#2D3350] bg-[#111215] font-conthrax p-2 text-xs text-left font-bold text-yellow-normal">{formatNumber(marketcap)} {solInfo ? "USD" : "SOL"}</div>
                    </div>
                    <div className="mt-4 w-full flex gap-2">
                        <div className={`bg-gradient-blue-to-purple w-[50%] rounded-md p-[1px]`}>
                            <ExtendedButton className={`bg-black gap-2 !h-10 w-full font-conthrax uppercase text-xxs`} onClick={handleDownloadSimuation}>
                                Download Simulation
                                <img src="/assets/icon/ic_download.svg" width={16} alt="download" />
                            </ExtendedButton>
                        </div>
                        <div className={`bg-gradient-blue-to-purple w-[50%] rounded-md p-[1px]`}>
                            <ExtendedButton className={`bg-black gap-2 !h-10 w-full font-conthrax uppercase text-xxs`} onClick={handleSimulateAgain}>
                                Simulate Again
                                <img src="/assets/icon/ic_bundle_again.svg" width={16} alt="simulate" />
                            </ExtendedButton>
                        </div>
                    </div>
                    <div className="mt-2 w-full">
                        <div className={`bg-gradient-blue-to-purple rounded-md p-[1px]`}>
                            <ExtendedButton className={`bg-black/50 !h-10 w-full font-conthrax uppercase text-xxs`} onClick={handleDisperseSOL}>
                                Disperse SOL
                            </ExtendedButton>
                        </div>
                    </div>
                    <div className="mt-2 w-full">
                        <div className={`bg-gradient-blue-to-purple rounded-md p-[1px]`}>
                            <ExtendedButton className={`bg-black/50 gap-2 !h-10 w-full font-conthrax uppercase text-xxs`} onClick={handleBundle}>
                                Mint & Buy
                                <img src="/assets/icon/ic_launch.svg" className="w-4 h-4" alt="launch" />
                            </ExtendedButton>
                        </div>
                    </div>
                </div>
            </div>
        </AdvancedModal>
    );
}
