/* eslint-disable react/prop-types */
import { useState } from "react";
import { toast } from "react-toastify";
import { FaRegCopy } from "react-icons/fa";
import Modal from "./Modal";
import { ellipsisAddress } from "../../utils/methods";
import { useNavigate } from "react-router-dom";

export default function InstructionPopupDialog({ isOpen, onClose, activateLink=false }) {
    const navigate = useNavigate();
    return (
        <Modal isOpen={isOpen}>
            <div className="flex flex-col pt-5 w-[440px] font-sans">
                <div className="flex items-center justify-start w-full h-auto px-5 py-3 rounded-t-md bg-gray-highlight">
                    <div className="text-sm font-medium text-white uppercase">
                        {"Instruction"}
                    </div>
                </div>
                <div className="items-center w-full h-auto px-5 py-5 md:py-0 bg-gray-dark rounded-b-md">
                    <div className="flex flex-col mt-4 gap-4">
                        <div className="uppercase text-sm text-gray-normal">{"Contract Deployed and Verified!"}</div>
                        <div className="flex items-center justify-center gap-1 flex-wrap text-sm">
                            {"Please "}
                            <div 
                                className={`${activateLink && 'underline decoration-blue-primary text-blue-primary cursor-pointer'} text-nowrap select-none`} 
                                onClick={() => activateLink && navigate('/liquidity')}
                            >
                                Add Liquidity
                            </div>
                            {" Then Proceed to "}
                            <div 
                                className={`${activateLink && 'underline decoration-blue-primary text-blue-primary cursor-pointer'} text-nowrap select-none`} 
                                onClick={() => activateLink && navigate('/bundle')}
                            >
                                Bundler Page
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-center gap-5 my-5">
                        <button
                            className="pl-3 pr-4 h-button grow rounded-lg justify-center items-center gap-1 inline-flex bg-main active:scale-95 transition duration-100 ease-in-out transform focus:outline-none text-xs font-medium text-center text-white uppercase disabled:text-gray-border disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            onClick={onClose}>
                            OK
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
