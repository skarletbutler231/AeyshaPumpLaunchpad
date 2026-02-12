import Collapsible from "react-collapsible";
import AdvancedModal from "./AdvancedModal";
import { FaAngleDown, FaAngleUp } from "react-icons/fa";
import { useEffect, useState } from "react";

// eslint-disable-next-line react/prop-types
export default function BundleProgressDialog({ isOpen, onClose = null, params, onChange = null }) {
    const { solAmount, tokenAmount, zombieWallet, currentProject, walletChecked, walletSolAmount, walletTokenAmount, simulateData } = params;
    const [step, setStep] = useState(1);
    const [step1, setStep1] = useState(false);
    const [step2, setStep2] = useState(false);
    const [step3, setStep3] = useState(false);
    const [step4, setStep4] = useState(false);
    const [step5, setStep5] = useState(false);
    const [step6, setStep6] = useState(false);
    const [step7, setStep7] = useState(false);

    useEffect(() => {
        if (zombieWallet.address != "")
            setStep1(true);
        else
            setStep1(false);
    }, [zombieWallet])

    useEffect(() => {
        if (solAmount.trim() == "") {
            if (step2) setStep2(false);
        } else {
            if (!step2) setStep2(true);
        }
    }, [solAmount])

    useEffect(() => {
        if (currentProject?.wallets?.length > 24) {
            setStep3(true);
        } else {
            setStep3(false);
        }
    }, [currentProject?.wallets?.length])

    useEffect(() => {
        let flag = false;
        for (let i = 0; i < currentProject.wallets.length; i++) {
            if (!walletChecked[i])
                continue;
            flag = true;

            if (!walletTokenAmount[i]) {
                setStep4(false);
                return;
            }

            const initialTokenAmount = Number(walletTokenAmount[i].toString().replaceAll(",", ""));
            if (isNaN(initialTokenAmount) || initialTokenAmount <= 0) {
                setStep4(false);
                return;
            }
        }
        setStep4(flag);
    }, [currentProject.wallets, walletChecked, walletTokenAmount])

    useEffect(() => {
        let flag = false;
        for (let i = 0; i < currentProject.wallets.length; i++) {
            if (!walletChecked[i])
                continue;

            flag = true;

            if (!walletSolAmount[i]) {
                setStep5(false);
                return;
            }

            const initialSolAmount = Number(walletSolAmount[i].toString().replaceAll(",", ""));
            if (isNaN(initialSolAmount) || initialSolAmount < 0) {
                setStep5(false);
                return;
            }
        }
        setStep5(flag);
    }, [currentProject.wallets, walletChecked, walletSolAmount])

    useEffect(() => {
        if (currentProject.zombie.trim() != "") {
            setStep6(true)
        } else {
            setStep6(false);
        }
    }, [currentProject.zombie])

    useEffect(() => {
        if (Object.keys(simulateData).length == 0) {
            setStep7(false);
        } else {
            setStep7(true);
        }
    }, [simulateData])

    useEffect(() => {
        let count = 0;
        if (step1) count++;
        if (step2) count++;
        if (step3) count++;
        if (step4) count++;
        if (step5) count++;
        if (step6) count++;
        if (step7) count++;
        onChange && onChange(100 * count / 7, 7 - count);
    }, [step1, step2, step3, step4, step5, step6, step7])

    return (
        <AdvancedModal isOpen={isOpen} onClose={onClose} hideCloseButton={false} className="!z-[2000]">
            <div className="w-[515px] h-[700px] p-8 flex flex-col items-center gap-5">
                <div className="text-lg font-conthrax">Your Progress</div>
                <div className="flex flex-col gap-4 overflow-auto">
                    <div className="wizard-div p-6 flex flex-col">
                        <Collapsible
                            trigger={
                                <div className="flex font-conthrax justify-between items-center">
                                    <div className="flex gap-2 items-center">
                                        <div className={`text-xxs ${step1 ? "text-green-normal" : "text-gray-label"}`}>
                                            Step 1: Zombie Wallet
                                        </div>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        {step1 && <img className="" src="/assets/icon/ic_step_check.svg" width={24} height={24} alt="checked" />}
                                        <FaAngleDown className="text-xxs" />
                                    </div>
                                </div>
                            }
                            triggerWhenOpen={
                                <div className="flex font-conthrax justify-between items-center">
                                    <div className="flex gap-2 items-center">
                                        <div className={`text-xxs ${step1 ? "text-green-normal" : "text-gray-label"}`}>
                                            Step 1: Zombie Wallet
                                        </div>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        {step1 && <img className="" src="/assets/icon/ic_step_check.svg" width={24} height={24} alt="checked" />}
                                        <FaAngleDown className="text-xxs" />
                                    </div>
                                </div>
                            }
                        >
                            <div className="flex flex-col gap-6">
                                <div className="mt-1 w-full text-left">
                                    Set up a Zombie Wallet to fund all bundled wallets. Enter the wallet's private key in the Zombie Wallet field. Ensure this wallet is newly created with a zero balance to ensure the simulation accurately calculates the SOL required for the bundle.
                                </div>
                            </div>
                        </Collapsible>
                    </div>
                    <div className="wizard-div p-6 flex flex-col">
                        <Collapsible
                            trigger={
                                <div className="flex font-conthrax justify-between items-center">
                                    <div className="flex gap-2 items-center">
                                        <div className={`text-xxs ${step2 ? "text-green-normal" : "text-gray-label"}`}>
                                            Step 2: SOL Amount LP
                                        </div>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        {step2 && <img className="" src="/assets/icon/ic_step_check.svg" width={24} height={24} alt="checked" />}
                                        <FaAngleDown className="text-xxs" />
                                    </div>
                                </div>
                            }
                            triggerWhenOpen={
                                <div className="flex font-conthrax justify-between items-center">
                                    <div className="flex gap-2 items-center">
                                        <div className={`text-xxs ${step2 ? "text-green-normal" : "text-gray-label"}`}>
                                            Step 2: SOL Amount LP
                                        </div>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        {step2 && <img className="" src="/assets/icon/ic_step_check.svg" width={24} height={24} alt="checked" />}
                                        <FaAngleDown className="text-xxs" />
                                    </div>
                                </div>
                            }
                        >
                            <div className="flex flex-col gap-6">
                                <div className="mt-1 w-full text-left">
                                    Specify the amount of SOL you wish to add to the liquidity pool. Pump.fun provides the liquidity pool for this operation.
                                </div>
                            </div>
                        </Collapsible>
                    </div>
                    <div className="wizard-div p-6 flex flex-col">
                        <Collapsible
                            trigger={
                                <div className="flex font-conthrax justify-between items-center">
                                    <div className="flex gap-2 items-center">
                                        <div className={`text-xxs ${step3 ? "text-green-normal" : "text-gray-label"}`}>
                                            Step 3: Generate Wallet
                                        </div>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        {step3 && <img className="" src="/assets/icon/ic_step_check.svg" width={24} height={24} alt="checked" />}
                                        <FaAngleDown className="text-xxs" />
                                    </div>
                                </div>
                            }
                            triggerWhenOpen={
                                <div className="flex font-conthrax justify-between items-center">
                                    <div className="flex gap-2 items-center">
                                        <div className={`text-xxs ${step3 ? "text-green-normal" : "text-gray-label"}`}>
                                            Step 3: Generate Wallet
                                        </div>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        {step3 && <img className="" src="/assets/icon/ic_step_check.svg" width={24} height={24} alt="checked" />}
                                        <FaAngleDown className="text-xxs" />
                                    </div>
                                </div>
                            }
                        >
                            <div className="flex flex-col gap-6">
                                <div className="mt-1 w-full text-left">
                                    Enter the number of wallets to include in the bundle. By default, 25 wallets are provided.
                                </div>
                            </div>
                        </Collapsible>
                    </div>
                    <div className="wizard-div p-6 flex flex-col">
                        <Collapsible
                            trigger={
                                <div className="flex font-conthrax justify-between items-center">
                                    <div className="flex gap-2 items-center">
                                        <div className={`text-xxs ${step4 ? "text-green-normal" : "text-gray-label"}`}>
                                            Step 4: Set Token Amount
                                        </div>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        {step4 && <img className="" src="/assets/icon/ic_step_check.svg" width={24} height={24} alt="checked" />}
                                        <FaAngleDown className="text-xxs" />
                                    </div>
                                </div>
                            }
                            triggerWhenOpen={
                                <div className="flex font-conthrax justify-between items-center">
                                    <div className="flex gap-2 items-center">
                                        <div className={`text-xxs ${step4 ? "text-green-normal" : "text-gray-label"}`}>
                                            Step 4: Set Token Amount
                                        </div>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        {step4 && <img className="" src="/assets/icon/ic_step_check.svg" width={24} height={24} alt="checked" />}
                                        <FaAngleDown className="text-xxs" />
                                    </div>
                                </div>
                            }
                        >
                            <div className="flex flex-col gap-6">
                                <div className="mt-1 w-full text-left">
                                    Set the token amounts for each wallets to buy. You can select the wallets by click the checkbox. You can input manually or set the amounts randomly.
                                    <br />
                                    If you selet a wallet you should set the token amount to buy with this wallet. If not, you cannot simulate.
                                </div>
                            </div>
                        </Collapsible>
                    </div>
                    <div className="wizard-div p-6 flex flex-col">
                        <Collapsible
                            trigger={
                                <div className="flex font-conthrax justify-between items-center">
                                    <div className="flex gap-2 items-center">
                                        <div className={`text-xxs ${step5 ? "text-green-normal" : "text-gray-label"}`}>
                                            Step 5: Set SOL Amount
                                        </div>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        {step5 && <img className="" src="/assets/icon/ic_step_check.svg" width={24} height={24} alt="checked" />}
                                        <FaAngleDown className="text-xxs" />
                                    </div>
                                </div>
                            }
                            triggerWhenOpen={
                                <div className="flex font-conthrax justify-between items-center">
                                    <div className="flex gap-2 items-center">
                                        <div className={`text-xxs ${step5 ? "text-green-normal" : "text-gray-label"}`}>
                                            Step 5: Set SOL Amount
                                        </div>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        {step5 && <img className="" src="/assets/icon/ic_step_check.svg" width={24} height={24} alt="checked" />}
                                        <FaAngleDown className="text-xxs" />
                                    </div>
                                </div>
                            }
                        >
                            <div className="flex flex-col gap-6">
                                <div className="mt-1 w-full text-left">
                                    Set Additional SOL amount for each wallet. This balance is not used for buying token. It can be used as a transaction fee after bundle.
                                </div>
                            </div>
                        </Collapsible>
                    </div>
                    <div className="wizard-div p-6 flex flex-col">
                        <Collapsible
                            trigger={
                                <div className="flex font-conthrax justify-between items-center">
                                    <div className="flex gap-2 items-center">
                                        <div className={`text-xxs ${step6 ? "text-green-normal" : "text-gray-label"}`}>
                                            Step 6: Save Project
                                        </div>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        {step6 && <img className="" src="/assets/icon/ic_step_check.svg" width={24} height={24} alt="checked" />}
                                        <FaAngleDown className="text-xxs" />
                                    </div>
                                </div>
                            }
                            triggerWhenOpen={
                                <div className="flex font-conthrax justify-between items-center">
                                    <div className="flex gap-2 items-center">
                                        <div className={`text-xxs ${step6 ? "text-green-normal" : "text-gray-label"}`}>
                                            Step 6: Save Project
                                        </div>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        {step6 && <img className="" src="/assets/icon/ic_step_check.svg" width={24} height={24} alt="checked" />}
                                        <FaAngleDown className="text-xxs" />
                                    </div>
                                </div>
                            }
                        >
                            <div className="flex flex-col gap-6">
                                <div className="mt-1 w-full text-left">
                                    You can save the project settings manually. This step is optional.
                                </div>
                            </div>
                        </Collapsible>
                    </div>
                    <div className="wizard-div p-6 flex flex-col">
                        <Collapsible
                            trigger={
                                <div className="flex font-conthrax justify-between items-center">
                                    <div className="flex gap-2 items-center">
                                        <div className={`text-xxs ${step7 ? "text-green-normal" : "text-gray-label"}`}>
                                            Step 7: Simulate
                                        </div>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        {step7 && <img className="" src="/assets/icon/ic_step_check.svg" width={24} height={24} alt="checked" />}
                                        <FaAngleDown className="text-xxs" />
                                    </div>
                                </div>
                            }
                            triggerWhenOpen={
                                <div className="flex font-conthrax justify-between items-center">
                                    <div className="flex gap-2 items-center">
                                        <div className={`text-xxs ${step7 ? "text-green-normal" : "text-gray-label"}`}>
                                            Step 7: Simulate
                                        </div>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        {step7 && <img className="" src="/assets/icon/ic_step_check.svg" width={24} height={24} alt="checked" />}
                                        <FaAngleDown className="text-xxs" />
                                    </div>
                                </div>
                            }
                        >
                            <div className="flex flex-col gap-6">
                                <div className="mt-1 w-full text-left">
                                    Simulate the bundle to calculate the SOL needed. Ensure the Zombie wallet is empty. The simulation will check the wallet's balance and specify any additional SOL required for the bundle.
                                </div>
                            </div>
                        </Collapsible>
                    </div>
                </div>
            </div>
        </AdvancedModal>
    );
}
