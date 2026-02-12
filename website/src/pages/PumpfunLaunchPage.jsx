import TopBar from "../components/TopBar/TopBar";
import { useContext, useEffect, useRef, useState } from "react";
import { FaRegCopy } from "react-icons/fa";
import { AppContext } from "../App";
import _1ChooseYourPackage from "../components/RaydiumTokenLaunch/_1ChooseYourPackage";
import _2CreateSPLToken from "../components/RaydiumTokenLaunch/_2CreateSPLToken";
import _3SetAuthority from "../components/RaydiumTokenLaunch/_3SetAuthority";
import _4OpenBookMarket from "../components/RaydiumTokenLaunch/_4OpenBookMarket";
import { ellipsisAddress } from "../utils/methods";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import PumpfunMintSnipe from "../components/PumpfunBundle/PumpfunMintSnipe";

const PumpfunLaunchPage = () => {
    const { currentProject } = useContext(AppContext);
    const [selectedProject, setSelectedProject] = useState((currentProject.platform != 'pump.fun' || currentProject.paymentId == 0) ? { name: "New Project" } : { ...currentProject });
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState(0);
    const [confirmedStep, setConfirmedStep] = useState(0);
    const [copied, setCopied] = useState(false);
    const navigate = useNavigate();
    const dialogRef = useRef()

    useEffect(() => {
        if (step == 0)
            setSelectedProject((currentProject.platform != 'pump.fun' || currentProject.paymentId == 0) ? { name: "New Project" } : { ...currentProject });
        // setStep(0);
    }, [currentProject])

    useEffect(() => {
        if (step > confirmedStep) setConfirmedStep(step);
    }, [step])

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
        <div className="w-screen h-screen flex flex-col items-center overflow-auto">
            <TopBar noProject={true} />
            <div className="w-full h-[30%] grow flex flex-col gap-2 items-center">
                Pump.Fun Token Launch
                <div className="w-full h-[30%] grow px-10 pb-10 flex gap-12">
                    <ol class="relative min-w-[200px] h-full flex flex-col justify-between text-gray-500 border-e-2 border-gray-normal dark:border-gray-700 dark:text-gray-400">
                        <li class="me-6 cursor-pointer hover:bg-gray-weight" onClick={() => { confirmedStep >= 0 && setStep(0) }}>
                            <span class="absolute flex items-center justify-center w-8 h-8 bg-green-200 rounded-full -end-4 ring-4 ring-gray-normal dark:ring-gray-900 dark:bg-green-900">
                                <svg class="w-3.5 h-3.5 text-green-500 dark:text-green-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 12">
                                    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1 5.917 5.724 10.5 15 1.5" />
                                </svg>
                            </span>
                            <h3 class={`font-medium leading-tight text-sm ${confirmedStep == 0 ? "text-white" : "text-green-normal"} ${step == 0 && "brightness-125"}`}>Create Project</h3>
                            <p class="text-sm">{selectedProject && selectedProject.paymentId && `Package ${selectedProject.paymentId}`}</p>
                        </li>
                        <li class="me-6 cursor-pointer hover:bg-gray-weight" onClick={() => { confirmedStep >= 1 && setStep(1) }}>
                            <span class="absolute flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full -end-4 ring-4 ring-white dark:ring-gray-900 dark:bg-gray-700">
                                <svg class="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 16">
                                    <path d="M18 0H2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2ZM6.5 3a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3.014 13.021l.157-.625A3.427 3.427 0 0 1 6.5 9.571a3.426 3.426 0 0 1 3.322 2.805l.159.622-6.967.023ZM16 12h-3a1 1 0 0 1 0-2h3a1 1 0 0 1 0 2Zm0-3h-3a1 1 0 1 1 0-2h3a1 1 0 1 1 0 2Zm0-3h-3a1 1 0 1 1 0-2h3a1 1 0 1 1 0 2Z" />
                                </svg>
                            </span>
                            <h3 class={`font-medium leading-tight text-sm ${confirmedStep == 1 ? "text-white" : confirmedStep > 1 && "text-green-normal"} ${step == 1 && "brightness-125"}`}>Prepare Token</h3>
                            {
                                selectedProject && selectedProject.paymentId &&
                                <p class="flex gap-2 justify-center items-center text-sm">
                                    {ellipsisAddress(selectedProject.token.address)}
                                    {
                                        (copied["address"] ?
                                            (<svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 mx-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>) :
                                            (<FaRegCopy className="w-3.5 h-3.5 transition ease-in-out transform cursor-pointer active:scale-95 duration-100 text-gray-normal" onClick={() => copyToClipboard("address", selectedProject.token.address)} />))
                                    }
                                </p>
                            }
                        </li>
                        <li class="me-6 cursor-pointer hover:bg-gray-weight" onClick={() => { confirmedStep >= 2 && setStep(2) }}>
                            <span class="absolute flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full -end-4 ring-4 ring-white dark:ring-gray-900 dark:bg-gray-700">
                                <svg class="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 18 20">
                                    <path d="M16 1h-3.278A1.992 1.992 0 0 0 11 0H7a1.993 1.993 0 0 0-1.722 1H2a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2Zm-3 14H5a1 1 0 0 1 0-2h8a1 1 0 0 1 0 2Zm0-4H5a1 1 0 0 1 0-2h8a1 1 0 1 1 0 2Zm0-5H5a1 1 0 0 1 0-2h2V2h4v2h2a1 1 0 1 1 0 2Z" />
                                </svg>
                            </span>
                            <h3 class={`font-medium leading-tight text-sm ${confirmedStep == 2 ? "text-white" : confirmedStep > 2 && "text-green-normal"} ${step == 2 && "brightness-125"}`}>Mint And Snipe</h3>
                        </li>
                    </ol>
                    <div className="w-full h-full flex flex-col gap-2">
                        {
                            step == 0 && <div className="wizard-div overflow-auto p-6 flex flex-col items-center justify-center">
                                <_1ChooseYourPackage
                                    selectedProject={selectedProject}
                                    setSelectedProject={setSelectedProject}
                                    setStep={setStep}
                                    type='pump.fun'
                                />
                            </div>
                        }
                        {
                            step == 1 && <div className="wizard-div overflow-auto p-6 flex flex-col items-center justify-center">
                                <_2CreateSPLToken
                                    type={'pump.fun'}
                                    selectedProject={selectedProject}
                                    setSelectedProject={setSelectedProject}
                                    setStep={setStep}
                                />
                            </div>
                        }
                        {
                            step == 2 && <div className="wizard-div overflow-auto p-6 flex flex-col items-center justify-center">
                                <PumpfunMintSnipe className={"w-full h-full"} />
                            </div>
                        }
                    </div>
                </div>
            </div>
            <div id="dialog-root" ref={dialogRef}></div>
        </div>
    );
};

export default PumpfunLaunchPage;
