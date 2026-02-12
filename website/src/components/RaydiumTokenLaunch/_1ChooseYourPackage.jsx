import { createPortal } from "react-dom";
import { useContext, useEffect, useState } from "react";
import { PAYMENT_OPTIONS } from "../../config/env";
import { Listbox } from "@headlessui/react";
import { AppContext } from "../../App";
import { IoIosArrowDown } from "react-icons/io";
import { toast } from "react-toastify";
import { FaRegCopy } from "react-icons/fa";
import AdvancedModal from "../Dialogs/AdvancedModal";
import axios from "axios";
// import { checkActivePool, ellipsisAddress, getPairAddress } from "../../utils/methods";
import { MdWarning } from "react-icons/md";
import { ellipsisAddress } from "../../utils/methods";
import { checkAuthority, checkOpenBookMarket } from "../../utils/solana";
import { useConnection } from "@solana/wallet-adapter-react";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { mark, targetedTexts } from "../../config/themeConfig";

export default function _1ChooseYourPackage(props) {
    const { selectedProject, setSelectedProject, step, setStep, onCancel, type } = props;
    const {
        SERVER_URL,
        currentProject,
        loadAllProjects,
        projects,
        sigData,
        signingData,
        setLoadingPrompt,
        setOpenLoading,
    } = useContext(AppContext);
    const [payPackage, setPayPackage] = useState(2);
    const [projectName, setProjcectName] = useState("");

    const [isActivated, setIsActivated] = useState(false);
    const { connection } = useConnection();

    const [isOpenPaymentCheck, setIsOpenPaymentCheck] = useState(false);
    const [depositWallet, setDepositWallet] = useState("");
    const [expireTime, setExpireTime] = useState(-1);
    const [intervalId, setIntervalId] = useState(null);
    const [ptAmount, setPtAmount] = useState(0)
    const [copied, setCopied] = useState(false);
    const expireTimeMin = Math.floor(expireTime / 60000);
    const expireTimeSec = Math.floor(expireTime / 1000) % 60;

    const [isConfirmed, setIsConfirmed] = useState(false);

    const handleCreateNewProject = async (name, tokenAddress, payPackage, platform) => {
        console.log("Creating new project...", name);
        setOpenLoading(true);
        setLoadingPrompt("Creating new project...");
        try {
            const { data } = await axios.post(`${SERVER_URL}/api/v1/project/create`,
                {
                    name: name,
                    paymentId: payPackage,
                    address: tokenAddress,
                    platform,
                    signingData,
                    sigData
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            setOpenLoading(false);
            return {
                projectId: data.project._id,
                depositWallet: data.project.depositWallet.address,
                projectTokenAmount: data.project.projectTokenAmount,
                expireTime: data.expireTime,
                qrcode: data.project.qrcode
            };
        }
        catch (err) {
            setOpenLoading(false);
            return { error: err };
        }
    };

    const handleCheckNewProject = async (projectId) => {
        console.log("Checking new project...", projectId);
        try {
            const { data } = await axios.post(`${SERVER_URL}/api/v1/project/check-status`,
                {
                    projectId,
                    sigData,
                    signingData
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
            if (data.success) {
                return {
                    activated: true,
                };
            }
            else {
                return {
                    expired: data.expired,
                    expireTime: data.expireTime,
                }
            }
        }
        catch (err) {
            return { error: err };
        }
    };

    const handleCheck = (projectId) => {
        const id = setInterval(async () => {
            console.log("Checking...", projectId);
            const data = await handleCheckNewProject(projectId);
            if (data.activated) {
                clearInterval(id);
                setIntervalId(null);
                setIsActivated(true);
                setIsOpenPaymentCheck(false);
                setIsConfirmed(true);
                await loadAllProjects(projectId);
            } else if (data.expired || data.error) {
                clearInterval(id);
                setIntervalId(null);
                setIsActivated(false);
                setIsOpenPaymentCheck(false);
                setIsConfirmed(true);
            } else
                setExpireTime(data.expireTime);
        }, 1000);
        setIntervalId(id);
    };

    const handleContinue = async () => {
        if (!selectedProject.paymentId) {
            if (payPackage > 0 && projectName.trim() == "") {
                toast.warn("Please input project name!");
                return;
            }

            const data = await handleCreateNewProject(projectName.trim(), selectedProject.token?.address, payPackage, type);
            if (!data.error) {
                setDepositWallet(data.depositWallet);
                setExpireTime(data.expireTime);
                // setQrcode(data.qrcode);
                setPtAmount(data.projectTokenAmount);
                handleCheck(data.projectId);
                setIsOpenPaymentCheck(true);
            } else {
                console.log(data.error);
                toast.warn("Failed to create new project");
            }
        } else {
            if (!selectedProject.token.address || selectedProject.token.address === "") {
                setStep(1);
            } else {
                if (type == "raydium" || type == "raydium-fair" || type == "token-2022") {
                    setLoadingPrompt("Checking Authority...");
                    setOpenLoading(true);
                    const authorityCheck = await checkAuthority(connection, selectedProject.token.address, type == "token-2022" ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID);
                    setOpenLoading(false);
                    console.log(authorityCheck)
                    selectedProject.token.freezeAuthorityRevoked = authorityCheck.freezeAuthorityRevoked;
                    selectedProject.token.mintAuthorityRevoked = authorityCheck.mintAuthorityRevoked;

                    if (type != "token-2022") {
                        setLoadingPrompt("Checking OpenBook MarketID...");
                        setOpenLoading(true);
                        const { marketId } = await checkOpenBookMarket(connection, selectedProject.token.address, "So11111111111111111111111111111111111111112");
                        setOpenLoading(false);

                        if (marketId != null) {
                            selectedProject.token.marketId = marketId;
                            setStep(4);
                            return;
                        }
                    }

                    if (authorityCheck.freezeAuthorityRevoked == true && authorityCheck.mintAuthorityRevoked == true) {
                        setStep(3);
                    } else if (type == "token-2022" && authorityCheck.mintAuthorityRevoked == true) {
                        setStep(3);
                    } else {
                        setStep(2);
                    }
                } else {
                    setStep(2);
                }
            }
        }
    }

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

    const handleBack = () => {
        if (intervalId) {
            clearInterval(intervalId);
            setIntervalId(null);
        }
        onCancel && onCancel();
        // reset();
    };

    const handleDone = () => {
        setIsConfirmed(false);
        if (intervalId) {
            clearInterval(intervalId);
            setIntervalId(null);
        }
        if (selectedProject.template == "Custom") {
            setStep(p => p + 2)
        } else {
            setStep(p => p + 1);
        }
    };

    const handleCancel = () => {
        setIsConfirmed(false);
        if (intervalId) {
            clearInterval(intervalId);
            setIntervalId(null);
        }
        // onCancel();
        // reset();
    };

    const handleRetry = () => {
        setIsConfirmed(false);
        if (intervalId) {
            clearInterval(intervalId);
            setIntervalId(null);
        }
        // reset();
    };

    return (
        <div className="mx-auto w-[600px] flex flex-col gap-6">            
            <div className="w-full flex flex-col items-start">
                <span className="w-full font-conthrax text-left">Continue with Saved Project</span>
                <div className="w-full relative">
                    <Listbox value={selectedProject} onChange={setSelectedProject}>
                        <Listbox.Button
                            className="col-span-10 outline-none border border-gray-border text-white placeholder:text-gray-border text-xs rounded-xl px-2.5 bg-transparent w-full h-button mt-1 disabled:border-gray-highlight disabled:text-gray-border relative pr-7"
                        >
                            <span className="flex items-center">
                                <span className="block truncate">
                                    {selectedProject.name}
                                </span>
                            </span>
                            <IoIosArrowDown className="absolute inset-y-0 -right-1 flex items-center w-8 pr-2 mt-2.5 pointer-events-none opacity-50" />
                        </Listbox.Button>
                        <Listbox.Options className="absolute z-20 w-full overflow-auto text-xs border border-t-0 text-gray-normal mt bg-gray-dark border-gray-border">
                            {
                                (
                                    (currentProject.platform == type && currentProject.paymentId != 0) ? [{ ...currentProject }, { name: "New Project" }] : [{ name: "New Project" }]
                                ).map((item, index) => {
                                    console.log(item)
                                    return (
                                        <Listbox.Option key={index}
                                            className={`relative px-2 py-1 cursor-default hover:bg-gray-border ${item.name === selectedProject.name && "text-white"}`}
                                            value={item}
                                        >
                                            <div className="flex items-center">
                                                <span className="block font-normal truncate">
                                                    {item.name}
                                                </span>
                                            </div>
                                        </Listbox.Option>
                                    );
                                })
                            }
                        </Listbox.Options>
                    </Listbox>
                </div>
            </div>
            {(selectedProject.paymentId == null) && <div className="w-full flex flex-col items-start">
                <span className="w-full font-conthrax text-left">Project Name</span>
                <input
                    className="token-deploy-input rounded-xl outline-none text-white placeholder:text-gray-border px-2.5 w-full h-8 mt-1"
                    placeholder="Project name"
                    value={projectName}
                    onChange={(e) => setProjcectName(e.target.value)}
                />
            </div>}
            <div className="w-full flex gap-3">
                <button
                    className="w-[50%] h-button grow rounded-lg justify-center items-center gap-1 inline-flex active:scale-95 transition duration-100 ease-in-out transform border border-solid border-gray-border focus:outline-none text-xs font-conthrax font-medium text-center text-white uppercase disabled:text-gray-border disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    onClick={() => setStep(p => p > 1 && p - 1)}>
                    Cancel
                </button>
                <button
                    className="w-[50%] h-button grow rounded-lg justify-center items-center gap-1 inline-flex bg-green-button active:scale-95 transition duration-100 ease-in-out transform focus:outline-none text-xs font-conthrax font-medium text-center text-white uppercase disabled:text-white disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    onClick={handleContinue}
                >
                    Continue
                </button>
            </div>
            {
                createPortal(
                    <AdvancedModal isOpen={isOpenPaymentCheck} onClose={() => setIsOpenPaymentCheck(false)}>
                        <div className="w-[450px] p-8 mx-auto">
                            <div className="mx-auto font-conthrax text-base">Make Payment</div>
                            <div className="mt-6 bg-[#202020] p-6 rounded-md">
                                <div className={`font-conthrax capitalize ${payPackage == 1 ? "text-gradient-silver" : payPackage == 2 ? "text-gradient-gold" : "text-gradient-diamond"}`}>{PAYMENT_OPTIONS[payPackage].title} Package</div>
                                <div className={`mt-1 font-conthrax text-2xl ${payPackage == 1 ? "text-gradient-silver" : payPackage == 2 ? "text-gradient-gold" : "text-gradient-diamond"}`}>{`${ptAmount ? parseFloat(ptAmount.toFixed(3)) : 0} ${payPackage === 0 ? targetedTexts.coin_symbol : "SOL"}`}</div>
                                <div className="mt-3">
                                    <div className="text-gray-500 text-md">Make Payment to Deposit Address</div>
                                </div>
                                <div className="flex items-center justify-center gap-2 mt-3">
                                    <div className="max-w-[80%] w-[80%] text-sm text-white truncate">{depositWallet}</div>
                                    {
                                        (copied["address"] ?
                                            (<svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 mx-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>) :
                                            (<FaRegCopy className="w-3.5 h-3.5 transition ease-in-out transform cursor-pointer active:scale-95 duration-100 text-gray-normal" onClick={() => copyToClipboard("address", depositWallet)} />))
                                    }
                                </div>
                            </div>
                            <div className="mt-4">
                                <div className="text-gray-200 px-4 mx-auto mt-2">
                                    {targetedTexts.package_payment}
                                </div>
                            </div>
                            {
                                expireTime > 0 &&
                                <p className="m-auto flex items-center gap-0.5 text-sm font-normal text-center justify-between text-gray-normal mt-4">
                                    <img src="/assets/spinner-white.svg" className="w-7 h-7" alt="spinner" />
                                    Expires in <span className="border border-solid border-gray-normal rounded-md p-2 text-white">{expireTimeMin}</span> minutes <span className="border border-solid border-gray-normal rounded-md p-2 text-white">{expireTimeSec}</span> seconds
                                </p>
                            }
                            <div className="flex justify-center mt-7">
                                <button
                                    className="w-full h-button grow rounded-lg justify-center items-center gap-1 inline-flex border border-solid border-gray-border active:scale-95 transition duration-100 ease-in-out transform focus:outline-none text-xs font-conthrax font-medium text-center text-white uppercase disabled:text-gray-border disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                    onClick={handleBack}>
                                    Back
                                </button>
                            </div>
                        </div>
                    </AdvancedModal>,
                    document.getElementById("root")
                )
            }
            {
                createPortal(
                    <AdvancedModal isOpen={isConfirmed}>
                        <div className="p-4">
                            <div className="">
                                {
                                    isActivated ?
                                        (<div
                                            className="relative flex flex-col items-center gap-4"
                                        >
                                            <div className="absolute mx-auto -top-16 w-[200px] h-[200px] rounded-[200px] bg-[rgba(31,222,0,0.2)] blur-[100px]" />
                                            <img className="" src="/assets/img/payment-success.svg" width={200} alt="" />
                                            <p className="flex items-center justify-center gap-2 my-5 text-lg font-conthrax font-bold text-center uppercase text-white">
                                                Payment Successful
                                            </p>
                                        </div>) :
                                        (<div
                                            className="relative flex flex-col items-center gap-4"
                                        >
                                            <div className="absolute mx-auto -top-16 w-[200px] h-[200px] rounded-[200px] bg-[rgba(222,31,0,0.2)] blur-[100px]" />
                                            <MdWarning color="red" size={100} />
                                            <p className="flex items-center justify-center gap-2 my-5 text-lg font-conthrax font-bold text-center uppercase text-white">
                                                Payment Failed
                                            </p>
                                        </div>)
                                }
                            </div>
                            {
                                isActivated ?
                                    (
                                        <div className="flex justify-center">
                                            <button
                                                className="w-full h-button grow rounded-lg justify-center items-center gap-1 inline-flex bg-gradient-blue-to-purple active:scale-95 transition duration-100 ease-in-out transform focus:outline-none text-xs font-conthrax font-medium text-center text-white uppercase disabled:text-gray-border disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                                onClick={handleDone}>
                                                Continue
                                            </button>
                                        </div>
                                    ) :
                                    (
                                        <div className="flex justify-center gap-5">
                                            <button
                                                className="pl-3 pr-4 h-button grow rounded-lg justify-center items-center gap-1 inline-flex border border-solid border-gray-border active:scale-95 transition duration-100 ease-in-out transform focus:outline-none text-xs font-conthrax font-medium text-center text-white uppercase disabled:text-gray-border disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                                onClick={handleCancel}>
                                                Cancel
                                            </button>
                                            <button
                                                className="pl-3 pr-4 h-button grow rounded-lg justify-center items-center gap-1 inline-flex bg-gradient-blue-to-purple active:scale-95 transition duration-100 ease-in-out transform focus:outline-none text-xs font-conthrax font-medium text-center text-white uppercase disabled:text-gray-border disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                                onClick={handleRetry}>
                                                Retry
                                            </button>
                                        </div>
                                    )
                            }

                        </div>
                    </AdvancedModal>,
                    document.getElementById("root")
                )
            }
        </div>
    )
}