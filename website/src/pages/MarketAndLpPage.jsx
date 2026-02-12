import { Card } from "../components/Card/Card";
// import ManageLp from "../components/ManageLp/BurnLp";
import OpenBookMarket from "../components/OpenBookMarket/OpenBookMarket";
import TopBar from "../components/TopBar/TopBar";

const MarketAndLpPage = () => {
  return (
    <div className="w-screen h-screen flex flex-col max-[1800px]:items-start items-center overflow-auto">
      <div className="flex flex-col mx-6 my-3">
        <TopBar noProject={true} title="OpenBookMarket & LP" />
        <div className="flex gap-6 my-16 justify-center">
          <Card className="!w-1/2 rounded-3xl border-8 border-card-border">
            <OpenBookMarket className={'w-full'} />
          </Card>
          <Card className="!w-1/2 rounded-3xl border-8 border-card-border">
            {/* <ManageLp className={"w-full"}/> */}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MarketAndLpPage;
