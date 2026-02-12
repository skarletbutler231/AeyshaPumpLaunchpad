import { useState } from "react";
import { Card } from "../components/Card/Card";
import TokenAccount from "../components/TokenAccount/TokenAccount";
import TopBar from "../components/TopBar/TopBar";
import { ExtendedButton } from "../components/Buttons/Buttons";
import SetAuthority from "../components/SetAuthority/SetAuthority";
import RemoveLp from "../components/ManageLp/RemoveLp";
import BurnLp from "../components/ManageLp/BurnLp";

const TokenAccountPage = () => {
  const [pageIndex, setPageIndex] = useState(0);

  return (
    <div className="w-screen h-screen flex flex-col max-[1800px]:items-start items-center overflow-auto">
      <div className="flex flex-col mx-6 my-3">
        <TopBar noProject={true} title="Contract Management" />
        <div className="flex gap-6 my-16 justify-center">
          <Card className="!w-[800px] rounded-3xl border-8 border-card-border py-6">
            <div className='container-gradient w-[100%] !p-px mb-6 flex !rounded-md !border !border-solid !border-gray-border gap-px text-md'>
              <div className={`${pageIndex == 0 ? "bg-gradient-blue-to-purple" : ""} w-1/3 rounded-md p-[1px]`}>
                <ExtendedButton className={`${pageIndex == 0 ? "bg-black/50" : "bg-transparent hover:bg-gray-highlight"} !h-full w-full uppercase`} onClick={() => setPageIndex(0)}>set authority</ExtendedButton>
              </div>
              <div className={`${pageIndex == 1 ? "bg-gradient-blue-to-purple" : ""} w-1/3 rounded-md p-[1px]`}>
                <ExtendedButton className={`${pageIndex == 1 ? "bg-black/50" : "bg-transparent hover:bg-gray-highlight"} !h-full w-full uppercase`} onClick={() => setPageIndex(1)}>remove liquidity</ExtendedButton>
              </div>
              {/* <div className={`${pageIndex == 2 ? "bg-gradient-blue-to-purple" : ""} w-1/4 rounded-md p-[1px]`}>
                <ExtendedButton className={`${pageIndex == 2 ? "bg-black/50" : "bg-transparent hover:bg-gray-highlight"} !h-full w-full uppercase`} onClick={() => setPageIndex(2)}>burn liquidity</ExtendedButton>
              </div> */}
              <div className={`${pageIndex == 3 ? "bg-gradient-blue-to-purple" : ""} w-1/3 rounded-md p-[1px]`}>
                <ExtendedButton className={`${pageIndex == 3 ? "bg-black/50" : "bg-transparent hover:bg-gray-highlight"} !h-full w-full uppercase`} onClick={() => setPageIndex(3)}>burn token</ExtendedButton>
              </div>
            </div>
            {
              pageIndex == 0 ?
                <SetAuthority className={"w-full"} /> :
                pageIndex == 1 ?
                  <RemoveLp className={"w-full"} /> :
                  pageIndex == 2 ?
                    <BurnLp className={"w-full"} /> :
                    pageIndex == 3 &&
                    <TokenAccount className={"w-full"} />
            }
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TokenAccountPage;
