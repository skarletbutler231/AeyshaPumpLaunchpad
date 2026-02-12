import axios from "axios";
import { useContext, useEffect, useRef, useState } from "react";
import { AppContext } from "../../App";
import { ellipsisAddress, formatNumber } from "../../utils/methods";
import { FaBackspace, FaCheck } from "react-icons/fa";
import { NATIVE_MINT } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

const images = {
  orca: "https://dd.dexscreener.com/ds-data/dexes/orca.png",
  raydium: "https://dd.dexscreener.com/ds-data/dexes/raydium.png",
  solana: "https://dd.dexscreener.com/ds-data/chains/solana.png",
}

const TokenSearchPanel = (props) => {
  const { setShowCandidate, handleSetToken, tokenAddress, setTokenAddress } =
    props;
  const { setPairInfo, setActiveTokenAddress } = useContext(AppContext);
  const inputRef = useRef();
  const [candidates, setCandidates] = useState([]);
  const [timer, setTimer] = useState();
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setShowCandidate(false);
      }
    });
  }, []);

  useEffect(() => {
    if (timer) {
      clearTimeout(timer);
    }

    if (tokenAddress == "") {
      setIsSearching(false);
      setCandidates([]);
      return;
    }

    const newTimer = setTimeout(async () => {
      setIsSearching(true);
      if (tokenAddress == "") {
        setCandidates([]);
        return;
      }

      let searchByCA = true;
      let api_url = "https://api.dexscreener.com/token-pairs/v1/solana/"
      try {
        const mint = new PublicKey(tokenAddress);
      } catch (err) {
        api_url = "https://api.dexscreener.com/latest/dex/search/?q="
        searchByCA = false
      }

      const { data } = await axios.get(
        `${api_url}${encodeURI(tokenAddress)}`,
        {
          headers: { "Content-Type": "application/json" },
        }
      );
      if (searchByCA ? data : data?.pairs) {
        const pairs = (searchByCA ? data : data?.pairs).filter(
          (element) =>
            element.chainId === "solana" && element.quoteToken?.address === NATIVE_MINT.toBase58() && (element.dexId === "raydium" || element.dexId === "pumpfun" || element.dexId === "pumpswap" || element.dexId === "launchlab")
        );
        console.log("pairs", pairs)
        setCandidates(pairs);
      } else {
        setCandidates([]);
      }
      setIsSearching(false);
    }, 1000);

    setTimer(newTimer);
  }, [tokenAddress]);

  const handleTokenAddressChange = (event) => {
    setTokenAddress(event.target.value);
  };

  const handleClickAddrSetButton = () => {
    setActiveTokenAddress(tokenAddress);
    setPairInfo({
      chainId: "solana",
      dexId: null,
      pairAddress: null,
      labels: null,
      baseToken: tokenAddress,
      quoteToken: NATIVE_MINT.toBase58()
    });
    setShowCandidate(false);
  }

  return (
    <div className="fixed z-50 left-0 top-0 w-full h-full flex justify-center bg-black/70">
      <div
        className="fixed z-40 left-0 top-0 w-full h-full"
        onClick={() => setShowCandidate(false)}
      ></div>
      <div className="z-50 w-[800px] max-h-[80vh] h-fit mt-24 flex flex-col bg-gray-light rounded-md bg-black border border-solid border-gray-border">
        <div className="h-12 bg-gray-highlight p-3 flex gap-2 justify-between">
          <div className="flex gap-2 grow">
            <img src="/assets/icon/ic_search.svg" className="w-6 h-6" />
            <input
              className="outline-none bg-transparent text-sm grow"
              placeholder="Search"
              value={tokenAddress}
              onChange={handleTokenAddressChange}
              ref={inputRef}
            />
          </div>
          <div className="flex gap-4">
            <button onClick={() => setTokenAddress("")}>
              <FaBackspace />
            </button>
            <button onClick={handleClickAddrSetButton}>
              <FaCheck />
            </button>
          </div>
        </div>
        <div className="min-h-24 overflow-auto">
          {candidates.length == 0 && !isSearching && (
            <div className="p-5">
              <div className="text-xl mb-2">¯\_(ツ)_/¯</div>
              <div className="text-sm">No results found</div>
            </div>
          )}
          {isSearching && tokenAddress != "" && (
            <div className="p-5">
              <div role="status" className="mb-2">
                <svg
                  aria-hidden="true"
                  className="inline w-10 h-10 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600"
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
              </div>
              <div className="text-sm">Searching...</div>
            </div>
          )}
          {candidates.length > 0 && !isSearching && (
            <div className="px-3 pt-5 pb-3 flex flex-col gap-2">
              {candidates.map((candidate) => {
                return (
                  <div
                    key={candidate.pairAddress}
                    className="p-3 flex gap-3 rounded-md hover:outline hover:outline-2 hover:outline-white items-center cursor-pointer bg-gray-dark"
                    onClick={() => {
                      setActiveTokenAddress(candidate.baseToken.address);
                      setPairInfo({
                        chainId: candidate.chainId,
                        dexId: candidate.dexId,
                        pairAddress: candidate.pairAddress,
                        labels: candidate.labels ? candidate.labels : ["AMM"],
                        baseToken: candidate.baseToken,
                        quoteToken: candidate.quoteToken
                      })
                      setShowCandidate(false);
                    }}
                  >
                    <div className="flex flex-col gap-2">
                      <img
                        className="w-5 h-5"
                        src={images[candidate.chainId]} loading="lazy"
                      />
                      <img
                        className="w-5 h-5"
                        src={images[candidate.dexId]} loading="lazy"
                      />
                    </div>
                    {
                      candidate.info?.imageUrl ?
                        <img
                          className="w-[52px] h-[52px] rounded-[3px]"
                          src={candidate.info.imageUrl} loading="lazy"
                        /> :
                        <div className="w-[52px] h-[52px] outline-dashed outline-1 rounded-[3px] flex justify-center items-center">?</div>
                    }
                    <div className="w-[585px] flex flex-col gap-2 justify-bet">
                      <div className="flex gap-1 text-xs">
                        {candidate.labels &&
                          <div className="inline-block text-[10px] text-gray-500 border border-blue-875 px-1 rounded-[2px]">
                            {candidate.labels[0]}
                          </div>
                        }
                        <div>{candidate.baseToken.symbol}</div>
                        <div className="text-gray-normal mr-3">
                          {" / "}
                          {candidate.quoteToken.symbol}
                        </div>
                        <img
                          src={candidate.info?.imageUrl}
                          className="w-4 h-4 rounded-full"
                        />
                        {candidate.baseToken.name}
                      </div>
                      <div className="flex gap-2 text-xs">
                        <div>${candidate.priceUsd}</div>
                        <div className="text-red-normal mr-1">
                          {candidate.priceChange.m5}%
                        </div>
                        {candidate.liquidity && (
                          <div className="text-xxs">
                            <span className="font-extralight">Liquidity:</span>{" "}
                            ${formatNumber(candidate.liquidity?.usd, 1)}
                          </div>
                        )}
                        <div className="text-xxs">
                          <span className="font-extralight">24H Volume:</span> $
                          {formatNumber(candidate.volume.h24, 0)}
                        </div>
                        <div className="text-xxs">
                          <span className="font-extralight">Market Cap:</span> $
                          {formatNumber(candidate.fdv, 1)}
                        </div>
                      </div>
                      <div className="flex gap-1 text-xxs text-gray-normal">
                        <div>
                          Pair: {ellipsisAddress(candidate.pairAddress, false)}
                        </div>
                        <div>
                          Token:{" "}
                          {ellipsisAddress(candidate.baseToken.address, false)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TokenSearchPanel;
