import { useState } from "react";
import Modal from "../Base/Modal";

export default function UploadWalletDialog({ isOpen, onOK, onCancel }) {
    const [text, setText] = useState("");

    const handleOK = () => {
        if (text !== "") {
            const privateKeys = text.trim().split('\n').map((v) => v.trim())
            console.log(privateKeys)
            setText("");
            onOK(privateKeys);
        }
    };

    const handleCancel = () => {
        setText("");
        onCancel();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleCancel}>
            <div className="flex flex-col pt-5 w-[640px] font-sans">
                <div className="flex items-center justify-start w-full h-auto px-5 py-3 rounded-t-md bg-gray-highlight">
                    <div className="font-sans text-left w-full text-sm font-medium text-white uppercase">
                        Upload Wallets
                    </div>
                </div>
                <div className="items-center w-full h-auto px-5 py-5 md:py-0 bg-gray-dark rounded-b-md">
                    <div className="mt-4">
                        <div className="font-sans text-xs uppercase text-gray-normal">
                            Private Keys <span className="pl-1 text-green-normal">*</span>
                        </div>
                        <textarea
                            className="outline-none border border-gray-border font-sans text-white placeholder:text-gray-border text-sm px-2.5 bg-transparent w-full h-[400px] mt-1"
                            placeholder="Enter Wallet PrivateKeys"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center justify-center gap-5 my-5">
                        <button
                            className="pl-3 pr-4 h-button grow rounded-[4px] justify-center items-center gap-1 inline-flex bg-green-normal active:scale-95 transition duration-90 ease-in-out transform focus:outline-none text-xs font-medium text-center text-white uppercase disabled:text-gray-border disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            onClick={handleOK}>
                            OK
                        </button>
                        <button
                            className="pl-3 pr-4 h-button grow rounded-[4px] justify-center items-center gap-1 inline-flex bg-[#1A1A37] active:scale-95 transition duration-90 ease-in-out transform focus:outline-none text-xs font-medium text-center text-white uppercase disabled:text-gray-border disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            onClick={handleCancel}>
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
