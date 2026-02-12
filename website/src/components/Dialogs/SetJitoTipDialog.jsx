/* eslint-disable react/prop-types */
import { useState } from "react";
import Modal from "./Modal";

export default function SetJitoTipDialog({ isOpen, onOK, onClose, title }) {
    const [jitoTip, setJitoTip] = useState("");

    const handleOK = () => {
        if (jitoTip !== "" && !isNaN(Number(jitoTip)))
            onOK(jitoTip);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div className="flex flex-col pt-5 w-[440px] font-sans">
                <div className="flex items-center justify-start w-full h-auto px-5 py-3 rounded-t-md bg-gray-highlight">
                    <div className="text-sm font-medium text-white uppercase">
                        {title}
                    </div>
                </div>
                <div className="items-center w-full h-auto px-5 py-5 md:py-0 bg-gray-dark rounded-b-md">
                    <div className="mt-4">
                        <div className="text-xs uppercase text-gray-normal">
                            Tip Amount<span className="pl-1 text-dark-pink">*</span>
                        </div>
                        <input
                            className="outline-none border border-gray-border text-white placeholder:text-gray-border text-sm px-2.5 bg-transparent w-full h-button mt-1"
                            placeholder="Enter SOL Value"
                            onChange={(e) => setJitoTip(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center justify-center gap-5 my-5">
                        <button
                            className="pl-3 pr-4 w-1/2 h-button grow rounded-lg justify-center items-center gap-1 inline-flex bg-[#1A1A37] active:scale-95 transition duration-100 ease-in-out transform focus:outline-none text-xs font-medium text-center text-white uppercase disabled:text-gray-border disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            className="pl-3 pr-4 w-1/2 h-button grow rounded-lg justify-center items-center gap-1 inline-flex bg-green-button active:scale-95 transition duration-100 ease-in-out transform focus:outline-none text-xs font-medium text-center text-white uppercase disabled:text-gray-border disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            onClick={handleOK}>
                            OK
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
