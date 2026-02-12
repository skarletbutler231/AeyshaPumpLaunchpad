import { useContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import axios from "axios";

import { AppContext } from "../App";
import ConfirmDialog from "../components/Dialogs/ConfirmDialog";
import { IoIosCheckmark, IoIosRefresh } from "react-icons/io";
import AddressSetDialog from "../components/Dialogs/AddressSetDialog";
import { isValidAddress } from "../utils/methods";
import ConnectWalletButton from "../components/ConnectWalletButton";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import BigNumber from "bignumber.js";
import TopBar from "../components/TopBar/TopBar";

export default function AdminZombieWalletPage({ className }) {
  const {
    SERVER_URL,
    setLoadingPrompt,
    setOpenLoading,
    projects,
    loadAllProjects,
    sigData,
    signingData
  } = useContext(AppContext);

  const [activeProjects, setActiveProjects] = useState([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const [solBalances, setSolBalances] = useState([]);
  const { connection } = useConnection()
  const [walletChecked, setWalletChecked] = useState([]);
  const [walletAllChecked, setWalletAllChecked] = useState(false);
  const [selectedSOLBalance, setSelectedSOLBalance] = useState(0);
  const [targetWallet, setTargetWallet] = useState("");

  useEffect(() => {
    console.log(projects)
    if (projects && projects.length > 0) {
      setActiveProjects(projects.filter((project) => project.zombie != ""));
    } else {
      setActiveProjects([])
    }
  }, [projects])

  useEffect(() => {
    setSelectedSOLBalance(0);
    console.log(activeProjects)
    if (activeProjects && activeProjects.length > 0) {
      const newWalletChecked = activeProjects.map(() => false);
      setWalletChecked(newWalletChecked);
      setWalletAllChecked(false);
      getProjectsSolBalance(activeProjects);
    } else {
      setWalletAllChecked(false);
      setWalletChecked([]);
      setSolBalances([]);
    }
  }, [activeProjects]);

  const getProjectsSolBalance = async (projects) => {
    let new_solBalances = [];
    new_solBalances = await Promise.all(projects.map(async (item) => {
      try {
        const owner = new PublicKey(item.zombie);
        const balance = await connection.getBalance(owner);
        return Number(new BigNumber(balance.toString() + "e-9").toString()).toFixed(4);
      }
      catch (err) {
        console.log(err);
      }
      return "0.0000";
    }));
    setSolBalances(new_solBalances);
  };

  const handleWalletAllChecked = () => {
    const newWalletAllChecked = !walletAllChecked;
    setWalletAllChecked(newWalletAllChecked);
    setWalletChecked(walletChecked.map(() => newWalletAllChecked));
    let sum = 0;
    if (newWalletAllChecked) {
      let temp = {}
      solBalances.map((v, index) => {
        if (temp[activeProjects[index].zombie]) {
          return;
        } else {
          temp[activeProjects[index].zombie] = 1;
          sum = sum + Number(v)
        }
      });
    }
    setSelectedSOLBalance(sum);
  };

  const handleWalletChanged = (index, value) => {
    let newWalletChecked = [...walletChecked];
    newWalletChecked[index] = !newWalletChecked[index];

    // if (value) {
    //   ``;
    //   setSelectedSOLBalance(selectedSOLBalance + Number(solBalances[index]));
    // } else {
    //   setSelectedSOLBalance(selectedSOLBalance - Number(solBalances[index]));
    // }
    let sum = 0;
    let temp = {};
    solBalances.map((v, index) => {
      if (newWalletChecked[index]) {
        if (temp[activeProjects[index].zombie]) {
          return;
        } else {
          temp[activeProjects[index].zombie] = 1;
          sum = sum + Number(v)
        }
      }
    })
    setSelectedSOLBalance(sum)

    setWalletChecked(newWalletChecked);

    let newWalletAllChecked = true;
    for (let i = 0; i < newWalletChecked.length; i++)
      newWalletAllChecked &&= newWalletChecked[i];
    setWalletAllChecked(newWalletAllChecked);
  };

  const handleClickCollect = (e) => {
    e.preventDefault();

    if (!isValidAddress(targetWallet)) {
      toast.warn("Please input wallet to send SOL!");
      return;
    }

    const validWalletChecked = walletChecked.filter((item) => item === true);
    // const validTeamWalletChecked = teamWalletChecked.filter(item => item === true);
    // if (validWalletChecked.length === 0 && validTeamWalletChecked.length === 0) {
    if (validWalletChecked.length === 0) {
      toast.warn("Please check wallets to collect SOL from!");
      return;
    }

    setShowConfirmDialog(true);
  };

  const handleCollectAllSol = async () => {
    setShowConfirmDialog(false);

    if (!isValidAddress(targetWallet)) {
      toast.warn("Please input wallet to send SOL!");
      return;
    }

    const validWalletChecked = walletChecked.filter((item) => item === true);
    // const validTeamWalletChecked = teamWalletChecked.filter(item => item === true);
    // if (validWalletChecked.length === 0 && validTeamWalletChecked.length === 0) {
    if (validWalletChecked.length === 0) {
      toast.warn("Please check wallets to collect SOL from!");
      return;
    }

    setLoadingPrompt("Collecting all SOL...");
    setOpenLoading(true);
    try {
      let wallets = [];
      for (let i = 0; i < activeProjects.length; i++) {
        if (walletChecked[i]) {
          wallets = [...wallets, activeProjects[i].zombie];
        }
      }

      const { data } = await axios.post(
        `${SERVER_URL}/api/v1/admin/collect-all-sol`,
        {
          targetWallet,
          wallets,
          sigData,
          signingData
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      if (data.success) {
        toast.success("Success!");
        setOpenLoading(false);
      } else {
        toast.error(data.error);
        setOpenLoading(false);
      }
    } catch (err) {
      console.log(err);
      toast.warn("Failed to collect all SOL!");
      setOpenLoading(false);
    }
  };

  return (
    <div className={`w-screen h-screen flex flex-col items-center`}>
      <TopBar noProject={true} />
      <ConfirmDialog
        isOpen={showConfirmDialog}
        title={"Collect"}
        message={`Do you really want to collect SOL from deposit wallets to ${targetWallet} ?`}
        onOK={handleCollectAllSol}
        onCancel={() => setShowConfirmDialog(false)}
      />
      <div className="w-full h-[30%] grow overflow-auto px-32 py-3">
        <div className="flex items-center justify-between w-full h-auto mb-2 text-xs font-medium text-white uppercase">
          <div className="text-base">Collect SOL from Projects</div>
          <button
            className="pl-3 pr-4 h-button rounded-lg justify-center items-center gap-1 inline-flex bg-[#1A1A37] active:scale-95 transition duration-100 ease-in-out transform focus:outline-none text-xs font-medium text-center text-white uppercase disabled:text-gray-border disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            onClick={() => {
              setSelectedSOLBalance(0);
              setTargetWallet("");
              loadAllProjects();
            }}
          >
            <IoIosRefresh className="text-lg text-green-normal" />
            Refresh
          </button>
        </div>
        <div className="flex items-center justify-between w-full h-auto mb-2 text-xs font-medium text-white uppercase">
          <div className="flex gap-2 items-center">
            <div className="ml-3 text-xs uppercase text-gray-normal whitespace-nowrap">
              Selected SOL Balance:
            </div>
            <div className="text-xs uppercase text-green-normal whitespace-nowrap">
              {selectedSOLBalance}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <div className="ml-3 text-xs uppercase text-gray-normal whitespace-nowrap">
              Target Wallet:
            </div>
            <input
              className="outline-none border border-gray-border text-white placeholder:text-gray-border text-sm px-2.5 bg-transparent w-full h-button ml-2 grow max-w-[430px] rounded-lg"
              placeholder="Target Wallet Address"
              value={targetWallet}
              onChange={(e) => setTargetWallet(e.target.value)}
            />
            <button
              className="text-xs font-medium text-center text-nowrap text-white uppercase px-6 h-10 rounded-lg justify-center items-center gap-2.5 bg-gradient-to-br from-[#4B65F1ED] to-[#FA03FF44] active:scale-95 transition duration-100 ease-in-out transform focus:outline-none"
              onClick={handleClickCollect}
            >
              Collect All SOL
            </button>
          </div>
        </div>
        <div className="relative flex flex-col w-full overflow-x-hidden text-white bg-transparent border border-gray-highlight rounded-lg">
          <table className="w-full text-xs">
            <thead className=" text-gray-normal">
              <tr className="uppercase bg-[#1A1A37] h-7">
                <th className="w-8">
                  <input
                    type="checkbox"
                    className="w-3 h-3 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    checked={walletAllChecked}
                    onChange={handleWalletAllChecked}
                  />
                </th>
                <th className="">User Name</th>
                <th className="">Project Name</th>
                <th className="">Status</th>
                <th className="">Zombie Wallet</th>
                <th className="">SOL Balance</th>
              </tr>
            </thead>
            <tbody className="text-xs text-gray-normal">
              {activeProjects.map((item, index) => {
                return (
                  <tr
                    className={`${index % 2 === 1 && "bg-[#ffffff02]"
                      } hover:bg-[#ffffff20] h-8`}
                    key={`project${index}`}
                  >
                    <td className="text-center">
                      <input
                        type="checkbox"
                        checked={
                          walletChecked[index] ? walletChecked[index] : false
                        }
                        onChange={(e) => handleWalletChanged(index, e)}
                        className="w-3 h-3 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                    </td>
                    <td className="text-center">{item.userName}</td>
                    <td className="text-center text-white">{item.name}</td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${(() => {
                            switch (item.status) {
                              case "INIT":
                                return "bg-white";
                              case "EXPIRED":
                                return "bg-gray-normal";
                              case "TRADE":
                                return "bg-green-normal";
                              default:
                                return "bg-green-normal";
                            }
                          })()}`}
                        ></div>
                        {item.status}
                      </div>
                    </td>
                    <td className="text-left">{item.zombie}</td>
                    <td
                      className={`text-center ${parseFloat(solBalances[index]) >= 1
                        ? "text-red-normal"
                        : parseFloat(solBalances[index]) >= 0.5
                          ? "text-yellow-normal"
                          : parseFloat(solBalances[index]) > 0
                            ? "text-green-normal"
                            : ""
                        }`}
                    >
                      {solBalances[index]}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {activeProjects.length === 0 && (
            <div className="my-3 text-sm font-bold text-center text-gray-700 uppercase">
              No Active Project
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
