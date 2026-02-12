/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import "../../index.css";
import { dashboardContext } from "../../pages/Dashboard";
import axios from "axios";
import { useContext, useEffect, useState, useRef, useCallback } from "react";
import {
  ellipsisAddress,
  formatNumber,
} from "../../utils/methods";
import { getSwapInfoFromTrx, solanaConnection } from "../../utils/solana";
import { AppContext } from "../../App";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { RxUpdate } from "react-icons/rx";

function timeAgo(timestamp) {
  const currentTime = Math.floor(Date.now() / 1000);
  const difference = currentTime - timestamp;

  if (difference < 0) {
    return `in ${0 - difference}s`;
  } else if (difference < 60) {
    return `${difference}s ago`;
  } else if (difference < 3600) {
    return `${Math.floor(difference / 60)}m ago`;
  } else if (difference < 86400) {
    return `${Math.floor(difference / 3600)}h ago`;
  } else {
    return `${Math.floor(difference / 86400)}d ago`;
  }
}

const OrderHistory = ({ className }) => {
  const { connection } = useConnection()

  const { activeTokenAddress, tokenInfo, pairInfo } = useContext(AppContext);

  const [swaps, setSwaps] = useState([]);
  const [skip, setSkip] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sortType, setSortType] = useState("all");
  const [showSortPanel, setShowSortPanel] = useState(false)
  const [decimals, setDecimals] = useState([]);
  const [hasNext, setHasNext] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  // const [history, setHistory] = useState([]);
  // const [quoteTokenPrice, setQuoteTokenPrice] = useState();
  const observer = useRef();
  let history;

  useEffect(() => {
    console.log("OrderHistory==> ", tokenInfo)
  }, [tokenInfo])

  useEffect(() => {
    history = [];
    setSwaps([]);
    let intervalId;

    console.log("!!!!!!!!!!!!!!!Pair Info!!!!!!!!!!!", pairInfo)

    let raydiumSubscriptionId
    if (pairInfo && tokenInfo.decimals) {
      console.log("pair address changed", pairInfo.pairAddress)
      const pairPubKey = new PublicKey(pairInfo.pairAddress);
      raydiumSubscriptionId = solanaConnection.onLogs(
        pairPubKey,
        async ({ logs, err, signature }) => {
          try {
            if (err) {
              console.error(`connection contains error, ${err}`);
              return;
            }
            console.log(signature)
            const ret = await getSwapInfoFromTrx(solanaConnection, activeTokenAddress, signature);
            console.log(ret, tokenInfo)
            if (ret.isSwap) {
              let new_log = {};
              new_log.address = pairInfo.pairAddress;
              new_log.blockUnixTime = Number(ret.blockTime);
              new_log.owner = ret.owner;
              new_log.source = "raydium";
              new_log.txHash = ret.txHash;
              let from = {}
              from.address = ret.sendToken;
              from.amount = ret.sendAmount;
              from.changeAmount = 0 - ret.sendAmount;
              from.decimals = ret.sendToken == "So11111111111111111111111111111111111111112" ? 9 : parseInt(tokenInfo.decimals.toString());
              from.nearestPrice = ret.sendToken == "So11111111111111111111111111111111111111112" ? null : parseFloat(ret.priceUsd.toString());
              from.price = null;
              from.symbol = ret.sendToken == "So11111111111111111111111111111111111111112" ? "SOL" : tokenInfo.symbol;
              from.type = "transfer";
              from.typeSwap = "from";
              from.uiAmount = ret.sendAmount / (10 ** from.decimals);
              from.uiChangedAmount = 0 - from.uiAmount;
              new_log.from = from;
              let to = {}
              to.address = ret.receiveToken;
              to.amount = ret.receiveAmount;
              to.changeAmount = 0 - ret.receiveAmount;
              to.decimals = ret.receiveToken == "So11111111111111111111111111111111111111112" ? 9 : parseInt(tokenInfo.decimals.toString());
              to.nearestPrice = ret.receiveToken == "So11111111111111111111111111111111111111112" ? null : parseFloat(ret.priceUsd.toString());
              to.price = null;
              to.symbol = ret.receiveToken == "So11111111111111111111111111111111111111112" ? "SOL" : tokenInfo.symbol;
              to.type = "transfer";
              to.typeSwap = "to";
              to.uiAmount = ret.receiveAmount / (10 ** to.decimals);
              to.uiChangedAmount = 0 - to.uiAmount;
              new_log.to = to;
              setSwaps(p => ([new_log, ...p].slice(0, 100)))
            }
          } catch (error) {
            console.error(
              `error occured in new solana token log callback function, ${error}`
            );
          }
        },
        'confirmed'
      );

      getTransactionUsingBirdeye(pairInfo.pairAddress, 0, 20);
    }

    return () => {
      solanaConnection.removeOnLogsListener(raydiumSubscriptionId);
    };
  }, [pairInfo, tokenInfo]);

  useEffect(() => {
    if (swaps.length <= 100 && pairInfo)
      getTransactionUsingBirdeye(pairInfo.pairAddress, swaps.length, 20);
    // getTransactionUsingBirdeye();
  }, [page, pairInfo]);

  const lastElementRef = useCallback(
    (node) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          setPage((prevPage) => prevPage + 1);
        }
      });
      if (node) observer.current.observe(node);
    },
    [loading]
  );

  const getTransactionUsingBirdeye = async (pairAddress, offset, limit) => {
    const url = `https://public-api.birdeye.so/defi/txs/pair?address=${pairAddress}&offset=${offset
      }&limit=${limit}&tx_type=${sortType}&sort_type=desc`;
    const response = await axios.get(url, {
      headers: {
        "x-chain": "solana",
        "X-API-KEY": import.meta.env.VITE_BIRDEYE_APIKEY,
      },
    });
    if (response.data.success) {
      console.log(response.data.data.items)
      setSwaps((prev) => [...prev, ...response.data.data.items]);
      setHasNext(response.data.data.hasNext);
    }
  };

  const handleOpenTx = (_txHash) => {
    const website_url = `https://solscan.io/tx/${_txHash}`
    window.open(website_url, "_blank", "noopener,noreferrer");
  }

  const handleRefreshHistory = async () => {
    setSwaps([]);
    if (pairInfo)
      getTransactionUsingBirdeye(pairInfo.pairAddress, 0, 50)
  }

  return (
    <div className={`w-full h-full flex flex-col gap-1`}>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2 items-center font-medium text-sm text-left">
          Order History
          <div className='cursor-pointer hover:scale-110 active:scale-90 text-xs' onClick={handleRefreshHistory}><RxUpdate /></div>
        </div>
      </div>
      <div className="overflow-y-auto overflow-x-auto">
        <table className="w-full min-h-[300px] text-left">
          <thead className="sticky top-0 inter-500 bg-[#2B2E33]">
            <tr>
              <th scope="col" className="px-2 py-1.5 rounded-s-lg">
                Date
              </th>
              <th scope="col" className="px-2 py-1.5">
                <div className='flex gap-px items-center'>
                  Tx Type
                  {/* <div className='relative'>
                    <div className='p-1 cursor-pointer rounded-md hover:bg-gray-700' onClick={() => setShowSortPanel(p => !p)}>
                      <img className='w-3 h-3' src="/assets/icon/ic_filter.svg" alt='filter' />
                    </div>
                    {showSortPanel && <div className='absolute w-[70px] right-0 bg-gray-800 rounded-md z-20 flex flex-col overflow-hidden'>
                      <div className={`px-2 py-1 hover:bg-gray-600 cursor-pointer ${sortType == 'swap' ? 'bg-blue-900' : ''}`} onClick={() => handleSetSort('swap')}>swap</div>
                      <div className={`px-2 py-1 hover:bg-gray-600 cursor-pointer ${sortType == 'add' ? 'bg-blue-900' : ''}`} onClick={() => handleSetSort('add')}>add</div>
                      <div className={`px-2 py-1 hover:bg-gray-600 cursor-pointer ${sortType == 'remove' ? 'bg-blue-900' : ''}`} onClick={() => handleSetSort('remove')}>remove</div>
                      <div className={`px-2 py-1 hover:bg-gray-600 cursor-pointer ${sortType == 'all' ? 'bg-blue-900' : ''}`} onClick={() => handleSetSort('all')}>all</div>
                    </div>}
                  </div> */}
                </div>
              </th>
              <th scope="col" className="px-2 py-1.5">
                Total USD
              </th>
              <th scope="col" className="px-2 py-1.5">
                Token Amount
              </th>
              <th scope="col" className="px-2 py-1.5">
                SOL Amount
              </th>
              <th scope="col" className="px-2 py-1.5">
                Price
              </th>
              <th scope="col" className="px-2 py-1.5">
                Maker
              </th>
              {/* <th scope="col" className="pl-2 py-1.5">
                Source
              </th> */}
              <th scope="col" className="rounded-e-lg">
              </th>
            </tr>
          </thead>
          <tbody>
            {swaps && swaps.length > 0 &&
              swaps.map((_log, _i) => {
                const type = _log.from ? (_log.from.symbol == 'SOL' ? "buy" : 'sell') : "other";
                const symbol1 = _log.tokens ? _log.tokens[0].symbol : _log.from.symbol;
                const symbol2 = _log.tokens ? _log.tokens[1].symbol : _log.to.symbol;
                return (
                  <tr
                    key={_log.txHash + _i.toString()}
                    className="border-b last:border-none border-white/10"
                    ref={_i === swaps.length - 5 ? lastElementRef : null}
                  >
                    <th
                      scope="row"
                      className={`px-2 py-1 text-nowrap ${type === "sell" ? "text-[#F94D5C]" : type === "buy" ? "text-[#00C38C]" : "text-purple-600"}`}
                    >
                      {timeAgo(_log.blockUnixTime)}
                    </th>
                    <td className={`px-2 py-1 ${type === "sell" ? "text-[#F94D5C]" : type === "buy" ? "text-[#00C38C]" : "text-purple-600"}`}>
                      {type}
                    </td>
                    <td className={`px-2 py-1 ${type === "sell" ? "text-[#F94D5C]" : type === "buy" ? "text-[#00C38C]" : "text-purple-600"}`}>
                      {(type === "sell" || type === "buy") ?
                        ("$" + formatNumber(_log.from.nearestPrice ? _log.from.nearestPrice * _log.from.uiAmount : _log.to.nearestPrice * _log.to.uiAmount, true)) :
                        ("-")}
                    </td>
                    <td className="px-2 py-1">
                      <div className='flex gap-1'>
                        <img className='rounded-full w-4 h-4' src={tokenInfo.logo ? tokenInfo.logo : ""} alt='' />
                        <div className={`${type === "sell" ? "text-[#F94D5C]" : type === "buy" ? "text-[#00C38C]" : "text-purple-600"}`}>
                          {type == "other" ?
                            (_log.tokens[0].address != "So11111111111111111111111111111111111111112" ? formatNumber(_log.tokens[0].amount / (10 ** _log.tokens[0].decimals)) : formatNumber(_log.tokens[1].amount / (10 ** _log.tokens[1].decimals))) :
                            (type == "sell" ? formatNumber(_log.from.uiAmount) : formatNumber(_log.to.uiAmount))}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-1">
                      <div className='flex gap-1'>
                        <img className='rounded-full w-4 h-4' src={"https://img.fotofolio.xyz/?url=https%3A%2F%2Fraw.githubusercontent.com%2Fsolana-labs%2Ftoken-list%2Fmain%2Fassets%2Fmainnet%2FSo11111111111111111111111111111111111111112%2Flogo.png"} alt='' />
                        <div className={`${type === "sell" ? "text-[#F94D5C]" : type === "buy" ? "text-[#00C38C]" : "text-purple-600"}`}>
                          {type == "other" ?
                            (_log.tokens[1].address == "So11111111111111111111111111111111111111112" ? formatNumber(_log.tokens[1].amount / (10 ** _log.tokens[1].decimals)) : formatNumber(_log.tokens[0].amount / (10 ** _log.tokens[0].decimals))) :
                            (type == "buy" ? _log.from.uiAmount.toFixed(6) : _log.to.uiAmount.toFixed(6))}
                        </div>
                        <div className='font-medium text-blue-800'>
                          SOL
                        </div>
                      </div>
                    </td>
                    <td className={`px-2 py-1 ${type === "sell" ? "text-[#F94D5C]" : type === "buy" ? "text-[#00C38C]" : "text-purple-600"}`}>
                      {(type === "sell" || type === "buy") ?
                        ("$" + (type == 'sell' ?
                          (_log.from.nearestPrice ?
                            _log.from.nearestPrice.toFixed(7) : (_log.to.nearestPrice * _log.to.uiAmount / _log.from.uiAmount).toFixed(7))
                          : type == "buy" &&
                          (_log.to.nearestPrice ?
                            _log.to.nearestPrice.toFixed(7) : (_log.from.nearestPrice * _log.from.uiAmount / _log.to.uiAmount).toFixed(7))))
                        : "-"}
                    </td>
                    <td className="px-2 py-1">
                      <div className='flex gap-2 items-center'>
                        <a href={`https://solscan.io/account/${_log.owner}`} target="_blank" rel="noopener noreferrer">
                          <div className='w-16 font-medium text-blue-800 overflow-hidden overflow-ellipsis text-nowrap'>{_log.owner}</div>
                        </a>
                      </div>
                    </td>
                    {/* <td className="pl-2 py-1">
                      <img className='w-5 h-5 rounded-full border border-solid border-[#2D2D2D]' src={`https://cdn.jsdelivr.net/gh/birdeye-so/birdeye-ads/pool_providers/${_log.source}.svg`} alt={_log.source} />
                    </td> */}
                    <td className="pr-2 py-1">
                      <img alt="" src="/assets/icon/ic_etherscan.svg" className='cursor-pointer w-4 h-4' width="20px" height="20px" onClick={() => handleOpenTx(_log.txHash)} />
                    </td>
                  </tr>
                );
              })}
            <tr
              className="border-b grow last:border-none border-white/10"
            >
              <th
                scope="row"
                className="h-full"
              >
                {""}
              </th>

            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OrderHistory;
