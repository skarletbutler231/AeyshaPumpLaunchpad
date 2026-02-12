/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import { useState, useEffect, useContext } from 'react'
import { toast } from "react-toastify";
import axios from 'axios'

import { RxUpdate } from "react-icons/rx";

import { AppContext } from "../../App"
import { dashboardContext } from '../../pages/Dashboard';

import { ExtendedButton } from "../Buttons/Buttons";
import SellPercentDialog from "../../components/Dialogs/SellPercentDialog";

import { formatNumber, isValidAddress, ellipsisAddress } from "../../utils/methods";
import { useWallet } from '@solana/wallet-adapter-react';

const BundlerWalletManagement = () => {

  const { connected } = useWallet()

  const {
    SERVER_URL,
    currentProject,
    walletBalanceData,
    setRefresh,
    activeTokenAddress,
    sigData,
    signingData,
    poolInfo,
    notifyStatus,
    refresh,
    tokenInfo,
  } = useContext(AppContext)

  const { showChart, walletActiveTokenBalanceData } = useContext(dashboardContext)

  const [walletSolBalance, setWalletSolBalance] = useState([]);
  const [walletTokenBalance, setWalletTokenBalance] = useState([]);
  const [totalTokenBalance, setTotalTokenBalance] = useState(0)
  const [totalSolBalance, setTotalSolBalance] = useState(0)

  const [walletAllChecked, setWalletAllChecked] = useState(false);
  const [walletChecked, setWalletChecked] = useState([]);
  const [walletSellAmount, setWalletSellAmount] = useState([]);

  const [mode, setMode] = useState("sell");

  const [sellPercentDialog, setSellPercentDialog] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [gasPriceMultiplier, setGasPriceMultiplier] = useState("");
  const [selectedTokenBalance, setSelectedTokenBalance] = useState(0);

  useEffect(() => {
    if (notifyStatus.tag === "EXECUTE_COMPLETED") {
      if (notifyStatus.success)
        toast.success("Trading success");
      else
        toast.warn("Failed to trade");

      setIsExecuting(false);
      setRefresh(!refresh)
      setWalletSellAmount(currentProject.wallets.map(() => ""));
      // setNotifyStatus({ success: true, tag: "NONE" });
    }
  }, [notifyStatus, currentProject._id]);

  useEffect(() => {
    if (currentProject.wallets) {
      if (currentProject.wallets.length !== walletChecked.length) {
        const newWalletChecked = currentProject.wallets.map(() => false);
        setWalletChecked(newWalletChecked);
        setWalletAllChecked(false);

        setWalletSellAmount(currentProject.wallets.map(() => ""));
        // setWalletTransferOnSale(currentProject.wallets.map(() => false));
      }

      setWalletSolBalance(currentProject.wallets.map(() => "-"));
      setWalletTokenBalance(currentProject.wallets.map(() => "0"));
    }
    else {
      setWalletAllChecked(false);
      setWalletChecked([]);
      setWalletSolBalance([]);
      setWalletTokenBalance([]);
      setWalletSellAmount([]);
      // setWalletTransferOnSale([]);
    }
  }, [currentProject.wallets, walletChecked.length]);

  useEffect(() => {
    if (walletActiveTokenBalanceData.length === walletTokenBalance.length) {
      setWalletTokenBalance(walletActiveTokenBalanceData);
      let _total = 0
      walletActiveTokenBalanceData && walletActiveTokenBalanceData.map((_balance) => { _total += Number(_balance) })
      setTotalTokenBalance(_total)
    }
  }, [activeTokenAddress, walletBalanceData.address, walletActiveTokenBalanceData]);

  useEffect(() => {
    if (walletBalanceData.sol.length === walletSolBalance.length) {
      setWalletSolBalance(walletBalanceData.sol);
      let _total = 0
      walletBalanceData.sol && walletBalanceData.sol.map((_balance) => { _total += Number(_balance) })
      setTotalSolBalance(_total)
    }
  }, [activeTokenAddress, walletBalanceData.address, walletBalanceData.sol, walletSolBalance.length]);

  useEffect(() => {
    setWalletSellAmount(currentProject.wallets?.map(() => ""));
  }, [mode])

  const handleWalletAllChecked = () => {
    const newWalletAllChecked = !walletAllChecked;
    setWalletAllChecked(newWalletAllChecked);
    setWalletChecked(walletChecked.map(() => newWalletAllChecked));
    let sum = 0;
    if (newWalletAllChecked) {
      walletSellAmount.map((v) => (sum = sum + Number(v)));
    }
    setSelectedTokenBalance(sum);
  };

  const formatThousandSeparator = (num) => {
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const handleWalletChanged = (index, key, value) => {
    if (key === "checked") {
      let newWalletChecked = [...walletChecked];
      newWalletChecked[index] = !newWalletChecked[index];

      if (value) {
        setSelectedTokenBalance(selectedTokenBalance + Number(walletSellAmount[index]))
      } else {
        setSelectedTokenBalance(selectedTokenBalance - Number(walletSellAmount[index]))
      }

      setWalletChecked(newWalletChecked);

      let newWalletAllChecked = true;
      for (let i = 0; i < newWalletChecked.length; i++)
        newWalletAllChecked &&= newWalletChecked[i];
      setWalletAllChecked(newWalletAllChecked);
    }
    else if (key === "sell_percent") {
      let newWalletSellAmount = [...walletSellAmount];
      console.log(value)
      const inputValue = value.replace(/,/g, '');
      console.log(inputValue)
      if (walletChecked[index]) {
        let new_balance = selectedTokenBalance - Number(walletSellAmount[index]);
        new_balance += Number(inputValue);
        setSelectedTokenBalance(new_balance);
      }
      newWalletSellAmount[index] = inputValue;
      console.log(newWalletSellAmount[index])
      setWalletSellAmount(newWalletSellAmount);
    }
  };

  const handleSetPercent = async () => {
    const selectedWallets = walletChecked.filter((item) => item === true);
    if (selectedWallets.length === 0) {
      toast.warn("Please select wallets to set % amount");
      return;
    }
    setSellPercentDialog(true);
  };

  const handleOKSellPercent = (percent) => {
    let newWalletSellAmount = [...walletSellAmount];
    let sum = 0;
    for (let i = 0; i < newWalletSellAmount.length; i++) {
      if (walletChecked[i]) {
        let calculatedValue = (mode == "sell" ? Number(walletTokenBalance[i]) : Number(walletSolBalance[i])) * Number(percent) / 100.0;
        newWalletSellAmount[i] = calculatedValue.toString()
        sum += calculatedValue;
      }
    }
    setSelectedTokenBalance(sum);
    setWalletSellAmount(newWalletSellAmount);
    setSellPercentDialog(false);
  };

  const handleMouseDown = (e, id) => {
    e.preventDefault();
    setIsDragging(true);
    handleWalletChanged(id, "checked", !walletChecked[id])
  };

  const handleMouseEnter = (id) => {
    if (isDragging) {
      handleWalletChanged(id, "checked", !walletChecked[id])
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleExecute = async () => {
    // if (mode == "sell") {
    //   await handleSellTokens(false);
    // } else {
    //   await handleBuyTokens(false);
    // }
    if (!currentProject._id)
      return;

    if (!connected) {
      toast.warn("Please connect wallet!");
      return;
    }

    if (!tokenInfo || !tokenInfo?.address || !isValidAddress(tokenInfo.address)) {
      toast.warn("No token is set")
      return;
    }

    const validWalletChecked = walletChecked.filter(item => item === true);
    // const validTeamWalletChecked = currentProject.teamWallets ? teamWalletChecked.filter(item => item === true) : [];
    if (validWalletChecked.length === 0) {
      // if (validWalletChecked.length === 0 && validTeamWalletChecked.length === 0) {
      toast.warn("Please check wallets to sell tokens");
      return;
    }

    let wallets = [];
    for (let i = 0; i < currentProject.wallets.length; i++) {
      if (!walletChecked[i])
        continue;

      const amount = Number(walletSellAmount[i].replaceAll(",", ""));
      console.log(amount)
      if (isNaN(amount) || amount <= 0) {
        toast.warn(`Wallet #${i + 1}: Invalid percentage`);
        return;
      }

      wallets = [
        ...wallets,
        {
          address: currentProject.wallets[i].address,
          amount: amount,
          // transferOnSale: walletTransferOnSale[i],
        }
      ];
    }

    // setLoadingPrompt("Selling tokens...");
    // setOpenLoading(true);
    setIsExecuting(true);
    try {
      await axios.post(`${SERVER_URL}/api/v1/project/execute-sale`,
        {
          projectId: currentProject._id,
          token: tokenInfo,
          wallets: wallets,
          mode,
          useBundle: true,
          teamWallets: [],
          poolInfo,
          sigData,
          signingData
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    } catch (err) {
      console.log(err);
      toast.warn("Failed to sell tokens!");
      // setOpenLoading(false);
    }
  }

  return (
    <div className={`w-full h-fit max-h-[600px] p-2 flex flex-col bg-[#44444426]`}>
      <SellPercentDialog isOpen={sellPercentDialog} onOK={handleOKSellPercent} onCancel={() => setSellPercentDialog(false)} />
      <div className="h-fit flex items-center justify-between font-medium text-left py-2 overflow-hidden overflow-ellipsis text-nowrap">
        <span className='text-sm'>Trading Panel{tokenInfo.symbol ? " - " + tokenInfo.symbol : ""}</span>
        <div className='cursor-pointer hover:scale-110 active:scale-90' onClick={() => setRefresh(true)}><RxUpdate /></div>
      </div>
      <div className="flex justify-between items-center mb-1">
        <div className="flex gap-3 items-center">
          <div className="flex gap-1">
            <div className="text-white/70 text-nowrap">
              Token Total Balance :
            </div>
            <div>
              {formatNumber(totalTokenBalance)}
            </div>
          </div>
          <div className='flex'>
            {tokenInfo.totalSupply ? (totalTokenBalance * 100 / Number(tokenInfo.totalSupply)).toFixed(2) : 0}%
          </div>
          <div className="flex items-center gap-1">
            <img src="/assets/icon/ic_sol.png" className='w-3.5 h-3.5' />
            <div className="text-xxs">{formatNumber(totalSolBalance)} Sol</div>
          </div>
        </div>
      </div>
      <div className="flex justify-between items-center mb-2">
        <div className="flex gap-1">
          <div className="text-white/70">
            Total Amount :
          </div>
          <div className="text-xxs text-yellow-normal">{formatNumber(selectedTokenBalance)}</div>
        </div>
      </div>
      <div className='mb-3 h-8 flex gap-3 justify-between'>
        <div className='w-[70%] flex gap-2'>
          <div className='container-gradient !w-[60%] h-full !p-px flex !rounded-md !border !border-solid !border-gray-border gap-px'>
            <div className={`${mode == "buy" ? "bg-green-button" : ""} w-[50%] rounded-md p-[1px]`}>
              <ExtendedButton className={`${mode == "buy" ? "bg-black/50" : "bg-transparent hover:bg-gray-highlight"} !h-full w-full`} onClick={() => setMode("buy")}>BUY</ExtendedButton>
            </div>
            <div className={`${mode != "buy" ? "bg-green-button" : ""} w-[50%] rounded-md p-[1px]`}>
              <ExtendedButton className={`${mode != "buy" ? "bg-black/50" : "bg-transparent hover:bg-gray-highlight"} !h-full w-full`} onClick={() => setMode("sell")}>SELL</ExtendedButton>
            </div>
          </div>
          <ExtendedButton className="container-gradient !w-[40%] h-full !rounded-md !border !border-solid !border-gray-border hover:!bg-gray-highlight" onClick={handleSetPercent}>
            Set % Amount
          </ExtendedButton>
        </div>
        <div className='w-[25%] p-px bg-green-button rounded-md'>
          <ExtendedButton className="w-full h-full !bg-black hover:!bg-gray-highlight" onClick={handleExecute} disabled={isExecuting}>
            Execute
            {isExecuting && (
              <div role="status">
                <svg
                  aria-hidden="true"
                  className="inline w-4 h-4 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600"
                  viewBox="0 0 100 101"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                    fill="#FFFFFF"
                  />
                  <path
                    d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                    fill="#4B65FF"
                  />
                </svg>
                <span className="sr-only">Loading...</span>
              </div>
            )}
          </ExtendedButton>
        </div>
      </div>
      <div className={`relative overflow-x-auto ${showChart && isValidAddress(activeTokenAddress) ? "" : ""} overflow-y-auto scroll`}>
        <table className="w-full text-left rtl:text-right text-gray-500 dark:text-gray-400">
          <thead className="sticky top-0 font-['Inter'] text-white bg-[#2B2E33]">
            <tr>
              <th scope="col" className="pl-1 py-1">
                <input type="checkbox"
                  className="w-3 h-3 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  checked={walletAllChecked}
                  onChange={handleWalletAllChecked} />
              </th>
              <th scope="col" className="pl-1 py-1 text-center">
                No
              </th>
              <th
                scope="row"
                className="flex flex-row items-center gap-1 p-1"
              >
                Wallet
              </th>
              <th scope="col" className="pl-1 py-1 text-nowrap overflow-hidden overflow-ellipsis">
                <div className='flex items-center gap-0.5'>
                  <img
                    src={tokenInfo.logo ? tokenInfo.logo : "/assets/icon/ic_question.svg"}
                    className="w-4 h-4 rounded-full"
                    alt="token-logo"
                  />
                  Token
                </div>
              </th>
              <th scope="col" className="pl-1 py-1 text-nowrap overflow-hidden overflow-ellipsis">
                Amount
              </th>
              <th scope="col" className="px-1 py-1 text-nowrap overflow-hidden overflow-ellipsis">
                <div className='flex items-center gap-0.5'>
                  <img
                    src="/assets/icon/ic_sol.png"
                    className="w-4 h-4 rounded-full"
                    alt="sol-logo"
                  />
                  SOL
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {currentProject.wallets && currentProject.wallets.length > 0 && currentProject.wallets.map((_v, _i) => {
              return (
                <tr key={_i}>
                  <td className='pl-1 pt-2'>
                    <div
                      onMouseDown={(e) => handleMouseDown(e, _i)}
                      onMouseEnter={() => handleMouseEnter(_i)}
                      onMouseUp={handleMouseUp}
                      className='flex justify-center items-center'
                    >
                      <input
                        type="checkbox"
                        checked={walletChecked[_i] ? walletChecked[_i] : false}
                        onChange={(e) => console.log(e.target.value)}
                        className="w-3 h-3 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                    </div>
                  </td>
                  <td className='pl-1 pt-2 text-center'>{_i + 1}</td>
                  <td
                    scope="row"
                    className="pl-1 pt-2 font-medium text-gray-900 whitespace-nowrap dark:text-white"
                  >
                    <div className="w-[8vh] flex items-center">

                      <label
                        htmlFor="default-checkbox"
                        className="ms-1 font-medium text-gray-300 dark:text-gray-300 overflow-hidden"
                      >
                        {ellipsisAddress(_v.address, false)}
                      </label>
                    </div>
                  </td>
                  <td className="pl-1 pt-2">{walletTokenBalance[_i]}</td>
                  <td className="pl-1 pt-2">
                    <div className="w-[80px] bg-gray-border rounded-md p-px">
                      <input
                        type="number"
                        className="w-full h-full rounded-md bg-[#111214] font-semibold text-xs px-2 text-orange placeholder:text-orange"
                        placeholder='0.0'
                        value={walletSellAmount[_i] ? walletSellAmount[_i] : ""}
                        onChange={(e) => handleWalletChanged(_i, "sell_percent", e.target.value)}
                      />
                    </div>
                  </td>
                  <td className="pl-1 pt-2">{walletSolBalance[_i]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BundlerWalletManagement;
