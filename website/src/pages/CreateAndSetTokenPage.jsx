import { Card } from "../components/Card/Card";
import CreateToken from "../components/CreateToken/CreateToken";
import OpenBookMarket from "../components/OpenBookMarket/OpenBookMarket";
import SetAuthority from "../components/SetAuthority/SetAuthority";
import TopBar from "../components/TopBar/TopBar";

const CreateAndSetTokenPage = () => {
  return (
    <div className="w-screen h-screen flex flex-col max-[1800px]:items-start items-center overflow-auto">
      <div className="flex flex-col mx-6 my-3">
        <TopBar noProject={true} title="Manage Token" />
        <div className="flex gap-6 my-16 justify-center">
          <Card className="!w-1/2 rounded-3xl border-8 border-card-border">
            <CreateToken />
          </Card>
          <Card className="!w-1/2 rounded-3xl border-8 border-card-border py-6">
            <SetAuthority className={"w-full"}/>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CreateAndSetTokenPage;
