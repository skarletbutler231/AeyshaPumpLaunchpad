import AdvancedModal from "./AdvancedModal";

// eslint-disable-next-line react/prop-types
export default function LoadingDialog({ isOpen, prompt, desc }) {
    return (
        <AdvancedModal isOpen={isOpen} hideCloseButton={true} className="!z-[2000]">
            <div className="w-[400px] h-auto py-12 px-4 flex flex-col items-center">
                <img src="/assets/img/loading1.png" className="w-20 h-20 animate-spin" alt="spinner" />
                <div className="mt-4 text-lg font-conthrax font-medium text-center">
                    {prompt}
                </div>
                <div className="mt-2 font-medium text-center">
                    {desc}
                </div>
            </div>
        </AdvancedModal>
    );
}
