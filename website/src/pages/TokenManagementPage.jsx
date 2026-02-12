import { useState } from "react";
import { Card } from "../components/Card/Card";
import TokenAccount from "../components/TokenAccount/TokenAccount";
import TopBar from "../components/TopBar/TopBar";
import { ExtendedButton } from "../components/Buttons/Buttons";
import SetAuthority from "../components/SetAuthority/SetAuthority";
import RemoveLp from "../components/ManageLp/RemoveLp";
import BurnLp from "../components/ManageLp/BurnLp";

const TokenManagementPage = () => {
  const [pageIndex, setPageIndex] = useState(0);

  return (
    <div className="w-screen h-screen flex flex-col max-[1800px]:items-start items-center overflow-auto">
      <div className="w-full flex flex-col">
        <TopBar noProject={true} title="Contract Management" />
        <div className="flex gap-6 my-16 justify-center">
          <div className="!w-[800px] p-8 rounded-lg border border-white/10 bg-white/5 shadow-lg">
            <div className='container-gradient w-full !p-px mb-6 flex !rounded-md !border !border-solid !border-gray-border gap-px text-md'>
              <div className={`${pageIndex == 0 ? "bg-green-button" : ""} w-1/2 rounded-md p-[1px]`}>
                <ExtendedButton className={`${pageIndex == 0 ? "bg-black/50" : "bg-transparent hover:bg-gray-highlight"} !h-full w-full uppercase`} onClick={() => setPageIndex(0)}>set authority</ExtendedButton>
              </div>
              <div className={`${pageIndex == 1 ? "bg-green-button" : ""} w-1/2 rounded-md p-[1px]`}>
                <ExtendedButton className={`${pageIndex == 1 ? "bg-black/50" : "bg-transparent hover:bg-gray-highlight"} !h-full w-full uppercase`} onClick={() => setPageIndex(1)}>burn token</ExtendedButton>
              </div>
            </div>
            {
              pageIndex == 0 ?
                <SetAuthority className={"w-full"} /> :
                pageIndex == 1 &&
                <TokenAccount className={"w-full"} />
            }
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokenManagementPage;
