import { useContext, useState, useCallback } from "react";

import spinner from "../assets/images/spinner.svg"
import markDescriptionIcon from "../assets/images/mark-description.png"

import { AppContext } from "../App";
import { toast } from "react-toastify";
import { Popover, Transition } from '@headlessui/react';
import { useWalletMultiButton } from "@solana/wallet-adapter-base-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { FaRegCopy, FaSignOutAlt, FaWallet } from "react-icons/fa";
import { Fragment } from "react";

import Modal from "../components/Base/Modal";
import { mark, targetedTexts,  } from "../config/themeConfig";

const imageURL = {
    "Phantom": "/assets/wallets/phantom.svg",
    "OKX Wallet": "/assets/wallets/okx.svg",
    "Trust": "/assets/wallets/trust.svg",
    "MathWallet": "/assets/wallets/mathwallet.svg",
    "TokenPocket": "/assets/wallets/tokenpocket.svg",
    "Coinbase Wallet": "/assets/wallets/coinbase.svg",
    "Coin98": "/assets/wallets/coin98.svg",
    "SafePal": "/assets/wallets/safepal.svg",
    "Bitpie": "/assets/wallets/bitpie.svg",
    "Clover": "/assets/wallets/clover.svg",
    "Coinhub": "/assets/wallets/coinhub.svg",
    "WalletConnect": "/assets/wallets/walletconnect.svg",
}

export default function HomePage() {

    const siteKey = import.meta.env.VITE_CLOUDFLARE_SITEKEY

    const {
        signWallet,
        signPending
    } = useContext(AppContext);

    const [copied, setCopied] = useState(false);
    const [walletModalConfig, setWalletModalConfig] = useState(null);
    const { buttonState, onConnect, onDisconnect, onSelectWallet } = useWalletMultiButton({ onSelectWallet: setWalletModalConfig });
    const { publicKey, connected, wallet } = useWallet();

    const getEllipsisAddress = (address) => {
        return address?.slice(0, 5) + "..." + address?.slice(-5);
    };

    let label = "";
    switch (buttonState) {
        case "connected":
            if (connected)
                label = getEllipsisAddress(publicKey.toBase58());
            else
                label = "Disconnect";
            break;
        case "connecting":
            label = "Connecting";
            break;
        case "disconnecting":
            label = "Disconnecting";
            break;
        case "has-wallet":
            label = "Connect";
            break;
        case "no-wallet":
            label = "Select Wallet";
            break;
        default:
            break;
    }

    const copyToClipboard = async (text) => {
        if ('clipboard' in navigator) {
            await navigator.clipboard.writeText(text);
            toast.success("Copied");
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
        else
            console.error('Clipboard not supported');
    };

    const handleClick = useCallback(() => {
        console.log("Connect button clicked:", buttonState);
        switch (buttonState) {
            case 'connected':
                signWallet();
                break;
            case 'connecting':
            case 'disconnecting':
                break;
            case 'has-wallet':
                onConnect();
                break;
            case 'no-wallet':
                onSelectWallet();
                break;
            default:
                break;
        }
    }, [buttonState, onConnect, onSelectWallet]);

    return (
        <div className="w-full flex flex-col">
            <div className="flex items-center justify-between py-4 px-8 shadow-xl bg-gray-dark">
                <div className="flex gap-2 items-center text-2xl font-medium">
                    <img className="w-auto h-12" src={mark} alt="logo" />
                    {targetedTexts.name}
                </div>
                <div>
                    {
                        connected && publicKey &&
                        <button className="w-[150px] flex gap-2 items-center justify-center bg-blue-900 rounded-md text-base py-2 px-4" onClick={signWallet} disabled={signPending}>
                            {signPending && <img src={spinner} className="w-6 h-6" />}
                            Sign In
                        </button>
                    }
                    {!connected && <div className="bg-blue-900 p-px w-full rounded-md text-base">
                        <button className="w-[150px] bg-black hover:bg-gray-dark py-2 px-4 rounded-md"
                            disabled={buttonState === "connecting" || buttonState === "disconnecting"}
                            onClick={handleClick}>
                            {label}
                        </button>
                    </div>}
                </div>
            </div>
            <div className="mx-auto w-[1300px] flex flex-col items-center justify-center px-10">
                <div className="mt-20 w-full flex items-center gap-8">
                    <div className="flex-1 flex flex-col gap-4">
                        <div className="text-left font-bold text-[40px] leading-tight" style={{ fontFamily: "Conthrax-SB" }}>
                            {targetedTexts.title}
                        </div>
                        <p className="text-lg text-left">{targetedTexts.title_description}</p>
                    </div>
                    <div className="flex-1">
                        {/* <img className="w-fit h-[100px]" src={mark} alt="logo" /> */}
                    </div>
                </div>

                <div className="w-[100px] flex flex-col mt-2 gap-2">
                    {
                        walletModalConfig &&
                        (
                            <Modal isOpen={walletModalConfig !== null} onClose={() => setWalletModalConfig(null)}>
                                <div className="flex flex-col pt-5 w-[240px] font-sans">
                                    <div className="px-5 py-3 font-sans text-sm font-medium text-center text-white uppercase rounded-t-md bg-gray-highlight">
                                        Connect wallet
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 px-5 py-5 bg-gray-dark rounded-b-md text-gray-normal">
                                        {
                                            walletModalConfig.wallets.slice(0, 1).map((item, index) => {
                                                return (
                                                    <div key={index} className="col-span-1 relative cursor-pointer hover:bg-[#ffffff05] hover:text-white">
                                                        <div className="flex flex-col items-center justify-center h-full gap-2 p-3 transition-all ease-in-out rounded-md hover:bg-gray-highlight"
                                                            onClick={() => {
                                                                walletModalConfig.onSelectWallet(item.adapter.name);
                                                                setWalletModalConfig(null);
                                                            }}>
                                                            <img src={imageURL[item.adapter.name]} alt="none" className="w-10 h-10 rounded-md" />
                                                            <p className="leading-none text-center">
                                                                {item.adapter.name}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        }
                                    </div>
                                </div>
                            </Modal>
                        )
                    }
                </div>
                <div className="flex flex-row mt-2">
                    <div
                        className="cf-turnstile"
                        data-sitekey={siteKey}
                        data-callback="javascriptCallback"
                    ></div>
                </div>
            </div>
            <div className="text-white text-[14px] tracking-wider fixed bottom-2 left-0 right-0">{targetedTexts.copyright}</div>
        </div>
    )
}