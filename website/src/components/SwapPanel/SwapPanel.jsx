/* eslint-disable react/no-unescaped-entities */
import { useContext, useEffect, useRef, useState } from "react";

import {
  CircledButton,
  ExtendedButton,
  RoundedButton,
} from "../Buttons/Buttons";
import { TokenSelectButton, TokenSelectButton1 } from "../DropDown/DropDown";
import { dashboardContext } from "../../pages/Dashboard";

import { AppContext } from "../../App";
import * as ENV from "../../config/env";
import { toast } from "react-toastify";
import axios from "axios";
import { ellipsisAddress, formatNumber, isValidAddress } from "../../utils/methods";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import BigNumber from "bignumber.js";
import { getAccount, getAssociatedTokenAddress, getMint } from "@solana/spl-token";
import { Liquidity, Percent, TOKEN_PROGRAM_ID, Token, TokenAmount, jsonInfo2PoolKeys } from "@raydium-io/raydium-sdk";
import { BN } from "bn.js";
import { estimateOutputAmout, isFromPumpfun } from "../../utils/solana";


const SwapPanel = () => {
  const {
    activeWallet,
    currentProject,
    refresh,
    setRefresh,
    timers,
    setTimers,
    tokenInfo,
    setActiveWallet,
    sigData,
    signingData,
    poolInfo,
    notifyStatus
  } = useContext(AppContext);
  const { pairData, enable100Wallet } = useContext(dashboardContext);

  const { connection } = useConnection();
  const { connected, publicKey } = useWallet();

  const [fromPumpfun, setFromPumpfun] = useState(false);
  const [tokenList, setTokenList] = useState([]);
  const [fromId, setFromId] = useState(-1);
  const [toId, setToId] = useState(-1);
  const [balances, setBalances] = useState([]);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [showSetting, setShowSetting] = useState(false);
  const [inputSlippage, setInputSlippage] = useState("1");
  const [slippage, setSlippage] = useState(1);
  const [pageIndex, setPageIndex] = useState(0);
  const [timer, setTimer] = useState(null);
  const [amountOutMin, setAmountOutMin] = useState();
  const [sellTax, setSellTax] = useState(1);
  const [enableSwapButton, setEnableSwapButton] = useState(false);
  const [isSwapPending, setIsSwapPending] = useState(false);
  const [insufficient, setInsufficient] = useState(false);

  //state for wallet select
  const [toggleDropdown, setToggleDropdown] = useState(false)
  const [walletToIndex, setWalletToIndex] = useState({})


  // Limit page states
  const [selectTokenIndex, setSelectTokenIndex] = useState(-1);
  const [priceInput, setPriceInput] = useState("");
  const [currentPrice, setCurrentPrice] = useState(BigInt(0));
  const [changePercent, setChangePercent] = useState(0);
  const [changePlus, setChangePlus] = useState(true);
  const [expiryPeriod, setExpiryPeriod] = useState(7);
  const [marketButtonLabel, setMarketButtonLabel] = useState("");
  const [useMarket, setUseMarket] = useState(true);
  const [limitInput, setLimitInput] = useState("");
  const [limitOutput, setLimitOutput] = useState("");
  const [showError, setShowError] = useState(false);
  const [limitInputInsufficient, setLimitInputInsufficient] = useState(false);

  // Send page states
  const [sendTokenIndex, setSendTokenIndex] = useState(-1);
  const [sendAmount, setSendAmount] = useState("");
  const [sendWalletAddress, setSendWalletAddress] = useState("");
  const [sendable, setSendable] = useState(false);
  const swapPanelRef = useRef();

  const floatReg = /^[0-9]*.?[0-9]*$/;

  useEffect(() => {
    if (notifyStatus.tag === "TRANSFER_COMPLETED") {
      if (notifyStatus.success)
        toast.success("Transfer success");
      else
        toast.warn("Failed to transfer");

      setIsSwapPending(false);
      setEnableSwapButton(true);
      setRefresh(!refresh)
      // setNotifyStatus({ success: true, tag: "NONE" });
    }
  }, [notifyStatus, currentProject._id]);

  useEffect(() => {
    setInput("");
    setOutput("");
    if (currentProject.wallets && currentProject.wallets.length > 0) {
      let _walletToIndex = {}
      currentProject.wallets.map((_w, _idx) => { _walletToIndex[_w.address] = _idx })
      setWalletToIndex(_walletToIndex)
    } else {
      setWalletToIndex({})
    }
  }, [currentProject]);

  useEffect(() => {
    console.log("swappanel", tokenInfo)
    if (tokenInfo.address && tokenInfo.address != "") {
      const solInfo = {
        name: "Sol",
        symbol: "SOL",
        decimals: 9,
        address: "So11111111111111111111111111111111111111112",
        logo: "/assets/icon/ic_sol.png",
      };
      let tmp = [];
      tmp.push(tokenInfo);
      tmp.push(solInfo);
      console.log(tmp)
      setTokenList(tmp);
      // isFromPumpfun(connection, tokenInfo.address).then((v) => setFromPumpfun(v))
    }
  }, [tokenInfo]);

  useEffect(() => {
    if ((tokenList && tokenList.length > 0) || refresh) {
      getBalanceOfWallet();
    }
  }, [tokenList, refresh, activeWallet]);

  useEffect(() => {
    window.addEventListener("click", (e) => {
      const settingPanel = document.getElementById("setting-panel");
      const settingButton = document.getElementById("setting-button");
      if (
        settingPanel &&
        settingButton &&
        !settingPanel.contains(e.target) &&
        !settingButton.contains(e.target)
      ) {
        setShowSetting(false);
      }
    });

    const getSellTax = async () => {
      const { data } = await axios.post(
        `${ENV.SERVER_URL}/api/v1/misc/swap-tax`,
        {
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
        setSellTax(parseFloat(data.value));
      }
    };

    getSellTax();
  }, []);

  useEffect(() => {
    if (fromId == 0) setToId(1);
    if (fromId == 1) setToId(0);
  }, [fromId]);

  useEffect(() => {
    if (toId == 0) setFromId(1);
    if (toId == 1) setFromId(0);
  }, [toId]);

  useEffect(() => {
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [timer]);

  useEffect(() => {
    setOutput("");
    // calculateOutputAmount(inputAmount)
    if (timer) {
      clearTimeout(timer);
    }
    setEnableSwapButton(false);
    setAmountOutMin();

    if (
      parseFloat(input) > parseFloat(balances[fromId]?.toString()) ||
      (fromId >= 0 &&
        tokenList[fromId].symbol == "SOL" &&
        parseFloat(input) > parseFloat(balances[fromId]?.toString()) - 0.001) ||
      parseFloat(input) == 0
    ) {
      setInsufficient(true);
    } else {
      setInsufficient(false);
    }

    const newTimer = setTimeout(async () => {
      setIsSwapPending(true);
      if (fromId >= 0 && tokenList && input != "") {
        try {
          const path = [tokenList[fromId].address, tokenList[toId].address];
          const amountIn = new BigNumber(parseFloat(input).toFixed(parseInt(tokenList[fromId].decimals.toString())) + 'e' + tokenList[fromId].decimals.toString());
          const tokenAddress1 = tokenList[fromId].address;
          const tokenAddress2 = tokenList[toId].address;

          let mode, token;
          if (tokenAddress1 == "So11111111111111111111111111111111111111112") {
            mode = "buy";
            token = tokenAddress2;
          } else {
            mode = "sell";
            token = tokenAddress1;
          }

          console.log(amountIn)
          const amountOutRaw =
            await estimateOutputAmout(connection, poolInfo, mode, input, fromPumpfun);

          console.log(amountOutRaw);
          const resultOut = BigInt(amountOutRaw.toString());
          setAmountOutMin(resultOut);
          setOutput(
            parseFloat(
              new BigNumber(resultOut.toString() + 'e-' + tokenList[toId].decimals.toString()).toString()
            ).toFixed(8)
          );
        } catch (err) {
          console.log(err);
          toast.error("Estimating output amount error");
        }
      }
      setIsSwapPending(false);
      setEnableSwapButton(true);
    }, 1000);

    setTimer(newTimer);
  }, [input, fromPumpfun]);

  // useEffect(() => {
  //   setSwapPanelHeight(swapPanelRef?.current?.offsetHeight);
  // }, [pageIndex]);

  const getTokenInfo = async (tokenAddress) => {
    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        tokenABI,
        provider
      );
      const decimals = parseInt((await tokenContract.decimals()).toString());
      const logo = CHAIN_STRING[chainId.toString()]
        ? `https://dd.dexscreener.com/ds-data/tokens/${CHAIN_STRING[chainId.toString()]
        }/${tokenAddress}.png`
        : "/assets/icon/ic_question.svg";
      return {
        address: tokenAddress,
        decimals,
        logo,
      };
    } catch (e) {
      console.log(
        "This chain has no this token. Please check your token address again on this chain."
      );
    }
  };

  const setNewTokenList = async () => {
    let tmp = [];
    const nativeTokenInfo = {
      name: "Sol",
      symbol: "SOL",
      decimals: 9,
      address: "So11111111111111111111111111111111111111112",
      logo: "/assets/icon/ic_sol.png",
    };
    const firstAddress = pairData.baseToken.address;
    const secondAddress = pairData.quoteToken.address;
    let otherTokenInfo = {};
    let otherTokenAddress;
    if (
      firstAddress != tokenInfo.address &&
      firstAddress != nativeTokenInfo.address
    ) {
      otherTokenAddress = firstAddress;
    } else if (
      secondAddress != tokenInfo.address &&
      secondAddress != nativeTokenInfo.address
    ) {
      otherTokenAddress = secondAddress;
    }

    otherTokenInfo = await getTokenInfo(otherTokenAddress);

    const firstToken =
      firstAddress == tokenInfo.address
        ? tokenInfo
        : firstAddress == nativeTokenInfo.address
          ? nativeTokenInfo
          : { ...pairData.baseToken, ...otherTokenInfo };
    const secondToken =
      secondAddress == tokenInfo.address
        ? tokenInfo
        : secondAddress == nativeTokenInfo.address
          ? nativeTokenInfo
          : { ...pairData.quoteToken, ...otherTokenInfo };
    tmp.push(firstToken);
    tmp.push(secondToken);
    setTokenList(tmp);
  };

  // useEffect(() => {
  //   balances.map((item) => console.log(item));
  // }, [balances]);

  const getBalanceOfWallet = async () => {
    if (!tokenList || tokenList.length === 0) return;
    const address1 = tokenList[0]?.address;
    const address2 = tokenList[1]?.address;
    let new_balances = [];
    if (address1 == "So11111111111111111111111111111111111111112") {
      const owner = new PublicKey(activeWallet.address);
      const balance = await connection.getBalance(owner);
      new_balances.push(new BigNumber(balance.toString() + "e-9"));
    } else {
      const owner = new PublicKey(activeWallet.address);
      const mint = new PublicKey(address1);
      const mintAccountInfo = await connection.getAccountInfo(mint);
      const mintProgramId = mintAccountInfo.owner;
      const mintInfo = await getMint(connection, mint, "confirmed", mintProgramId);
      const tokenATA = await getAssociatedTokenAddress(mint, owner, false, mintProgramId);
      try {
        const tokenAccountInfo = await getAccount(connection, tokenATA, "confirmed", mintProgramId);
        new_balances.push(new BigNumber(tokenAccountInfo.amount.toString() + "e-" + mintInfo.decimals.toString()))
      } catch (err) {
        new_balances.push("0")
      }
    }

    if (address2 == "So11111111111111111111111111111111111111112") {
      const owner = new PublicKey(activeWallet.address);
      const balance = await connection.getBalance(owner);
      new_balances.push(new BigNumber(balance.toString() + "e-9"));
    } else {
      const owner = new PublicKey(activeWallet.address);
      const mint = new PublicKey(address2);
      const mintAccountInfo = await connection.getAccountInfo(mint);
      const mintProgramId = mintAccountInfo.owner;
      const mintInfo = await getMint(connection, mint, "confirmed", mintProgramId);
      const tokenATA = await getAssociatedTokenAddress(mint, owner, false, mintProgramId);
      try {
        const tokenAccountInfo = await getAccount(connection, tokenATA, "confirmed", mintProgramId);
        new_balances.push(new BigNumber(tokenAccountInfo.amount.toString() + "e-" + mintInfo.decimals.toString()))
      } catch (err) {
        new_balances.push("0");
      }
    }

    setBalances(new_balances);
  };

  const handleExchangeDirection = () => {
    let tmpFromId = fromId;
    let tmpToId = toId;
    let tmpInput = input;
    let tmpOutput = output;
    clearTimeout(timer);
    setFromId(tmpToId);
    setToId(tmpFromId);
    setInput(tmpOutput);
    setOutput(tmpInput);
  };

  const handleInputChange = (e) => {
    if (tokenList.length > 0 && fromId >= 0) {
      if (e.target.value == "") {
        setInput("");
        return;
      }
      let tmpStr = e.target.value.match(floatReg);
      if (tmpStr) {
        if (parseFloat(e.target.value) >= 0) setInput(tmpStr[0]);
      }
    }
  };

  const handleOutputChange = (e) => {
    let tmpStr = e.target.value.match(floatReg);
    if (tmpStr) setOutput(tmpStr[0]);
  };

  const handleInputMax = () => {
    if (fromId !== -1) {
      let value = parseFloat(balances[fromId].toString());
      if (tokenList[fromId].symbol == "SOL") value = value - 0.001;
      else value = value;
      value = value > 0 ? value : 0;
      setInput(value.toString());
    }
  };

  const handleSlippageChange = (e) => {
    const resultStr = e.target.value.match(floatReg);
    if (resultStr) setInputSlippage(resultStr[0]);
  };

  const handleClick = async () => {
    setIsSwapPending(true);
    setEnableSwapButton(false);
    console.log(input, balances[fromId].toString());
    if (fromId >= 0 && input != "") {
      const path = [tokenList[fromId].address, tokenList[toId].address];
      // const amountIn = new BigNumber(parseFloat(input).toFixed(parseInt(tokenList[fromId].decimals.toString())) + 'e' + tokenList[fromId].decimals.toString());
      const amountIn = parseFloat(input)
      try {
        const res = await axios.post(
          `${ENV.SERVER_URL}/api/v1/project/handle-swap`,
          {
            projectId: currentProject._id,
            address: activeWallet.address,
            amountIn: amountIn.toString(),
            slippage: slippage,
            poolInfo,
            path,
            sigData,
            signingData
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        console.log(res)
        if (res.data.success) {
          toast.success("Swap successed");
          setRefresh(!refresh);
        } else {
          toast.warn(res.data.error.reason);
        }
      } catch (error) {
        toast.error(error);
      }
    }
    setIsSwapPending(false);
    setEnableSwapButton(true);
  };

  //Functions and hooks for send page
  const handleSendAmount = (e) => {
    const tmpStr = e.target.value.match(floatReg);
    if (tmpStr) {
      if (e.target.value == "") {
        setSendAmount("");
        return;
      }
      if (parseFloat(e.target.value) >= 0) setSendAmount(tmpStr[0]);
    }
  };

  const handleInputWallet = (event) => {
    const tmpStr = event.target.value;
    setSendWalletAddress(tmpStr);
  };

  const handleSend = async () => {
    setIsSwapPending(true);
    setEnableSwapButton(false);
    if (sendable) {
      const amount = new BigNumber(parseFloat(sendAmount).toFixed(tokenList[sendTokenIndex].decimals) + 'e' + tokenList[sendTokenIndex].decimals.toString())
      console.log(amount.toString())
      const { data } = await axios.post(`${ENV.SERVER_URL}/api/v1/project/send-or-receive`,
        {
          projectId: currentProject._id,
          token: tokenList[sendTokenIndex].address,
          wallets: [{
            address: activeWallet.address,
            receipent: sendWalletAddress,
            amount: Number(parseFloat(sendAmount).toFixed(tokenList[sendTokenIndex].decimals))
          }],
          teamWallets: [],
          sigData,
          signingData,
          useJito: false
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      if (data.success) {
        // toast.success("Send successed");
        // setRefresh(!refresh);
      } else {
        toast.warning(data.error.reason);
      }
    }
  };

  useEffect(() => {
    if (
      (sendAmount != "" &&
        ((sendTokenIndex >= 0 &&
          tokenList[sendTokenIndex].symbol == "SOL" &&
          parseFloat(sendAmount) >
          parseFloat(balances[sendTokenIndex]?.toString()) - 0.001) ||
          parseFloat(sendAmount) >
          parseFloat(balances[sendTokenIndex]?.toString()))) ||
      parseFloat(sendAmount) == 0
    ) {
      setSendable(false);
    } else {
      setSendable(true);
    }
  }, [sendAmount, sendWalletAddress, balances]);

  // // Limit component
  // // Functions and hooks for limit page
  useEffect(() => {
    if (tokenList && tokenList.length > 0) {
      setFromId(0);
      setSelectTokenIndex(0);
    } else {
      setFromId(-1);
      setSelectTokenIndex(-1);
      setToId(-1);
    }
  }, [tokenList]);

  useEffect(() => {
    const getPrice = async (tokenList, selectTokenIndex, useMarket, changePercent, changePlus, poolInfo) => {
      if (
        tokenList &&
        tokenList.length > 1 &&
        selectTokenIndex >= 0 &&
        useMarket
      ) {
        try {
          const tokenAddress1 = tokenList[selectTokenIndex].address;
          const tokenAddress2 = tokenList[1 - selectTokenIndex].address;

          let mode, token;
          if (tokenAddress1 == "So11111111111111111111111111111111111111112") {
            mode = "buy";
            token = tokenAddress2;
          } else {
            mode = "sell";
            token = tokenAddress1;
          }

          const amountOutRaw =
            await estimateOutputAmout(connection, poolInfo, mode, 1, fromPumpfun);

          const resultOut = amountOutRaw.toString();
          console.log(resultOut)
          const targetPrice =
            (BigInt(resultOut) * BigInt(100 + (changePlus ? 1 : -1) * changePercent)) /
            BigInt(100);
          setCurrentPrice(resultOut);
          setPriceInput(
            new BigNumber(targetPrice.toString() + "e-" + tokenList[1 - selectTokenIndex].decimals.toString())
          );
        } catch (error) {
          // console.log(error);
        }
      }
    };
    console.log("estimating value start", selectTokenIndex);
    if (timers.unitPriceTimer) {
      clearInterval(timers.unitPriceTimer);
    }

    if (poolInfo)
      getPrice(tokenList, selectTokenIndex, useMarket, changePercent, changePlus, poolInfo);

    const newTimer = setInterval(async () => {
      if (poolInfo)
        getPrice(tokenList, selectTokenIndex, useMarket, changePercent, changePlus);
    }, 20000);

    timers.unitPriceTimer = newTimer;
    setTimers({ ...timers });
  }, [tokenList, selectTokenIndex, useMarket, changePercent, changePlus, poolInfo, fromPumpfun]);

  useEffect(() => {
    if (fromId == selectTokenIndex) {
      setChangePlus(true);
    } else {
      setChangePlus(false);
    }
    setChangePercent(0);
    setUseMarket(true);
    setInput("")
    setLimitInput("")
  }, [selectTokenIndex, fromId]);

  useEffect(() => {
    if (priceInput !== "" && tokenList && tokenList.length > 0 && !useMarket) {
      const targetPrice = BigInt(new BigNumber(parseFloat(priceInput).toFixed(parseInt(tokenList[selectTokenIndex].decimals.toString())) + 'e' + tokenList[selectTokenIndex].decimals.toString()).toString())

      const percentage =
        (BigInt(BigInt(targetPrice) - BigInt(currentPrice)) * BigInt(100)) / BigInt(currentPrice);
      setChangePercent(Math.abs(parseInt(percentage.toString())));


      console.log(percentage, changePlus)
      if (
        (percentage > BigInt(0) && !changePlus) ||
        (percentage < BigInt(0) && changePlus)
      ) {
        setShowError(true);
      } else {
        setShowError(false);
      }
      if (percentage != BigInt(0)) {
        setMarketButtonLabel(
          `${percentage > BigInt(0) ? "+" : "-"}${formatNumber(
            Math.abs(parseFloat(percentage.toString()))
          )}% | X`
        );
      } else {
        setMarketButtonLabel("Market");
        setShowError(false);
      }
    } else {
      setMarketButtonLabel("Market");
      setShowError(false);
    }
  }, [priceInput]);

  useEffect(() => {
    if (priceInput !== "" && limitInput !== "")
      if (fromId == selectTokenIndex) {
        setLimitOutput(
          (parseFloat(limitInput) * parseFloat(priceInput)).toString()
        );
      } else {
        setLimitOutput(
          (parseFloat(limitInput) / parseFloat(priceInput)).toString()
        );
      }
    if (
      (fromId >= 0 &&
        tokenList[fromId].symbol == "SOL" &&
        parseFloat(limitInput) >
        parseFloat(balances[fromId]?.formatted) - 0.001) ||
      parseFloat(limitInput) >
      parseFloat(balances[fromId]?.formatted) ||
      parseFloat(limitInput) == 0
    ) {
      setLimitInputInsufficient(true);
    } else {
      setLimitInputInsufficient(false);
    }
  }, [priceInput, limitInput, fromId]);

  const handlePriceInput = (e) => {
    setUseMarket(false);
    const tmpStr = e.target.value.match(floatReg);
    if (tmpStr) setPriceInput(tmpStr[0]);
  };

  const handleLimitInput = (e) => {
    const tmpStr = e.target.value.match(floatReg);
    if (tmpStr) {
      if (e.target.value == "") {
        setLimitInput("");
        return;
      }
      if (parseFloat(e.target.value) >= 0) setLimitInput(tmpStr[0]);
    }
  };

  const handleLimitInputMax = () => {
    if (fromId !== -1) {
      let value = parseFloat(balances[fromId].formatted);
      if (tokenList[fromId].symbol == "ETH") value = value - 0.001;
      else value = value;
      value = value > 0 ? value : 0;
      setLimitInput(value.toString());
    }
  };

  const handleChangePercent = (v) => {
    setUseMarket(true);
    setChangePercent(v);
    const targetPrice =
      (BigInt(currentPrice) * BigInt(100 + (changePlus ? 1 : -1) * v)) / BigInt(100);
    console.log(currentPrice, targetPrice)
    setPriceInput(
      new BigNumber(targetPrice.toString() + 'e-' + tokenList[1 - selectTokenIndex].decimals.toString())
    );
  };

  const handleLimitConfirm = async () => {
    if (fromId >= 0 && limitInput != "") {
      const path = [tokenList[fromId].address, tokenList[toId].address];
      const amountIn = parseFloat(limitInput).toFixed(parseInt(tokenList[fromId].decimals).toString())
      const priceValue = new BigNumber(parseFloat(priceInput).toFixed(parseInt(tokenList[1 - selectTokenIndex].decimals.toString())) + 'e' + tokenList[1 - selectTokenIndex].decimals.toString())
      console.log(amountIn, priceValue)
      const targetUnit = new BigNumber("1e" + tokenList[selectTokenIndex].decimals.toString());

      setLimitInput("");

      console.log("handling confirm", amountIn.toString());
      const { data } = await axios.post(
        `${ENV.SERVER_URL}/api/v1/project/handle-limit-swap`,
        {
          projectId: currentProject._id,
          address: activeWallet.address,
          amountIn: amountIn,
          amountOutMin: "0",
          path,
          targetIndex: 1 - selectTokenIndex,
          targetPrice: priceValue.toString(),
          targetUnit: targetUnit.toString(),
          isBigger: changePlus.toString(),
          expiry: expiryPeriod,
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
        toast.success("Limit swap ordered");
      } else {
        toast.warn(data.error.reason);
      }
    }
  };

  const handleRefresh = () => {
    setInput("");
    setSendAmount("");
    setFromId(-1);
    setToId(-1);
    setSelectTokenIndex(-1);
    setSendTokenIndex(-1);
    setRefresh(true);
  };

  return (
    <div
      className="container-gradient p-[15px] flex flex-col"
      ref={swapPanelRef}
    >
      <div className="relative flex justify-between mb-2.5">
        <div className="flex gap-[5px] items-center">
          <div className={`${pageIndex == 0 ? "bg-gradient-blue-to-purple" : "bg-white/10"} w-[50%] rounded-md p-[1px]`}>
            <ExtendedButton className={`${pageIndex == 0 ? "bg-black/50" : "bg-transparent hover:bg-gray-highlight"} !h-full w-full`} onClick={() => setPageIndex(0)}>Swap</ExtendedButton>
          </div>
          <div className={`${pageIndex == 1 ? "bg-gradient-blue-to-purple" : "bg-white/10"} w-[50%] rounded-md p-[1px]`}>
            <ExtendedButton className={`${pageIndex == 1 ? "bg-black/50" : "bg-transparent hover:bg-gray-highlight"} !h-full w-full`} onClick={() => setPageIndex(1)}>Limit</ExtendedButton>
          </div>
          <div className={`${pageIndex == 2 ? "bg-gradient-blue-to-purple" : "bg-white/10"} w-[50%] rounded-md p-[1px]`}>
            <ExtendedButton className={`${pageIndex == 2 ? "bg-black/50" : "bg-transparent hover:bg-gray-highlight"} !h-full w-full`} onClick={() => setPageIndex(2)}>Send</ExtendedButton>
          </div>
          <div className='ml-2 relative'>
            <div className="h-5 flex gap-1 items-center justify-between cursor-pointer text-nowrap" onClick={() => setToggleDropdown(!toggleDropdown)}>
              <div className="w-24 text-nowrap overflow-hidden">
                {`${walletToIndex[activeWallet.address] !== undefined ? walletToIndex[activeWallet.address] + 1 : 1} ➤ ${activeWallet && activeWallet.address ? ellipsisAddress(activeWallet.address, false) : "???"}`}
              </div>
              <img src="/assets/icon/ic_arrow_down.svg" width={8} alt="arrow-logo" />
            </div>
            <div className={`${toggleDropdown ? "block" : "hidden"} absolute z-20 mt-0 origin-top-right rounded-md bg-gray-600 w-[115px] right-0 left-0 bg-container-secondary`}>
              <div className="py-1 h-48 overflow-y-auto" role="none">
                {
                  enable100Wallet ?
                    currentProject.wallets && currentProject.wallets.length > 0 && currentProject.wallets.map((_w, idx) => {
                      return (
                        <div
                          className="text-gray-300 px-4 py-2 flex flex-row items-center justify-between cursor-pointer text-nowrap hover:bg-slate-500"
                          key={idx} role="menuitem"
                          onClick={() => { setToggleDropdown(false); setActiveWallet(_w) }}
                        >
                          {`${idx + 1}. ${ellipsisAddress(_w.address, false)}`}
                        </div>
                      )
                    }) :
                    currentProject.wallets && currentProject.wallets.length > 0 && currentProject.wallets?.slice(0, 25).map((_w, idx) => {
                      return (
                        <div
                          className="text-gray-300 px-4 py-2 flex flex-row items-center justify-between cursor-pointer text-nowrap hover:bg-slate-500"
                          key={idx} role="menuitem"
                          onClick={() => { setToggleDropdown(false); setActiveWallet(_w) }}
                        >
                          {`${idx + 1}. ${ellipsisAddress(_w.address, false)}`}
                        </div>
                      )
                    })
                }
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-[5px]">
          {pageIndex == 0 && (
            <CircledButton
              id="setting-button"
              className="!w-8 !h-8"
              onClick={() => setShowSetting((p) => !p)}
            >
              <img src="/assets/icon/ic_setting.svg" width={14} alt="setting" />
            </CircledButton>
          )}
          <CircledButton className="!w-8 !h-8" onClick={handleRefresh}>
            <img src="/assets/icon/ic_refresh.svg" width={14} alt="refresh" />
          </CircledButton>
        </div>
        <div
          id="setting-panel"
          className={`absolute ${showSetting ? "flex" : "hidden"
            } flex-col gap-2 right-0 top-10 z-[100] w-[150px] h-[75px] px-2 py-3 rounded-[8px] bg-gray-light border border-solid border-gray-highlight`}
        >
          <div className="flex gap-2 items-center">
            <div>Max.slippage:</div>
            <div className="flex gap-1 items-center">
              <input
                type="text"
                value={inputSlippage}
                onChange={handleSlippageChange}
                className="shrink grow-0 w-full px-2 rounded-lg border border-solid border-gray-border text-right text-black bg-white"
              />
              %
            </div>
          </div>
          <div className="flex justify-end">
            <button
              className="w-[40px] h-[20px] rounded-[8px] bg-blue-primary"
              onClick={() => {
                setSlippage(parseFloat(inputSlippage));
                setShowSetting(false);
                setInputSlippage(parseFloat(inputSlippage).toString());
              }}
            >
              Set
            </button>
          </div>
        </div>
      </div>
      {pageIndex == 0 && (
        <div>
          <div className="relative flex flex-col gap-[5px] mb-2.5">
            <div className="container-gradient py-2 pl-2 pr-3 flex flex-col gap-3">
              <div className="flex justify-between">
                <div className="font-medium text-xxs leading-3">
                  Balance:{" "}
                  {balances.length > 0
                    ? balances[fromId]?.toString()
                    : 0}
                </div>
                <div
                  className="font-medium text-xxs leading-3 text-yellow-normal cursor-pointer"
                  onClick={handleInputMax}
                >
                  Max
                </div>
                <div className="font-medium text-xxs leading-3 text-[#4B65F1]">From</div>
              </div>
              <div className="flex justify-between items-center gap-2">
                <TokenSelectButton
                  tokenList={tokenList}
                  selectedIndex={fromId}
                  setSelectedIndex={setFromId}
                />
                <input
                  type="text"
                  className="w-full outline-none border-none font-['Inter'] text-sm bg-transparent !text-right"
                  value={input}
                  onChange={handleInputChange}
                  placeholder="0.0"
                />
              </div>
            </div>
            <div
              className="absolute w-9 h-9 left-[calc(50%-18px)] top-[calc(50%-18px)] flex items-center justify-center z-10 rounded-full bg-purple-gradient border-4 border-solid border-gray-dark outline outline-1 outline-[#ffffff22] outline-offset-0 cursor-pointer"
              onClick={handleExchangeDirection}
            >
              <img src="/assets/icon/ic_vector.png" width={10} alt="swap" />
            </div>
            <div className="container-gradient py-2 pl-2 pr-3 flex flex-col gap-3">
              <div className="flex justify-between">
                <div className="font-medium text-xxs leading-3">
                  Balance:{" "}
                  {balances.length > 0
                    ? balances[toId]?.toString()
                    : 0}
                </div>
                <div className="font-medium text-xxs leading-3">To</div>
              </div>
              <div className="flex justify-between items-end">
                <TokenSelectButton
                  tokenList={tokenList}
                  selectedIndex={toId}
                  setSelectedIndex={setToId}
                />
                <input
                  type="text"
                  className="w-full outline-none border-none font-['Inter'] text-sm bg-transparent !text-right"
                  value={output}
                  onChange={handleOutputChange}
                  placeholder="0.0"
                />
                {tokenList &&
                  tokenList.length > 0 &&
                  toId >= 0 &&
                  output !== "" &&
                  tokenList[toId].address ===
                  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" && (
                    <div className="text-nowrap text-gray-normal text-[14px]">
                      {" "}
                      -{((parseFloat(output) * sellTax) / 100).toFixed(3)}(
                      {sellTax}
                      %)
                    </div>
                  )}
              </div>
            </div>
          </div>
          <div className="flex flex-col mb-3">
            <div className="flex justify-between">
              <div className="font-['Space Grotesk'] font-medium text-xxs lead-[15px] text-white">
                Price
              </div>
              <div className="font-['Space Grotesk'] font-medium text-xxs lead-[15px] text-white">
                {formatNumber(
                  1 / parseFloat(pairData?.priceNative)
                )}{" "}
                {pairData?.baseToken?.symbol} per{" "}
                {pairData?.quoteToken?.symbol}
              </div>
            </div>
            <div className="flex justify-between">
              <div className="font-['Space Grotesk'] font-medium text-xxs lead-[15px] text-white">
                Slippage Tolerance
              </div>
              <div className="font-['Space Grotesk'] font-medium text-xxs lead-[15px] text-white">
                {slippage} %
              </div>
            </div>
            {/* <div className="flex justify-between">
              <div className="font-['Space Grotesk'] font-medium text-xxs lead-[15px] text-white">
                Sell Tax ({sellTax}%)
              </div>
              <div className="font-['Space Grotesk'] font-medium text-xxs lead-[15px] text-white">
                {output == ""
                  ? ""
                  : ((parseFloat(output) * sellTax) / 100).toFixed(8)}
              </div>
            </div> */}
          </div>
          <button
            disabled={!enableSwapButton || insufficient || input == ""}
            className="w-full h-9 flex gap-4 justify-center items-center space-grotesk-400 rounded-[10px] bg-gradient-blue-to-purple disabled:!bg-none disabled:!bg-gray-border"
            onClick={handleClick}
          >
            {insufficient ? "Insufficient balance" : "SWAP"}
            {isSwapPending && (
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
          </button>
        </div>
      )}
      {pageIndex == 1 && (
        <div>
          <div className="container-gradient py-2 pl-2 pr-3 flex flex-col gap-1 mb-[5px]">
            <div className="flex items-center justify-between gap-1 text-left text-gray-normal mb-1">
              <div className="flex items-center gap-1">
                When 1
                <TokenSelectButton1
                  tokenList={tokenList}
                  selectedIndex={selectTokenIndex}
                  setSelectedIndex={setSelectTokenIndex}
                />{" "}
                is worth
              </div>
              <div>
                <svg
                  width="16px"
                  height="16px"
                  className="w-3.5 h-3.5 active:scale-95 hover:scale-110 transition duration-100 ease-in-out transform cursor-pointer"
                  onClick={() =>
                    setSelectTokenIndex((p) => (p >= 0 ? 1 - p : -1))
                  }
                  viewBox="0 3 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M19.4834 5.71191C19.0879 5.29883 18.4727 5.30762 18.0859 5.71191L13.6562 10.2471C13.4805 10.4229 13.3662 10.6953 13.3662 10.9326C13.3662 11.4863 13.7529 11.8643 14.2979 11.8643C14.5615 11.8643 14.7725 11.7764 14.9482 11.5918L16.7588 9.71094L17.9189 8.375L17.8486 10.2383L17.8486 21.6465C17.8486 22.1914 18.2441 22.5869 18.7891 22.5869C19.334 22.5869 19.7207 22.1914 19.7207 21.6465L19.7207 10.2383L19.6592 8.375L20.8105 9.71094L22.6211 11.5918C22.7969 11.7764 23.0166 11.8643 23.2803 11.8643C23.8164 11.8643 24.2031 11.4863 24.2031 10.9326C24.2031 10.6953 24.0889 10.4229 23.9131 10.2471L19.4834 5.71191ZM7.84668 22.2793C8.24218 22.6924 8.85742 22.6836 9.24414 22.2793L13.6738 17.7529C13.8496 17.5684 13.9639 17.2959 13.9639 17.0586C13.9639 16.5137 13.5771 16.1357 13.0322 16.1357C12.7773 16.1357 12.5576 16.2236 12.3818 16.3994L10.5713 18.2803L9.41992 19.6162L9.48144 17.7529L9.48144 6.34473C9.48144 5.80859 9.08594 5.4043 8.54101 5.4043C8.00488 5.4043 7.60937 5.80859 7.60937 6.34473L7.60937 17.7529L7.6709 19.6162L6.51953 18.2803L4.70898 16.3994C4.5332 16.2236 4.31347 16.1357 4.05859 16.1357C3.51367 16.1357 3.12695 16.5137 3.12695 17.0586C3.12695 17.2959 3.24121 17.5684 3.41699 17.7529L7.84668 22.2793Z"
                    fill="white"
                  ></path>
                </svg>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <input
                type="text"
                className="bg-transparent grow outline-none border-none text-left font-['Inter'] text-sm"
                placeholder="0.0"
                value={priceInput}
                onKeyDown={() => setUseMarket(false)}
                onChange={handlePriceInput}
              />
              <TokenSelectButton1
                tokenList={tokenList}
                selectedIndex={
                  selectTokenIndex == -1
                    ? selectTokenIndex
                    : 1 - selectTokenIndex
                }
                setSelectedIndex={(index) => setSelectTokenIndex(1 - index)}
              />
            </div>
            <div className="flex items-center gap-3">
              <div
                className={`${changePercent !== 1 &&
                  changePercent !== 5 &&
                  changePercent !== 10
                  ? "bg-purple-gradient"
                  : "bg-gray-border"
                  } rounded-full p-[1px]`}
              >
                <RoundedButton
                  className={`!h-4 !px-2 !py-2 ${changePercent !== 1 &&
                    changePercent !== 5 &&
                    changePercent !== 10
                    ? "!bg-black"
                    : "!bg-gray-highlight"
                    } !border-none`}
                  onClick={() => handleChangePercent(0)}
                >
                  {marketButtonLabel}
                </RoundedButton>
              </div>
              <div
                className={`${changePercent === 1 ? "bg-purple-gradient" : "bg-gray-border"
                  } rounded-full p-[1px]`}
              >
                <RoundedButton
                  className={`!h-4 !px-2 !py-2 ${changePercent === 1 ? "!bg-black" : "!bg-gray-highlight"
                    } !border-none`}
                  onClick={() => handleChangePercent(1)}
                >
                  {changePlus ? "+" : "-"}1%
                </RoundedButton>
              </div>
              <div
                className={`${changePercent === 5 ? "bg-purple-gradient" : "bg-gray-border"
                  } rounded-full p-[1px]`}
              >
                <RoundedButton
                  className={`!h-4 !px-2 !py-2 ${changePercent === 5 ? "!bg-black" : "!bg-gray-highlight"
                    } !border-none`}
                  onClick={() => handleChangePercent(5)}
                >
                  {changePlus ? "+" : "-"}5%
                </RoundedButton>
              </div>
              <div
                className={`${changePercent === 10 ? "bg-purple-gradient" : "bg-gray-border"
                  } rounded-full p-[1px]`}
              >
                <RoundedButton
                  className={`!h-4 !px-2 !py-2 ${changePercent === 10 ? "!bg-black" : "!bg-gray-highlight"
                    } !border-none`}
                  onClick={() => handleChangePercent(10)}
                >
                  {changePlus ? "+" : "-"}10%
                </RoundedButton>
              </div>
            </div>
          </div>
          <div className="relative flex flex-col gap-[5px] mb-2.5">
            <div className="container-gradient py-2 pl-2 pr-3 flex flex-col gap-3">
              <div className="flex justify-between">
                <div className="font-medium text-xxs leading-3">
                  Balance:{" "}
                  {balances.length > 0
                    ? balances[fromId]?.toString()
                    : 0}
                </div>
                <div
                  className="font-medium text-xxs leading-3 text-yellow-normal cursor-pointer"
                  onClick={handleLimitInputMax}
                >
                  Max
                </div>
                <div className="font-medium text-xxs leading-3 text-[#4B65F1]">From</div>
              </div>
              <div className="flex justify-between items-center gap-2">
                <TokenSelectButton
                  tokenList={tokenList}
                  selectedIndex={fromId}
                  setSelectedIndex={setFromId}
                />
                <input
                  type="text"
                  className="w-full outline-none border-none font-['Inter'] text-sm bg-transparent !text-right"
                  value={limitInput}
                  onChange={handleLimitInput}
                  placeholder="0.0"
                />
              </div>
            </div>
            <div
              className="absolute w-6 h-6 left-[calc(50%-12px)] top-[calc(50%-12px)] flex items-center justify-center z-10 rounded-full bg-purple-gradient border-2 border-solid border-gray-dark outline outline-1 outline-[#ffffff22] cursor-pointer"
              onClick={handleExchangeDirection}
            >
              <img src="/assets/icon/ic_vector.png" width={10} alt="swap" />
            </div>
            <div className="container-gradient py-2 pl-2 pr-3 flex flex-col gap-3">
              <div className="flex justify-between">
                <div className="font-medium text-xxs leading-3">
                  Balance:{" "}
                  {balances.length > 0
                    ? balances[toId]?.toString()
                    : 0}
                </div>
                <div className="font-medium text-xxs leading-3">To</div>
              </div>
              <div className="flex justify-between items-end">
                <TokenSelectButton
                  tokenList={tokenList}
                  selectedIndex={toId}
                  setSelectedIndex={setToId}
                />
                <input
                  type="text"
                  className="w-full outline-none border-none font-['Inter'] text-sm bg-transparent !text-right"
                  value={limitOutput}
                  // onChange={handleOutputChange}
                  placeholder="0.0"
                  readOnly
                />
                {tokenList &&
                  tokenList.length > 0 &&
                  toId >= 0 &&
                  output !== "" &&
                  tokenList[toId].address ===
                  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" && (
                    <div className="text-nowrap text-gray-normal text-[14px]">
                      {" "}
                      -{((parseFloat(output) * sellTax) / 100).toFixed(3)}(
                      {sellTax}
                      %)
                    </div>
                  )}
              </div>
            </div>
          </div>
          <div className="flex flex-col mb-3">
            <div className="flex justify-between">
              <div className="text-xxs lead-[15px] text-white">Expiry</div>
              <div className="text-xxs lead-[15px] text-white flex gap-2">
                <div
                  className={`${expiryPeriod === 1 ? "bg-purple-gradient" : "bg-gray-border"
                    } rounded-full p-[1px]`}
                >
                  <RoundedButton
                    className={`!h-4 !px-2 !py-2 ${expiryPeriod === 1 ? "!bg-black" : "!bg-gray-highlight"
                      } !border-none`}
                    onClick={() => setExpiryPeriod(1)}
                  >
                    1day
                  </RoundedButton>
                </div>
                <div
                  className={`${expiryPeriod === 7 ? "bg-purple-gradient" : "bg-gray-border"
                    } rounded-full p-[1px]`}
                >
                  <RoundedButton
                    className={`!h-4 !px-2 !py-2 ${expiryPeriod === 7 ? "!bg-black" : "!bg-gray-highlight"
                      } !border-none`}
                    onClick={() => setExpiryPeriod(7)}
                  >
                    1week
                  </RoundedButton>
                </div>
                <div
                  className={`${expiryPeriod === 30
                    ? "bg-purple-gradient"
                    : "bg-gray-border"
                    } rounded-full p-[1px]`}
                >
                  <RoundedButton
                    className={`!h-4 !px-2 !py-2 ${expiryPeriod === 30 ? "!bg-black" : "!bg-gray-highlight"
                      } !border-none`}
                    onClick={() => setExpiryPeriod(30)}
                  >
                    1month
                  </RoundedButton>
                </div>
                <div
                  className={`${expiryPeriod === 365
                    ? "bg-purple-gradient"
                    : "bg-gray-border"
                    } rounded-full p-[1px]`}
                >
                  <RoundedButton
                    className={`!h-4 !px-2 !py-2 ${expiryPeriod === 365 ? "!bg-black" : "!bg-gray-highlight"
                      } !border-none`}
                    onClick={() => setExpiryPeriod(365)}
                  >
                    1year
                  </RoundedButton>
                </div>
              </div>
            </div>
          </div>
          <button
            disabled={
              !enableSwapButton ||
              limitInputInsufficient ||
              showError ||
              limitInput == "" ||
              fromId < 0 ||
              balances.length <= 0 ||
              !poolInfo ||
              (poolInfo && Object.keys(poolInfo) == 0)
            }
            className="w-full h-9 flex gap-4 justify-center items-center rounded-[10px] bg-gradient-blue-to-purple disabled:!bg-none disabled:!bg-gray-border"
            onClick={handleLimitConfirm}
          >
            {limitInputInsufficient ? "Insufficient balance" : "Confirm"}
            {isSwapPending && (
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
          </button>
          {showError && (
            <div className="container !bg-transparent mt-2">
              Your limit price is {changePercent}%{" "}
              {changePlus ? "lower" : "higher"} than market. Adjust your limit
              price to proceed.
            </div>
          )}
        </div>
      )}
      {pageIndex == 2 && (
        <div>
          <div className="container-gradient p-2.5 flex flex-col">
            <div className="text-left text-gray-normal mb-1">
              You're sending
            </div>
            <input
              type="text"
              className="h-12 bg-transparent outline-none rounded-md border border-solid border-gray-border text-center text-2xl"
              placeholder="0"
              value={sendAmount}
              onChange={handleSendAmount}
            />
            <div className="text-left text-gray-normal mb-1">
              balance: {balances && balances[sendTokenIndex]?.toString()}
            </div>
            <TokenSelectButton
              tokenList={tokenList}
              selectedIndex={sendTokenIndex}
              setSelectedIndex={setSendTokenIndex}
              className="!w-full !h-8 mb-2.5"
            />
            <div className="text-left text-gray-normal mb-1">To</div>
            <input
              type="text"
              className="h-8 p-2 mb-2.5 bg-transparent outline-none border-solid border border-gray-border rounded-md text-md"
              placeholder="Wallet address or ENS name"
              value={sendWalletAddress}
              onChange={handleInputWallet}
            />
            <button
              disabled={
                !enableSwapButton ||
                sendAmount == "" ||
                isSwapPending ||
                !sendable ||
                balances.length <= 0 ||
                sendTokenIndex < 0 ||
                sendWalletAddress == ""
              }
              className="flex justify-center items-center gap-4 px-3 py-1.5 h-9 rounded-[10px] text-white cursor-pointer bg-gradient-blue-to-purple disabled:!bg-none disabled:!bg-[#FFFFFF0F]  text-xxs"
              onClick={handleSend}
            >
              {!sendable ? "Insufficient balance" : "Send"}
              {isSwapPending && (
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
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SwapPanel;
