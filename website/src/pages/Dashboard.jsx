/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";

import ControlPanel from "../components/ControlPanel/ControlPanel";
import SwapPanel from "../components/SwapPanel/SwapPanel";
import BundlerWalletManagement from "../components/BundlerWalletManagement/BundlerWalletManagement";
import VolumeBotManagement from "../components/VolumeBot/VolumeBotManagement";
import TokenInfoPanel from "../components/TokenInfoPanel/TokenInfoPanel";
import WalletManagement from "../components/WalletManagement/WalletManagement";
import OrderHistory from "../components/OrderHistory/OrderHistory";
import TopBar from "../components/TopBar/TopBar";
import { AppContext } from "../App";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddress, getMint } from "@solana/spl-token";
import Promise from "bluebird";
import { isValidAddress } from "../utils/methods";
import BigNumber from 'bignumber.js';
import { CircledButton } from "../components/Buttons/Buttons";
import { FaCheck, FaSearch, FaTimes } from "react-icons/fa";
import copy from "copy-to-clipboard";
import TokenSearchPanel from "../components/TokenInfoPanel/TokenSearchPanel";
import { toast } from "react-toastify";

const RPC_CONCURRENCY = parseInt(import.meta.env.VITE_APP_RPC_CONCURRENCY);
export const dashboardContext = createContext(null);

