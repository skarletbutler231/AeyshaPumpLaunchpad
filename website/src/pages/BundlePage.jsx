import { useContext } from "react";
import BundleBuy from "../components/BundleBuy/BundleBuy";
import { Card } from "../components/Card/Card";
import TokenAccount from "../components/TokenAccount/TokenAccount";
import TopBar from "../components/TopBar/TopBar";
import { AppContext } from "../App";
import PumpfunMintSnipe from "../components/PumpfunBundle/PumpfunMintSnipe";
import FairLaunch from "../components/FairLaunch/FairLaunch";
import Token2022Buy from "../components/Token2022Buy/Token2022Buy";
import RaydiumLaunchlabBundle from "../components/RaydiumLaunchlabBundle/RaydiumLaunchlabBundle";

const BundlePage = () => {
  const { currentProject } = useContext(AppContext);
  return (
    <div className="w-screen h-screen flex flex-col max-[1800px]:items-start items-center overflow-auto">
      <div className="flex flex-col mx-6 my-3">
        <TopBar />
        <div className="flex gap-6 my-8 justify-center">
          {currentProject.platform == "raydium" ?
            <BundleBuy className={"w-full"} /> :
            currentProject.platform == "raydium-fair" ?
              <FairLaunch className={"w-full"} /> :
              currentProject.platform == "token-2022" ?
                <Token2022Buy className={"w-full"} /> :
                currentProject.platform == "raydium.launchlab" ?
                  <RaydiumLaunchlabBundle className={"w-full"} /> :
                  <PumpfunMintSnipe className={"w-full"} />
          }
        </div>
      </div>
    </div>
  );
};

export default BundlePage;
