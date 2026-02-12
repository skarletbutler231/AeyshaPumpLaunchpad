/* eslint-disable no-unused-vars */
/* eslint-disable react/jsx-key */
/* eslint-disable react/prop-types */
import { useContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { FaCheck, FaExclamationTriangle, FaRegCopy } from "react-icons/fa";
import { Listbox, Select } from "@headlessui/react";
import { IoIosArrowDown } from "react-icons/io";

import { AppContext } from "../../App";

import Modal from "./Modal";
import * as ENV from "../../config/env"
import memeMark from '../../assets/imgs/mark.png';
import { ellipsisAddress, isValidAddress, sleep } from "../../utils/methods"
import axios from "axios";
import "../../styles/font.css";
import InstructionPopupDialog from "./InstructionPopupDialog";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

export default function NewProjectDialog({ isOpen, createProject, checkProject, onDone, onCancel, initialData }) {

    const {
        SERVER_URL,
        projects,
        setLoadingPrompt,
        setOpenLoading,
        sigData,
        signingData
    } = useContext(AppContext);

    const { connection } = useConnection();
    const { connected, publicKey, signAllTransactions } = useWallet()

    const [step, setStep] = useState(0);
    const [projectName, setProjectName] = useState("");
    const [platform, setPlatform] = useState("raydium");
    const [creating, setCreating] = useState(false);
    const [depositWallet, setDepositWallet] = useState("");
    const [expireTime, setExpireTime] = useState(-1);
    const [intervalId, setIntervalId] = useState(null);
    const [createByOwner, setCreateByOwner] = useState(false);

    // for package selection dropdown
    const [toggle, setToggle] = useState(false);
    const [payPackage, setPayPackage] = useState(0)
    const [tokenAddress, setTokenAddress] = useState("")

    const steps =
        [
            "Create",
            "Activate",
            "Completed",
        ];
    // qrcode
    // const [qrcode, setQrcode] = useState ("")
    const [ptAmount, setPtAmount] = useState(0)
    const [copied, setCopied] = useState(false);
    const [showInstructionDialog, setShowInstructionDialog] = useState(false);

    const expireTimeMin = Math.floor(expireTime / 60000);
    const expireTimeSec = Math.floor(expireTime / 1000) % 60;

    useEffect(() => {
        const checkMode = async () => {
            const { data } = await axios.post(`${ENV.SERVER_URL}/api/v1/project/check-create-mode`,
                {
                    sigData,
                    signingData
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
            setCreateByOwner(data.createByOwner);
        }
        checkMode();
        console.log("init call")
    }, [])

    useEffect(() => {
        if (!isOpen) {
            setStep(-1);
            setProjectName("");
            setTokenAddress("");
        }
    }, [isOpen])

    const handleDone = () => {
        if (intervalId) {
            clearInterval(intervalId);
            setIntervalId(null);
        }
        onDone();
        // reset();
    };

    const handleCancel = () => {
        if (intervalId) {
            clearInterval(intervalId);
            setIntervalId(null);
        }
        onCancel();
        // reset();
    };

    const handleRetry = () => {
        if (intervalId) {
            clearInterval(intervalId);
            setIntervalId(null);
        }
        // reset();
    };

    const handleCheck = (projectId) => {
        const id = setInterval(async () => {
            console.log("Checking...", projectId);
            const data = await checkProject(projectId);
            if (data.activated) {
                clearInterval(id);
                setIntervalId(null);
                setStep(3);
            }
            else if (data.expired || data.error) {
                clearInterval(id);
                setIntervalId(null);
                setStep(4);
            }
            else
                setExpireTime(data.expireTime);
        }, 1000);
        setIntervalId(id);
    };

    const handleCreate = async () => {
        if (Number(payPackage) > 0 && !isValidAddress(tokenAddress)) {
            toast.warn("Please enter a token address!")
            return
        }
        setCreating(true);
        try {
            const data = await createProject(projectName, tokenAddress, payPackage, platform);
            if (!data.error) {
                setStep(2);
                setDepositWallet(data.depositWallet);
                setExpireTime(data.expireTime);
                // setQrcode(data.qrcode)
                setPtAmount(data.projectTokenAmount);
                handleCheck(data.projectId);
            }
            else {
                console.log(data.error);
                toast.warn("Failed to create new project");
            }
        }
        catch (err) {
            console.log(err);
        }
        setCreating(false);
    };

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

    return (
        <Modal isOpen={isOpen}>
            <div className="flex flex-col pt-5 font-sans rounded-lg bg-gradient-to-b from-gray-light to-gray-highlight">
                <div className="items-center w-full h-auto px-5 py-5 md:py-0 ">
                    {
                        step === -1 ?
                            <div className="flex flex-col items-start gap-1">
                                <div className="text-base">New Project</div>
                                <div className="text-xs">Choose Your Package</div>
                            </div> :
                            <div className={`flex ${step !== 0 && 'flex-col'} justify-between items-center gap-4`}>
                                <div className="text-base text-[#4B65F1]">New Project</div>
                                <ul className="relative flex flex-row px-3 gap-x-2">
                                    {
                                        steps.map((item, index) => {
                                            return (
                                                <li key={index} className={`flex ${index < 3 ? "flex-1" : ""} items-start shrink basis-0`}>
                                                    <span className="flex flex-col items-center text-xs align-middle min-w-7 min-h-7">
                                                        <span className={`flex items-center text-sm justify-center flex-shrink-0 font-bold rounded-full size-7 ${index <= step ? (step === 3 && index === 2 ? "text-white bg-gradient-blue-to-purple" : "text-gray-dark bg-gradient-blue-to-purple") : "text-gray-normal bg-gray-highlight"}`}>
                                                            {
                                                                step === steps.length - 1 && index === steps.length - 1 ?
                                                                    (
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mx-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                                        </svg>
                                                                    ) :
                                                                    step === 4 && index === steps.length - 1 ?
                                                                        (
                                                                            <svg xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                                                <path d="M18 6 6 18"></path>
                                                                                <path d="m6 6 12 12"></path>
                                                                            </svg>
                                                                        ) :
                                                                        (
                                                                            <span className="">
                                                                                {index + 1}
                                                                            </span>
                                                                        )
                                                            }

                                                            <svg className="flex-shrink-0 hidden size-3"
                                                                xmlns="http://www.w3.org/2000/svg"
                                                                width="24"
                                                                height="24"
                                                                viewBox="0 0 24 24"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                strokeWidth="3"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round">
                                                                <polyline points="20 6 9 17 4 12" />
                                                            </svg>
                                                        </span>
                                                        <span className={`text-xxs text-nowrap font-medium ${index <= step ? index === step ? "text-white" : "text-[#02FCFF]" : "text-gray-500"}`}>
                                                            {step === 4 && index === steps.length - 1 ? "Failed" : item}
                                                        </span>
                                                    </span>
                                                    {index < steps.length - 1 && <div className={`"flex-1 mt-3.5 w-8 h-px ${index + 1 <= step ? "bg-gradient-blue-to-purple" : "bg-gray-border"}`} />}
                                                </li>
                                            );
                                        })
                                    }
                                </ul>
                            </div>
                    }
                    {
                        step === -1 &&
                        <div className="my-6">
                            <div className="flex items-center justify-center gap-3 my-5">
                                <button
                                    className="w-[50%] h-button grow rounded-lg justify-center items-center gap-1 inline-flex active:scale-95 transition duration-100 ease-in-out transform border border-solid border-gray-border focus:outline-none text-xs font-medium text-center text-white uppercase disabled:text-gray-border disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                    onClick={handleCancel}>
                                    Cancel
                                </button>
                                <button
                                    className="w-[50%] h-button grow rounded-lg justify-center items-center gap-1 inline-flex bg-gradient-blue-to-purple active:scale-95 transition duration-100 ease-in-out transform focus:outline-none text-xs font-medium text-center text-white uppercase disabled:text-white disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                    onClick={() => { console.log(payPackage); setStep(1) }}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    }
                    <div className="my-6">
                        {
                            step === 1 &&
                            (
                                <div className="flex flex-col">
                                    <div className="grid grid-cols-12 mt-4">
                                        {
                                            payPackage > 0 &&
                                            <>
                                                <div className="col-span-4 flex flex-row items-center justify-end text-xs uppercase text-gray-normal">
                                                    Token Address<span className="pl-1 text-dark-pink">:&nbsp;&nbsp;</span>
                                                </div>
                                                <input
                                                    className="col-span-8 rounded-xl outline-none border border-gray-border text-white placeholder:text-gray-border text-sm px-2.5 bg-transparent w-full h-button mt-1"
                                                    placeholder="Enter Address"
                                                    value={tokenAddress}
                                                    onChange={(e) => setTokenAddress(e.target.value)}
                                                />
                                            </>
                                        }
                                    </div>
                                    <div className="grid grid-cols-12 mt-4">
                                        <div className="col-span-4 flex flex-row items-center justify-end text-xs uppercase text-gray-normal">
                                            Project Name<span className="pl-1 text-dark-pink">:&nbsp;&nbsp;</span>
                                        </div>
                                        <input
                                            className="col-span-8 rounded-xl outline-none border border-gray-border text-white placeholder:text-gray-border text-sm px-2.5 bg-transparent w-full h-button mt-1"
                                            placeholder="Enter Name"
                                            onChange={(e) => setProjectName(e.target.value)}
                                        />
                                    </div>
                                    <div className="grid grid-cols-12 mt-4">
                                        {
                                            payPackage > 0 &&
                                            <>
                                                <div className="col-span-4 flex flex-row items-center justify-end text-xs uppercase text-gray-normal">
                                                    Platform<span className="pl-1 text-dark-pink">:&nbsp;&nbsp;</span>
                                                </div>
                                                <div className="col-span-8 relative">
                                                    <Select
                                                        className="rounded-xl outline-none border border-gray-border text-white placeholder:text-gray-border text-sm px-2.5 bg-transparent w-full h-button mt-1"
                                                        onChange={(e) => setPlatform(e.target.value)}
                                                    >
                                                        <option value="raydium" className="bg-gray-highlight text-white">Raydium</option>
                                                        <option value="pump.fun" className="bg-gray-highlight text-white">Pump.fun</option>
                                                    </Select>
                                                </div>
                                            </>
                                        }
                                    </div>
                                    <div className="flex items-center justify-center gap-3 my-5">
                                        <button
                                            className="w-full h-button grow rounded-lg justify-center items-center gap-1 inline-flex border border-solid border-gray-border active:scale-95 transition duration-100 ease-in-out transform focus:outline-none text-xs font-medium text-center text-white uppercase disabled:text-gray-border disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                            disabled={creating}
                                            onClick={handleCancel}>
                                            Cancel
                                        </button>
                                        <button
                                            className="w-full h-button grow rounded-lg justify-center items-center gap-1 inline-flex bg-gradient-blue-to-purple active:scale-95 transition duration-100 ease-in-out transform focus:outline-none text-xs font-medium text-center text-white uppercase disabled:text-white disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                            onClick={handleCreate} disabled={creating || projectName === "" || (payPackage > 0 && !isValidAddress(tokenAddress))}
                                        >
                                            {creating ?
                                                <img src="/assets/spinner-white.svg" className="w-10 h-10" alt="spinner" /> :
                                                "Create"
                                            }
                                        </button>
                                    </div>
                                </div>
                            )
                        }
                        {
                            step === 2 &&
                            (
                                <div className="!w-[400px] mx-auto">
                                    <div className="flex items-center justify-center">
                                        <img src="/assets/spinner-white.svg" className="w-7 h-7" alt="spinner" />
                                        <label className="block text-sm text-gray-normal">
                                            Pending activation by administrator...
                                        </label>
                                    </div>
                                    {!createByOwner && <div className="mt-4">
                                        <div className="text-white text-xl">Payment</div>
                                        <div className="text-gray-500 text-md">Please Connect Wallet and Deposit</div>
                                        <div className="text-blue-primary text-xl">{`${ptAmount ? parseFloat(ptAmount.toFixed(3)) : 0} SOL`}</div>
                                    </div>}
                                    {/* <div className="mt-4">
                                        <img src={qrcode} className="mx-auto w-[100px] h-[100px]" />
                                    </div> */}
                                    {!createByOwner && <div className="flex items-center justify-center gap-2 mt-3">
                                        <div className="text-sm text-gray-normal">
                                            Address:&nbsp;
                                            <span className="pl-1 text-white">
                                                {
                                                    depositWallet !== "" ?
                                                        ellipsisAddress(depositWallet) :
                                                        "0x1234...5678"
                                                }
                                            </span>
                                        </div>
                                        {
                                            (copied["address"] ?
                                                (<svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 mx-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>) :
                                                (<FaRegCopy className="w-3.5 h-3.5 transition ease-in-out transform cursor-pointer active:scale-95 duration-100 text-gray-normal" onClick={() => copyToClipboard("address", depositWallet)} />))
                                        }
                                    </div>}
                                    {!createByOwner && <div className="mt-7">
                                        <div className="text-gray-200 text-sm px-4 mx-auto mt-2">
                                            Bundler Package Supply Payment Will be Automatically Deducted From Your Bundle and Transferred to the MemeTools Team.
                                        </div>
                                    </div>}
                                    {
                                        expireTime > 0 &&
                                        <p className="m-auto text-sm font-normal text-center text-gray-normal mt-4">
                                            Expires in <span className="pl-1 text-lg text-white">{expireTimeMin}</span> minutes <span className="pl-1 text-lg text-white">{expireTimeSec}</span> seconds
                                        </p>
                                    }
                                    {/* <div className="flex items-center justify-center gap-2">
                                        <div className="text-sm text-gray-normal">
                                            Service Fee:&nbsp;
                                            <span className="pl-1 text-yellow-normal">1 ETH</span>
                                        </div>
                                        {
                                            (copied["fee"] ?
                                                (<svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 mx-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>) :
                                                (<FaRegCopy className="w-3.5 h-3.5 transition ease-in-out transform cursor-pointer active:scale-95 duration-100 text-gray-normal" onClick={() => copyToClipboard("fee", "1")} />))
                                        }
                                    </div> */}
                                    <div className="flex justify-center mt-7">
                                        <button
                                            className="w-full h-button grow rounded-lg justify-center items-center gap-1 inline-flex border border-solid border-gray-border active:scale-95 transition duration-100 ease-in-out transform focus:outline-none text-xs font-medium text-center text-white uppercase disabled:text-gray-border disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                            onClick={handleCancel}>
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )
                        }
                        {
                            (step === 3 || step === 4) &&
                            (
                                <div className="">
                                    <div className="">
                                        {
                                            step === 3 ?
                                                (<p className="flex items-center justify-center gap-2 my-5 text-lg font-bold text-center uppercase text-green-normal">
                                                    <FaCheck />
                                                    Success!
                                                </p>) :
                                                (<p className="flex items-center justify-center gap-2 my-5 text-lg font-bold text-center uppercase text-dark-pink">
                                                    <FaExclamationTriangle />
                                                    Failed!
                                                </p>)
                                        }
                                    </div>
                                    {
                                        step === 3 ?
                                            (
                                                <div className="flex justify-center">
                                                    <button
                                                        className="w-full h-button grow rounded-lg justify-center items-center gap-1 inline-flex bg-gradient-blue-to-purple active:scale-95 transition duration-100 ease-in-out transform focus:outline-none text-xs font-medium text-center text-white uppercase disabled:text-gray-border disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                                        onClick={handleDone}>
                                                        Done
                                                    </button>
                                                </div>
                                            ) :
                                            (
                                                <div className="flex justify-center gap-5">
                                                    <button
                                                        className="pl-3 pr-4 h-button grow rounded-lg justify-center items-center gap-1 inline-flex border border-solid border-gray-border active:scale-95 transition duration-100 ease-in-out transform focus:outline-none text-xs font-medium text-center text-white uppercase disabled:text-gray-border disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                                        onClick={handleCancel}>
                                                        Cancel
                                                    </button>
                                                    <button
                                                        className="pl-3 pr-4 h-button grow rounded-lg justify-center items-center gap-1 inline-flex bg-gradient-blue-to-purple active:scale-95 transition duration-100 ease-in-out transform focus:outline-none text-xs font-medium text-center text-white uppercase disabled:text-gray-border disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                                        onClick={handleRetry}>
                                                        Retry
                                                    </button>
                                                </div>
                                            )
                                    }

                                </div>
                            )
                        }
                    </div>
                </div>
            </div>
        </Modal>
    );
}
