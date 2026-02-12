import { CircledButton, RoundedButton } from "../Buttons/Buttons";
import { useContext, useEffect, useRef, useState } from "react";
import axios from "axios";

import { FaCheck } from "react-icons/fa";
import { FaTimes } from "react-icons/fa";

import { dashboardContext } from "../../pages/Dashboard";

import { toast } from "react-toastify";
// import { GoPlus, ErrorCode } from "@goplus/sdk-node";
import { formatNumber, isValidAddress } from "../../utils/methods";
import { AppContext } from "../../App";
import TokenSearchPanel from "./TokenSearchPanel";
import copy from "copy-to-clipboard";
import { GradientDiv } from "../Primary/Elements";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getBondingCurveAddress } from "../../utils/solana";
import * as anchor from "@project-serum/anchor";

const TokenInfoPanel = () => {
  const {
    showChart,
    setPairAddress,
    pairData,
    setPairData,
    tokenAddress,
    setTokenAddress
  } = useContext(dashboardContext);

  const {
    currentProject,
    activeTokenAddress,
    setActiveTokenAddress,
    setLoadingPrompt,
    setOpenLoading,
    tokenInfo,
    setTokenInfo,
    pairInfo
  } = useContext(AppContext);

  const { connection } = useConnection();
  const { connected, publicKey } = useWallet()
  const wallet = useAnchorWallet();
  const provider = new anchor.AnchorProvider(connection, wallet, anchor.AnchorProvider.defaultOptions);


  const [overviewTime, setOverviewTime] = useState("h24");
  const [tokenAudit, setTokenAudit] = useState();

  const DEFAULT_IFRAME_HEIGHT = 300;

  const [gettingPairData, setGettingPairData] = useState(false);
  const [gettingAudit, setGettingAudit] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(DEFAULT_IFRAME_HEIGHT);
  const [showCandidate, setShowCandidate] = useState(false);
  const [isDown, setIsDown] = useState(false);
  const infoRef = useRef();
  const iframeRef = useRef();

  useEffect(() => {
    if (showChart && connected && pairInfo) {
      const viewportHeight =
        window.innerHeight > 1000 ? 1000 : window.innerHeight;
      const sizeLimit = viewportHeight - 390;
      if (sizeLimit - iframeHeight < 200) {
        setIframeHeight(sizeLimit);
      }
    } else {
      setIframeHeight(DEFAULT_IFRAME_HEIGHT);
    }
  }, [showChart, pairInfo, tokenInfo]);

  useEffect(() => {
    setPairData();
    setTokenAudit();

    if (pairInfo) {
      setPairAddress(pairInfo.pairAddress);
    } else {
      getBondingCurveAddress(provider, activeTokenAddress).then((v) => {
        console.log("Getting Pairs", v)
        setPairAddress(v);
      })
    }

    let intervalId;
    if (pairInfo) {
      getTokenPairData();
      getTokenAudit();
      intervalId = setInterval(() => {
        getTokenPairData();
        getTokenAudit();
      }, 60000)
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [pairInfo]);

  useEffect(() => {
    if (activeTokenAddress !== "") setTokenAddress(activeTokenAddress);
  }, [activeTokenAddress])

  const getTokenPairData = async () => {
    if (pairInfo) {
      setGettingPairData(true);
      const url = `https://api.dexscreener.io/latest/dex/pairs/solana/${pairInfo.pairAddress}`;
      const result = await axios.get(url, {
        headers: { "Content-Type": "application/json" },
      });
      if (result?.data?.pairs) {
        console.log("---token pair", result.data.pairs[0])
        setPairData(result.data.pairs[0]);
      } else {
        setPairData();
      }
      // return result.data.pa
      setGettingPairData(false);
    } else {
      setPairData()
    }
  };

  const getTokenAudit = async () => {
    // setGettingAudit(true);
    // const res = await GoPlus.tokenSecurity(chainId, activeTokenAddress, 30);
    // if (res.code != ErrorCode.SUCCESS) {
    //   console.error("-----------TokenAudit", res.message);
    // } else {
    //   setTokenAudit(Object.values(res.result)[0]);
    // }
    // setGettingAudit(false);
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

  const handleOpenSite = () => {
    if (pairData) {
      const website_url = pairData?.info?.websites[0]?.url;
      if (website_url) {
        window.open(website_url, "_blank", "noopener,noreferrer");
      }
    }
  };

  const handleOpenSocial = (social_type) => {
    if (pairData) {
      const socials = pairData.info.socials;
      const telegram = socials.filter(
        (element) => element.type === social_type
      );

      if (telegram) {
        window.open(telegram[0].url, "_blank", "noopener,noreferrer");
      }
    }
  };

  const handleRefresh = () => {
    if (activeTokenAddress !== "" && !gettingAudit && !gettingPairData) {
      console.log("Refresh clicked");
      getTokenPairData();
      getTokenAudit();
    }
  };

  const handleOpenDexScreener = () => {
    if (
      tokenInfo &&
      tokenInfo.address !== "" &&
      isValidAddress(tokenInfo.address)
    ) {
      window.open(
        `https://dexscreener.com/solana/${tokenInfo.address}`,
        "_blank",
        "noopener,noreferrer"
      );
    }
  };

  const handleOpenSolscan = () => {
    if (
      tokenInfo &&
      tokenInfo.address !== "" &&
      isValidAddress(tokenInfo.address)
    ) {
      window.open(
        `https://solscan.io/token/${tokenInfo.address}`,
        "_blank",
        "noopener,noreferrer"
      );
    }
  };

  const handleMouseDownForResize = (e) => {
    const startY = e.clientY;
    setIsDown(true);

    const handleMouseMove = (e) => {
      const sizeLimit = 600;
      const newHeight = iframeHeight + (e.clientY - startY);
      if (newHeight >= 200 && newHeight < sizeLimit) {
        // if (e.clientY - startY > 0 && sizeLimit - newHeight < 200) {
        //   setIframeHeight(sizeLimit);
        //   setViewMode(1);
        // } else if (
        //   e.clientY - startY < 0 &&
        //   sizeLimit - newHeight < 200
        // ) {
        //   setIframeHeight(sizeLimit - 200);
        //   setViewMode(0);
        // } else {
        //   setIframeHeight(newHeight);
        //   setViewMode(0);
        // }
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

  const handleSearchClick = () => {
    setShowCandidate(true);
  };

  const handleCopyTokenAddress = () => {
    if (tokenAddress != "") {
      copy(tokenAddress);
    }
  };

  return (
    <div className="hidden p-2 flex-col gap-2 rounded-lg border border-white/10 bg-white/5" ref={infoRef}>
      <div className="flex flex-col gap-2 items-center">
        <div className="flex items-center">
          <img
            src={
              tokenInfo && tokenInfo.logo && tokenInfo.logo !== ""
                ? tokenInfo.logo
                : pairData ? pairData?.info?.imageUrl : "/assets/icon/ic_question.svg"
            }
            className="rounded-[50%] mr-[11px]"
            width={20}
            height={20}
            alt="token-logo"
            onError={() => {
              setTokenInfo({
                ...tokenInfo,
                logo: "/assets/icon/ic_question.svg"
              })
            }}
          />
          <div className="text-base mr-1 text-nowrap">
            {pairData && pairData.baseToken.symbol} /
          </div>
          <div className="text-base">
            {pairData && pairData.quoteToken.symbol}
          </div>
        </div>
        {pairData && <div id="social-buttons" className="flex items-center gap-4">
          {
            pairData.info?.websites && pairData.info.websites.map((item) =>
              <a href={item.url} target="_blank">
                <img
                  className="w-3.5 h-3.5 active:scale-95 hover:scale-110 transition duration-100 ease-in-out transform cursor-pointer"
                  src="/assets/icon/ic_www.svg"
                  alt="responsive"
                />
              </a>
            )
          }
          {
            pairData.info?.socials && pairData.info.socials.map((item) => {
              if (item.type == "telegram") {
                return <a href={item.url} target="_blank">
                  <img
                    className="w-3.5 h-3.5 active:scale-95 hover:scale-110 transition duration-100 ease-in-out transform cursor-pointer"
                    src="/assets/icon/ic_telegram.svg"
                    alt="telegram"
                  />
                </a>
              } else if (item.type == "twitter") {
                return <a href={item.url} target="_blank">
                  <img
                    className="w-3.5 h-3.5 active:scale-95 hover:scale-110 transition duration-100 ease-in-out transform cursor-pointer"
                    src="/assets/icon/ic_twitter.svg"
                    alt="twitter"
                  />
                </a>
              }
            })
          }
          <button onClick={handleOpenDexScreener}>
            <img
              className="w-3.5 h-3.5 active:scale-95 hover:scale-110 transition duration-100 ease-in-out transform cursor-pointer"
              src="/assets/icon/ic_dexscreener.svg"
              alt="dexscreenr"
            />
          </button>
          <button onClick={handleOpenSolscan}>
            <img
              className="w-3.5 h-3.5 active:scale-95 hover:scale-110 transition duration-100 ease-in-out transform cursor-pointer"
              src="/assets/icon/ic_etherscan.svg"
              alt="etherscan"
            />
          </button>
        </div>
        }
        {/* <div id="search-entry" className="flex items-center gap-2">
            <div className="flex gap-4">
              <button onClick={handleRefresh}>
                <img
                  className="active:scale-95 hover:scale-110 transition duration-100 ease-in-out transform cursor-pointer"
                  src="/assets/icon/ic_refresh.svg"
                  width={14}
                  alt="refresh"
                />
              </button>
            </div>
            <div className="w-[200px] flex flex-col">
              <div className="container-gradient w-full h-6 flex justify-between items-center gap-2 rounded-full border border-solid border-white/20 p-[1px]">
                <CircledButton className="!w-5 grow-0" onClick={handleCopyTokenAddress}>
                  <FaCheck />
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
                    setTokenAudit();
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
          </div> */}
      </div>
      <div className="container-gradient p-2 flex flex-col gap-1.5">
        <div className="flex gap-4 justify-between">
          <div className="flex flex-col gap-1 items-center">
            <span className="font-medium text-[#BBBCBD]">Supply</span>
            <span className="text-xs font-medium">
              {tokenInfo && tokenInfo.totalSupply && tokenInfo.decimals
                ? formatNumber(parseFloat(tokenInfo?.totalSupply.toString()))
                : ""}
            </span>
          </div>
          <div className="flex flex-col gap-1 items-center">
            <span className="font-medium text-[#BBBCBD]">MCap</span>
            <span className="text-xs font-medium">
              {pairData && pairData
                ? `$${formatNumber(pairData.fdv)}`
                : ""}
            </span>
          </div>
          <div className="flex flex-col gap-1 items-center">
            <span className="font-medium text-[#BBBCBD]">SOL Pool</span>
            <span className="text-xs font-medium">
              {pairData && pairData.liquidity?.quote
                ? pairData.liquidity?.quote
                : ""}
            </span>
          </div>
          <div className="flex flex-col gap-1 items-center">
            <span className="font-medium text-[#BBBCBD]">SPL Pool</span>
            <span className="text-xs font-medium">
              {pairData &&
                formatNumber(pairData?.liquidity?.base)
                ? formatNumber(pairData?.liquidity?.base)
                : ""}
            </span>
          </div>
          <div className="flex flex-col gap-1 items-center">
            <span className="font-medium text-[#BBBCBD]">24H Vol</span>
            <span className="text-xs font-medium">
              {pairData &&
                formatNumber(pairData.volume.h24)
                ? formatNumber(pairData.volume.h24)
                : ""}
            </span>
          </div>
        </div>
      </div>
      <div className="w-full flex flex-col border-gray-highlight border justify-between items-center">
        <div className="w-full grid grid-flow-col items-center">
          {/* <GradientDiv>
              <div className="px-2 py-px">Token Info</div>
            </GradientDiv> */}
          <div
            className={`${overviewTime === "m5" ? "bg-gray-highlight" : "bg-transparent"
              } border-gray-highlight border content-center grid-cols-3 py-2`}
            onClick={() => setOverviewTime("m5")}
          >
            5M
            <div className={`text-xs font-medium ${pairData && (pairData?.priceChange["m5"] >= 0 ? 'text-green-dark' : 'text-red-normal')}`}>
              {pairData && pairData?.priceChange["m5"]}%
            </div>
          </div>
          <div
            className={`${overviewTime === "h1" ? "bg-gray-highlight" : "bg-transparent"
              } border-gray-highlight border content-center grid-cols-3 py-2`}
            onClick={() => setOverviewTime("h1")}
          >
            1H
            <div className={`text-xs font-medium ${pairData && (pairData?.priceChange["h1"] >= 0 ? 'text-green-dark' : 'text-red-normal')}`}>
              {pairData && pairData?.priceChange["h1"]}%
            </div>
          </div>
          <div
            className={`${overviewTime === "h6" ? "bg-gray-highlight" : "bg-transparent"
              } border-gray-highlight border content-center grid-cols-3 py-2`}
            onClick={() => setOverviewTime("h6")}
          >
            6H
            <div className={`text-xs font-medium ${pairData && (pairData?.priceChange["h6"] >= 0 ? 'text-green-dark' : 'text-red-normal')}`}>
              {pairData && pairData?.priceChange["h6"]}%
            </div>
          </div>
          <div
            className={`${overviewTime === "h24" ? "bg-gray-highlight" : "bg-transparent"
              } border-gray-highlight border content-center grid-cols-3 py-2`}
            onClick={() => setOverviewTime("h24")}
          >
            24H
            <div className={`text-xs font-medium ${pairData && (pairData?.priceChange["h24"] >= 0 ? 'text-green-dark' : 'text-red-normal')}`}>
              {pairData && pairData?.priceChange["h24"]}%
            </div>
          </div>
        </div>
        <div className="p-2 flex items-center gap-3 justify-end">
          <div className="text-xxs">
            <span className="font-medium text-green-dark">Buys: </span>
            <span className="text-xs font-medium">
              {pairData && pairData?.txns[overviewTime]?.buys}
            </span>
          </div>
          <div className="text-xxs">
            <span className="font-medium text-red-normal">Sell: </span>
            <span className="text-xs font-medium">
              {pairData && pairData?.txns[overviewTime]?.sells}
            </span>
          </div>
          <div className="text-xxs">
            <span className="font-medium text-[#BBBCBD]">Vol: </span>
            <span className="text-xs font-medium">
              {pairData &&
                formatNumber(pairData.volume[overviewTime])}
            </span>
          </div>
          <div className="text-xxs">
            <span className="font-medium text-[#BBBCBD]">Chg: </span>
            <span className={`text-xs font-medium ${pairData && (pairData?.priceChange[overviewTime] >= 0 ? 'text-green-dark' : 'text-red-normal')}`}>
              {pairData && pairData?.priceChange[overviewTime]}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokenInfoPanel;