function Dashboard() {
  const { activeTokenAddress, setActiveTokenAddress, currentProject, refresh, setRefresh, setLoadingPrompt, setOpenLoading, tokenInfo, activeDashboardPanel } = useContext(AppContext);

  const { connection } = useConnection();

  const [showChart, setShowChart] = useState(true);
  const [enable100Wallet, setEnable100Wallet] = useState(true);
  const [enableWalletManage, setEnableWalletManage] = useState(true);
  const [iframeHeight, setIframeHeight] = useState(window.screen.height / 2 - 100);
  const [isDown, setIsDown] = useState(false);
  const [showCandidate, setShowCandidate] = useState(false);

  const [tokenAddress, setTokenAddress] = useState("");
  const [pairAddress, setPairAddress] = useState("Bzc9NZfMqkXR6fz1DBph7BDf9BroyEf6pnzESP7v5iiw");
  const [pairData, setPairData] = useState();

  const [walletActiveTokenBalanceData, setWalletActiveTokenBalanceData] = useState([]);
  const [teamWalletActiveTokenBalanceData, setTeamWalletActiveTokenBalanceData] = useState([]);
  const [additionalWalletActiveTokenBalanceData, setAdditionalWalletActiveTokenBalanceData] = useState([]);

  const updateAllActiveTokenBalances = async (connection, token, wallets, teamWallets, additionalWallets) => {
    console.log("Updating all balances...", token, wallets, teamWallets, additionalWallets);

    let activeTokenBalances = [];
    let teamActiveTokenBalances = [];
    let additionalActiveTokenBalances = [];
    try {
      const mint = new PublicKey(tokenInfo.address);

      const programId = new PublicKey(tokenInfo.programId);

      activeTokenBalances = await Promise.map(wallets, async (item) => {
        if (isValidAddress(item)) {
          try {
            const owner = new PublicKey(item);
            const tokenATA = await getAssociatedTokenAddress(mint, owner, false, programId);
            const tokenAccountInfo = await getAccount(connection, tokenATA, "processed", programId);
            return Number(new BigNumber(tokenAccountInfo.amount.toString() + "e-" + token.decimals.toString()).toString()).toFixed(4);
          }
          catch (err) {
            // console.log(err);
          }
        }
        return "0.0000";
      }, { concurrency: RPC_CONCURRENCY });

      if (teamWallets) {
        teamActiveTokenBalances = await Promise.map(teamWallets, async (item) => {
          if (isValidAddress(item)) {
            try {
              const owner = new PublicKey(item);
              const tokenATA = await getAssociatedTokenAddress(mint, owner, false, programId);
              const tokenAccountInfo = await getAccount(connection, tokenATA, "processed", programId);
              return Number(new BigNumber(tokenAccountInfo.amount.toString() + "e-" + token.decimals.toString()).toString()).toFixed(4);
            }
            catch (err) {
            }
          }
          return "0.0000";
        }, { concurrency: RPC_CONCURRENCY });
      }

      if (additionalWallets) {
        additionalActiveTokenBalances = await Promise.map(additionalWallets, async (item) => {
          if (isValidAddress(item)) {
            try {
              const owner = new PublicKey(item);
              const tokenATA = await getAssociatedTokenAddress(mint, owner, false, programId);
              const tokenAccountInfo = await getAccount(connection, tokenATA, "processed", programId);
              return Number(new BigNumber(tokenAccountInfo.amount.toString() + "e-" + token.decimals.toString()).toString()).toFixed(4);
            }
            catch (err) {
            }
          }
          return "0.0000";
        }, { concurrency: RPC_CONCURRENCY });
      }
    }
    catch (err) {
      activeTokenBalances = wallets.map(() => "0");
      teamActiveTokenBalances = teamWallets ? teamWallets.map(() => "0") : [];
      additionalActiveTokenBalances = additionalWallets ? additionalWallets.map(() => "0") : [];
    }

    console.log("Active Tokens:", activeTokenBalances);
    console.log("Team Active Tokens:", teamActiveTokenBalances);
    console.log("Additional Active Tokens:", additionalActiveTokenBalances);

    setWalletActiveTokenBalanceData(activeTokenBalances);
    setTeamWalletActiveTokenBalanceData(teamActiveTokenBalances);
    setAdditionalWalletActiveTokenBalanceData(additionalActiveTokenBalances);
  };

  const reloadAllActiveTokenBalances = async () => {
    if (tokenInfo || (currentProject.wallets && currentProject.wallets.length > 0) || (currentProject.teamWallets && currentProject.teamWallets.length > 0) || (currentProject.additionalWallets && currentProject.additionalWallets.length > 0)) {
      const wallets = currentProject.wallets.map(item => item.address);
      const teamWallets = currentProject.teamWallets ? currentProject.teamWallets.map(item => item.address) : [];
      const additionalWallets = currentProject.additionalWallets ? currentProject.additionalWallets.map(item => item.address) : [];
      await updateAllActiveTokenBalances(connection, tokenInfo, wallets, teamWallets, additionalWallets);
    }
    else {
      setWalletActiveTokenBalanceData([]);
      setTeamWalletActiveTokenBalanceData([]);
      setAdditionalWalletActiveTokenBalanceData([]);
    }
  }

  useEffect(() => {
    if (tokenInfo || (currentProject.wallets && currentProject.wallets.length > 0) || (currentProject.teamWallets && currentProject.teamWallets.length > 0) || (currentProject.additionalWallets && currentProject.additionalWallets.length > 0)) {
      const wallets = currentProject.wallets.map(item => item.address);
      const teamWallets = currentProject.teamWallets ? currentProject.teamWallets.map(item => item.address) : [];
      const additionalWallets = currentProject.additionalWallets ? currentProject.additionalWallets.map(item => item.address) : [];
      updateAllActiveTokenBalances(connection, tokenInfo, wallets, teamWallets, additionalWallets);
    }
    else {
      setWalletActiveTokenBalanceData([]);
      setTeamWalletActiveTokenBalanceData([]);
      setAdditionalWalletActiveTokenBalanceData([]);
    }
  }, [connection, tokenInfo, currentProject.wallets, currentProject.teamWallets, currentProject.additionalWallets]);

  useEffect(() => {
    const _updateAllBalances = async () => {
      if (refresh) {
        const wallets = currentProject.wallets.map(item => item.address);
        const teamWallets = currentProject.teamWallets ? currentProject.teamWallets.map(item => item.address) : [];
        const additionalWallets = currentProject.additionalWallets ? currentProject.additionalWallets.map(item => item.address) : [];
        setLoadingPrompt("Updating wallet balances...")
        setOpenLoading(true)
        await updateAllActiveTokenBalances(connection, tokenInfo, wallets, teamWallets, additionalWallets)
        setOpenLoading(false)
        setRefresh(false)
      }
    }
    _updateAllBalances()
  }, [refresh])

  const handleMouseDownForResize = (e) => {
    const startY = e.clientY;
    setIsDown(true);

    const handleMouseMove = (e) => {
      const sizeLimit = 600;
      const newHeight = iframeHeight + (e.clientY - startY);
      if (newHeight >= 200 && newHeight < sizeLimit) {
        setIframeHeight(newHeight)
      }
    };

    const handleMouseUp = () => {
      setIsDown(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleCopyTokenAddress = () => {
    if (tokenAddress != "") {
      copy(tokenAddress);
    }
  };

  const handleSearchClick = () => {
    setShowCandidate(true);
  };

  const handleSetToken = async () => {
    setShowCandidate(false);
    if (
      !(
        Object.keys(currentProject).length === 0 &&
        currentProject.constructor === Object
      )
    ) {
      if (tokenAddress === activeTokenAddress) {
        toast.warn("The same mime coin address. Please set another.");
        return;
      }
      if (isValidAddress(tokenAddress)) {
        setActiveTokenAddress(tokenAddress);
        setLoadingPrompt("Updating data...");
        setOpenLoading(true);
      } else {
        toast.warn("Invalid Token Address!");
      }
    } else {
      toast.warn("Please select your project");
    }
  };

  return (
    <dashboardContext.Provider
      value={{
        showChart,
        setShowChart,
        enable100Wallet,
        setEnable100Wallet,
        enableWalletManage,
        setEnableWalletManage,
        tokenAddress,
        setTokenAddress,
        pairAddress,
        setPairAddress,
        pairData,
        setPairData,
        walletActiveTokenBalanceData,
        teamWalletActiveTokenBalanceData,
        additionalWalletActiveTokenBalanceData
      }}
    >
      <div className="w-screen h-screen flex flex-col items-center overflow-auto">
        <TopBar />
        <ControlPanel />
        <div className="w-full h-[30%] grow px-4 pb-4 flex overflow-hidden">
          <div className="w-[30%] grow h-full border border-solid border-white/20">
            {/* <TokenInfoPanel /> */}
            <div className="h-full flex flex-col items-center">
              {/* <div className={`relative w-full h-[${iframeHeight}px] overflow-hidden`}> */}
              <div className={`relative w-full h-full overflow-hidden`}>
                <iframe
                  id="tradingview_061a1"
                  name="tradingview_061a1"
                  src={`https://dexscreener.com/solana/${pairAddress ? pairAddress : "Bzc9NZfMqkXR6fz1DBph7BDf9BroyEf6pnzESP7v5iiw"}?embed=1&theme=dark`}
                  className="w-[100%] h-[100%]"
                />
              </div>
              {/* <div
                className="w-full h-1 bg-transparent cursor-row-resize active:cursor-row-resize"
                onMouseDown={handleMouseDownForResize}
              ></div> */}
            </div>
            {/* <OrderHistory /> */}
          </div>
          <div className="relative w-[500px] h-full flex flex-col border border-solid border-white/20"> {/* rounded-lg border border-white/10 bg-white/5 */}
            <div className="w-full flex flex-col">
              <div className="w-full h-6 flex justify-between items-center gap-2 !rounded-[0] border-b border-solid border-white/20 bg-[#44444426] p-[1px]">
                <CircledButton className="!w-5 grow-0" onClick={handleCopyTokenAddress}>
                  <FaSearch />
                </CircledButton>
                <input
                  className="w-[150px] outline-none bg-transparent grow text-left text-gray-normal"
                  onClick={handleSearchClick}
                  value={tokenAddress}
                  onChange={(e) => console.log(e.target.value)}
                  placeholder="Enter a token address..."
                ></input>
                <CircledButton
                  className="!w-5 grow-0"
                  onClick={() => {
                    setPairData();
                    setActiveTokenAddress("");
                    setTokenAddress("");
                    setShowCandidate(false);
                  }}
                >
                  <FaTimes />
                </CircledButton>
              </div>
              {showCandidate && (
                <TokenSearchPanel
                  setShowCandidate={setShowCandidate}
                  handleSetToken={handleSetToken}
                  tokenAddress={tokenAddress}
                  setTokenAddress={setTokenAddress}
                />
              )}
            </div>
            <div className="w-full h-[20%] grow flex flex-col overflow-auto">
              <TokenInfoPanel />
              {/* <SwapPanel /> */} 
              {activeDashboardPanel === 'trading' && <BundlerWalletManagement />}
              {activeDashboardPanel === 'volumeBot' && <VolumeBotManagement />}
              <WalletManagement />
            </div>
          </div>
        </div>
      </div>
    </dashboardContext.Provider>
  );
}

export default Dashboard;
