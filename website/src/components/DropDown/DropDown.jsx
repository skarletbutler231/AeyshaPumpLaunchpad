/* eslint-disable react/prop-types */
import { useState } from "react";

export const TokenSelectButton = (props) => {
  const { tokenList, selectedIndex, setSelectedIndex, className } = props;
  const [show, setShow] = useState(false);
  return (
    <div className={`relative w-max h-6 min-w-max shrink-0 grow-0 ${className}`}>
      <button
        id="dropdownHoverButton"
        data-dropdown-toggle="dropdownHover"
        data-dropdown-trigger="hover"
        className="w-full h-full flex gap-1 space-grotesk-500 text-xxs text-white bg-gradient-to-br from-white/0 to-white/10 hover:ring-2 hover:ring-blue-300 rounded-xl px-2 py-2 text-center items-center justify-between border border-solid border-white/20"
        type="button"
        onClick={() => setShow((p) => !p)}
      >
        {selectedIndex == -1 ? (
          <div className="flex gap-2 items-center">
            {/* <img src="" width={20} height={20} alt="token-logo" /> */}
            Select
          </div>
        ) : (
          <div className="flex gap-1 items-center">
            {tokenList[selectedIndex] && tokenList[selectedIndex].logo ? (
              <img
                className="rounded-full w-3.5 h-3.5"
                src={tokenList[selectedIndex].logo}
                alt="token-logo"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-black-light border grow-0 shrink overflow-hidden overflow-ellipsis text-nowrap border-solid border-white">
                {tokenList[selectedIndex]?.symbol[0]}
              </div>
            )}
            {tokenList[selectedIndex]?.symbol}
          </div>
        )}
        <img src="/assets/icon/ic_arrow_down.svg" width={6} alt="down-logo" />
      </button>

      {/* <!-- Dropdown menu --> */}

      <div
        id="dropdownHover"
        className={`w-max min-w-full h-fit z-10 ${show ? "flex" : "hidden"
          } flex-col absolute space-grotesk-500 text-xxs overflow-hidden text-white bg-gradient-to-br from-[#111111] to-[#333333] opacity-100 rounded-xl text-center items-center justify-between border border-solid border-white/20`}
        onBlur={() => setShow(false)}
      >
        {tokenList?.map((_v, _i) => {
          return (
            <div
              key={_v.address}
              className="flex gap-1 p-1 w-full h-full hover:bg-slate-500 items-center cursor-pointer "
              onClick={() => {
                setSelectedIndex(_i);
                setShow(false);
              }}
            >
              {_v.logo ? (
                <img className="rounded-full w-3.5 h-3.5" src={_v.logo} alt="token-logo" />
              ) : (
                <div className="h-2.5 rounded-full bg-black-light border border-solid border-white">
                  {_v.symbol[0]}
                </div>
              )}
              {_v.symbol}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const TokenSelectButton1 = (props) => {
  const { tokenList, selectedIndex, setSelectedIndex, className } = props;
  const [show, setShow] = useState(false);
  return (
    <div className={`relative w-max min-w-max shrink-0 grow-0 ${className}`}>
      <button
        id="dropdownHoverButton"
        data-dropdown-toggle="dropdownHover"
        data-dropdown-trigger="hover"
        className="w-full flex gap-1 space-grotesk-500 text-xxs text-white hover:ring-1 hover:ring-blue-300 rounded-xl text-center items-center justify-between"
        type="button"
        onClick={() => setShow((p) => !p)}
      >
        {selectedIndex == -1 ? (
          <div className="flex gap-2 items-center">
            {/* <img src="" width={20} height={20} alt="token-logo" /> */}
            Select
          </div>
        ) : (
          <div className="flex gap-1 items-center">
            {tokenList[selectedIndex]?.logo ? (
              <img
                className="rounded-full w-3.5 h-3.5"
                src={tokenList[selectedIndex].logo}
                alt="token-logo"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-black-light border grow-0 shrink overflow-hidden overflow-ellipsis text-nowrap border-solid border-white">
                {tokenList[selectedIndex]?.symbol[0]}
              </div>
            )}
            {tokenList[selectedIndex]?.symbol}
          </div>
        )}
      </button>

      {/* <!-- Dropdown menu --> */}

      <div
        id="dropdownHover"
        className={`w-max h-fit z-10 ${show ? "flex" : "hidden"
          } flex-col absolute space-grotesk-500 text-xxs overflow-hidden text-white bg-gradient-to-br from-[#111111] to-[#333333] opacity-100 rounded-xl text-center items-center justify-between border border-solid border-white/20`}
        onBlur={() => setShow(false)}
      >
        {tokenList?.map((_v, _i) => {
          return (
            <div
              key={_v.address}
              className="flex gap-1 p-1 w-full hover:bg-slate-500 items-center cursor-pointer "
              onClick={() => {
                setSelectedIndex(_i);
                setShow(false);
              }}
            >
              {_v.logo ? (
                <img className="rounded-full w-3.5 h-3.5" src={_v.logo} alt="token-logo" />
              ) : (
                <div className="h-2.5 rounded-full bg-black-light border border-solid border-white">
                  {_v.symbol[0]}
                </div>
              )}
              {_v.symbol}
            </div>
          );
        })}
      </div>
    </div>
  );
};
