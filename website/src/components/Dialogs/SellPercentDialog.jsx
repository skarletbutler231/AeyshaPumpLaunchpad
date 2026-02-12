/* eslint-disable react/prop-types */
import { useState } from "react";
import Modal from "./Modal";
import { RoundedButton } from "../Buttons/Buttons";

export default function SellPercentDialog({ isOpen, onOK, onCancel }) {
    const [percent, setPercent] = useState("");

    const handleOK = () => {
        const numPercent = Number(percent);
        if (isNaN(numPercent) || numPercent < 0 || numPercent > 100) {
            return;
        }
        onOK(numPercent);
    };

    const handleCancel = () => {
        setPercent("");
        onCancel();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleCancel}>
            <div className="flex flex-col pt-5 w-[340px] font-sans rounded-lg bg-gradient-to-b from-gray-light to-gray-highlight">
                <div className="flex items-center justify-start w-full h-auto px-5 py-1">
                    <div className="text-sm font-medium text-white uppercase">
                        Set % Amount
                    </div>
                </div>
                <div className="items-center w-full h-auto px-5 py-5 md:py-0">
                    <div className="mt-1">
                        <div className="flex items-center justify-between rounded-md border border-gray-border bg-transparent px-2.5 text-sm mt-1">
                            <input
                                className="outline-none text-white placeholder:text-gray-border text-sm bg-transparent w-full h-button"
                                placeholder="Enter % amount"
                                value={percent}
                                onChange={(e) => setPercent(e.target.value)}
                            />
                            %
                        </div>
                        <div className="mt-2 flex items-center gap-2 justify-between text-xxs">
                            <div
                                className={`bg-gradient-blue-to-purple rounded-full p-[1px]`}
                            >
                                <RoundedButton
                                    className={`!h-6 !px-3 !py-2 !bg-gray-highlight !border-none active:scale-95`}
                                    onClick={() => setPercent(25)}
                                >
                                    25%
                                </RoundedButton>
                            </div>
                            <div
                                className={`bg-gradient-blue-to-purple rounded-full p-[1px]`}
                            >
                                <RoundedButton
                                    className={`!h-6 !px-3 !py-2 !bg-gray-highlight !border-none active:scale-95`}
                                    onClick={() => setPercent(35)}
                                >
                                    35%
                                </RoundedButton>
                            </div>
                            <div
                                className={`bg-gradient-blue-to-purple rounded-full p-[1px]`}
                            >
                                <RoundedButton
                                    className={`!h-6 !px-3 !py-2 !bg-gray-highlight !border-none active:scale-95`}
                                    onClick={() => setPercent(50)}
                                >
                                    50%
                                </RoundedButton>
                            </div>
                            <div
                                className={`bg-gradient-blue-to-purple rounded-full p-[1px]`}
                            >
                                <RoundedButton
                                    className={`!h-6 !px-3 !py-2 !bg-gray-highlight !border-none active:scale-95`}
                                    onClick={() => setPercent(75)}
                                >
                                    75%
                                </RoundedButton>
                            </div>
                            <div
                                className={`bg-gradient-blue-to-purple rounded-full p-[1px]`}
                            >
                                <RoundedButton
                                    className={`!h-6 !px-3 !py-2 !bg-gray-highlight !border-none active:scale-95`}
                                    onClick={() => setPercent(100)}
                                >
                                    100%
                                </RoundedButton>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-center gap-5 my-5">
                        <button
                            className="w-full pl-3 pr-4 h-button grow rounded-lg justify-center items-center gap-1 inline-flex border border-solid border-gray-border active:scale-95 transition duration-100 ease-in-out transform focus:outline-none text-xs font-medium text-center text-white uppercase disabled:text-gray-border disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            onClick={handleCancel}>
                            Cancel
                        </button>
                        <button
                            className="w-full pl-3 pr-4 h-button grow rounded-lg justify-center items-center gap-1 inline-flex bg-gradient-blue-to-purple active:scale-95 transition duration-100 ease-in-out transform focus:outline-none text-xs font-medium text-center text-white uppercase disabled:text-gray-border disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            onClick={handleOK}>
                            Confirm
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
