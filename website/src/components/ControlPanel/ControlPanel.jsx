/* eslint-disable no-unused-vars */
import { useContext, useEffect, useState } from "react";

import Skeleton from "react-loading-skeleton";

import { GiWallet } from "react-icons/gi";
import { FaChartArea, FaDownload, FaRegCopy, FaUpload } from "react-icons/fa";

import { ToggleButton } from "../Buttons/Buttons";
import { dashboardContext } from "../../pages/Dashboard";
import { AppContext } from "../../App";
import copy from "copy-to-clipboard";
import { toast } from "react-toastify";
import * as ENV from "../../config/env";
import axios from "axios";
import {
  ellipsisAddress,
  formatNumber,
} from "../../utils/methods";
import { Switch } from "../Primary/Elements";
import UploadWalletDialog from "../Dialogs/UploadWalletDialog";

const ControlPanel = () => {
  const {
    showChart,
    setShowChart,
    enableWalletManage,
    setEnableWalletManage,
    enable100Wallet,
    setEnable100Wallet,
    selectedPairId,
    pairData,
    walletActiveTokenBalanceData
  } = useContext(dashboardContext);

  const {
    activeWallet,
    tokenInfo,
    currentProject,
    walletBalanceData,
    sigData,
    signingData,
    loadAllProjects,
    setLoadingPrompt,
    setOpenLoading,
  } = useContext(AppContext);

  const [copied, setCopied] = useState({});
  const [solPrice, setsolPrice] = useState(0);
  const [walletIndex, setWalletIndex] = useState(0);
  const [showUploadWalletDialog, setShowUploadWalletDialog] = useState(false);

  useEffect(() => {
    if (pairData) {
      setsolPrice(
        parseFloat(pairData.priceUsd) /
        parseFloat(pairData.priceNative)
      );
    }
  }, [pairData]);

  useEffect(() => {
    let index;
    if (activeWallet && currentProject && currentProject.wallets && currentProject.wallets.length > 0) {
      index = currentProject.wallets.findIndex((wallet) => (wallet.address === activeWallet.address));
      setWalletIndex(index);
    }
  }, [tokenInfo, activeWallet, currentProject]);

  const handleCopyPublicKey = () => {
    if (activeWallet) {
      copy(activeWallet.address);
    }
  };

  const copyToClipboard = async (key, text) => {
    if ('clipboard' in navigator) {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
      setCopied({
        ...copied,
        [key]: true,
      });
      setTimeout(() => setCopied({
        ...copied,
        [key]: false,
      }), 2000);
    }
    else
      console.error('Clipboard not supported');
  };

  const handleCopyPrivateKey = async () => {
    if (activeWallet && activeWallet.address != "") {
      const { data } = await axios.post(
        `${ENV.SERVER_URL}/api/v1/project/get-wallet-private-key`,
        {
          projectId: currentProject._id,
          address: activeWallet.address,
          sigData,
          signingData
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      copy(data);
    }
  };

  const handleDownloadWallets = async () => {
    if (
      !(
        Object.keys(currentProject).length === 0 &&
        currentProject.constructor === Object
      )
    ) {
      const { data } = await axios.post(
        `${ENV.SERVER_URL}/api/v1/project/download-wallets`,
        {
          projectId: currentProject._id,
          sigData,
          signingData
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      const blob = new Blob([data], { type: "text/csv;charset=utf-8;" });

      // Generate a URL from the Blob
      const url = URL.createObjectURL(blob);

      // Create a temporary link element and trigger the download
      const link = document.createElement("a");
      link.href = url;
      link.download = "wallets.csv"; // Specify the name of the CSV file
      link.style.display = "none"; // Make the link invisible
      document.body.appendChild(link);
      link.click(); // Simulate a click to start the download
      document.body.removeChild(link); // Remove the link from the document

      // Clean up by revoking the Blob URL
      URL.revokeObjectURL(url);
    } else {
      toast.warn("Please select your project");
    }
  };

  const handleUploadWallets = async (privateKeys) => {
    if (
      !(
        Object.keys(currentProject).length === 0 &&
        currentProject.constructor === Object
      )
    ) {
      setOpenLoading(true)
      setLoadingPrompt("Uploading Wallets...")
      try {
        const { data } = await axios.post(
          `${ENV.SERVER_URL}/api/v1/project/upload-wallets`,
          {
            projectId: currentProject._id,
            privateKeys,
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
          toast.success("Success!")
          await loadAllProjects(currentProject._id)
          setShowUploadWalletDialog(false)
        }
      } catch (err) {
        console.log(err)
      }

      setOpenLoading(false);
    } else {
      toast.warn("Please select your project");
    }
  };

  const handleUploadButtonClick = async () => {
    if (
      !(
        Object.keys(currentProject).length === 0 &&
        currentProject.constructor === Object
      )
    ) {
      setShowUploadWalletDialog(true)
    } else {
      toast.warn("Please select your project");
    }
  };

  return (
    <div className="w-full px-4 pt-2 pb-1 grid grid-cols-12 justify-between items-center">
      <UploadWalletDialog isOpen={showUploadWalletDialog} onOK={handleUploadWallets} onCancel={() => setShowUploadWalletDialog(false)} />
      <div className="flex flex-row col-span-3 items-center justify-start gap-10">
        {/* <div className="flex flex-col gap-2">
          <div className="flex gap-5">
            <div className="font-medium">Active Wallet</div>
            <div className="flex gap-4">
              <img
                className="w-4 h-4 active:scale-95 hover:scale-110 transition duration-100 ease-in-out transform cursor-pointer"
                src="/assets/icon/ic_copy.svg"
                alt="copy"
                onClick={handleCopyPublicKey}
              />
            </div>
          </div>
          <div className="font-medium overflow-hidden text-nowrap overflow-ellipsis">
            {activeWallet && activeWallet.address ? (
              ellipsisAddress(activeWallet.address, true)
            ) : (
              <Skeleton
                baseColor="#232334"
                style={{ height: "100%" }}
                highlightColor="#444157"
              />
            )}
          </div>
        </div> */}
        {/* <div className="flex flex-row items-center justify-between gap-5">
          <div className="flex flex-col gap-2">
            <div className="font-medium">SOL</div>
            <div className="max-w-[80px] font-medium overflow-hidden text-nowrap overflow-ellipsis">
              {walletBalanceData && walletBalanceData.sol && walletBalanceData.sol.length > 0 ? (
                formatNumber(walletBalanceData.sol[walletIndex], 4)
              ) : (
                <Skeleton
                  baseColor="#232334"
                  style={{ height: "100%" }}
                  highlightColor="#444157"
                />
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="font-medium">
              {tokenInfo && tokenInfo.symbol ? (
                tokenInfo.symbol
              ) : (
                <Skeleton
                  baseColor="#232334"
                  style={{ height: "100%", width: 30 }}
                  highlightColor="#444157"
                />
              )}
            </div>
            <div className="max-w-[120px] font-medium overflow-hidden text-nowrap overflow-ellipsis">
              {walletActiveTokenBalanceData && walletActiveTokenBalanceData.length > 0 ? (
                formatNumber(walletActiveTokenBalanceData[walletIndex], 4)
              ) : (
                <Skeleton baseColor="#232334" highlightColor="#444157" />
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="font-medium">Value</div>
            <div className="max-w-[90px] font-medium overflow-hidden text-nowrap overflow-ellipsis">
              {walletBalanceData?.sol?.length > 0 && walletBalanceData?.token?.length > 0 && solPrice ? (
                `$${(
                  parseFloat(walletBalanceData.sol[walletIndex]) * solPrice +
                  parseFloat(walletActiveTokenBalanceData[walletIndex]) *
                  parseFloat(pairData?.priceUsd)).toFixed(4)
                }`
              ) : (
                <Skeleton
                  baseColor="#232334"
                  style={{ width: "100%" }}
                  highlightColor="#444157"
                />
              )}
            </div>
          </div>
        </div> */}
        <div className="flex gap-2 items-center">
          <div className="font-medium">Main CA:</div>
          <div className="">{`${currentProject?.token?.symbol ? currentProject?.token?.symbol : "N/a"}(${currentProject?.token?.name ? currentProject?.token?.name : "N/a"})`}</div>
          <div className="">{ellipsisAddress(currentProject?.token?.address)}</div>
          {
            copied["mainca"] ?
              (<svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>) :
              (<FaRegCopy className="w-3 h-3 transition ease-in-out transform cursor-pointer active:scale-95 duration-90" onClick={() => copyToClipboard("mainca", currentProject?.token?.address ? currentProject?.token?.address : "")} />)
          }
        </div>
      </div>

      <div className="font-14-special col-span-2 flex items-center justify-center hover:text-white cursor-pointer">

      </div>
      <div className="flex col-span-7 gap-4 justify-end">
        {/* <div className="flex gap-2 items-center">
          <div className="text-left">
            Hide Chart
          </div>
          <Switch className={'min-w-12 w-12'} checked={showChart} onSwitch={(v) => setShowChart(v)} />
          <div className="text-left">
            Show Chart
          </div>
        </div> */}
        {/* <div className="flex gap-2 items-center">
          <div className="text-left">
            Wallet<br />Management
          </div>
          <Switch className={'min-w-12 w-12'} checked={enableWalletManage} onSwitch={(v) => setEnableWalletManage(v)} />
        </div> */}
        {/* <div className="flex gap-2 items-center">
          <div className="text-left">
            Enable<br />100 Wallets
          </div>
          <Switch className={'min-w-12 w-12'} checked={enable100Wallet} onSwitch={(v) => setEnable100Wallet(v)} />
        </div> */}
        <div
          className="p-1 rounded-md bg-gray-highlight hover:bg-gray-border active:bg-gray-normal flex flex-row gap-2 items-center cursor-pointer"
          onClick={handleDownloadWallets}
        >
          <div className="text-left">
            Download Wallets
          </div>
          <FaDownload size={12} />
        </div>
        <div
          className="p-1 rounded-md bg-gray-highlight hover:bg-gray-border active:bg-gray-normal flex flex-row gap-2 items-center cursor-pointer"
          onClick={handleUploadButtonClick}
        >
          <div className="text-left">
            Upload Wallets
          </div>
          <FaUpload size={12} />
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
