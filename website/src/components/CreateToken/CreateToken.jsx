/* eslint-disable react/prop-types */
import { useContext, useState } from "react";
import { toast } from "react-toastify";
import { Listbox, Select } from "@headlessui/react";
import { IoIosArrowDown } from "react-icons/io";
import axios from "axios";
import { FaChevronDown, FaDiscord, FaImage, FaLink, FaTelegram, FaTwitter, FaUpload } from "react-icons/fa";

import NotifyAddressDialog from "../Dialogs/NotifyAddressDialog";
import { pinFileToPinata, pinJsonToPinata, pinFileToNFTStorage, pinJsonToNFTStorage } from "../../utils/pinatasdk";
import etherIcon from '../../assets/images/ethereum.svg'
// import InstructionPopupDialog from "../components/Dialogs/InstructionPopupDialog";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AppContext } from "../../App";
import { USE_JITO, createToken, getTipTransaction, sendAndConfirmSignedTransactions } from "../../utils/solana";

export default function CreateToken({ className }) {
  const { SERVER_URL, user, setLoadingPrompt, setOpenLoading, sigData, signingData } =
    useContext(AppContext);

  const { connection } = useConnection();
  const { connected, publicKey, signAllTransactions } = useWallet();

  const [platform, setPlatform] = useState("raydium");
  const [useSuffix, setUseSuffix] = useState(false);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [decimals, setDecimals] = useState("");
  const [totalSupply, setTotalSupply] = useState("");
  const [logo, setLogo] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [discord, setDiscord] = useState("");
  const [description, setDescription] = useState("");

  const [showInstructionDialog, setShowInstructionDialog] = useState(false);
  const [notifyAddressDialog, setNotifyAddressDialog] = useState(false);
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyAddress, setNotifyAddress] = useState("");
  const [file, setFile] = useState();

  const handleUploadLogo = async (_file) => {
    setFile(_file);
    setLoadingPrompt("Uploading logo...");
    setOpenLoading(true);
    try {
      console.log(_file);
      // const uri = await pinFileToNFTStorage(file);
      let uri = await pinFileToPinata(_file);
      uri = `https://ipfs.io/ipfs/${uri}`;
      console.log(uri);
      setLogo(uri);
      toast.success("Succeed to upload logo!");
    }
    catch (err) {
      console.log(err);
      toast.warn("Failed to upload logo!");
    }
    setOpenLoading(false);
  };

  const handleCreate = async () => {
    console.log(connection)
    if (!connected) {
      toast.warn("Please connect wallet!");
      return;
    }

    if (name === "") {
      toast.warn("Please input name!");
      return;
    }

    if (symbol === "") {
      toast.warn("Please input symbol!");
      return;
    }

    if (platform == "raydium") {
      if (decimals === "" || isNaN(Number(decimals))) {
        toast.warn("Please input decimals!");
        return;
      }

      if (totalSupply === "" || isNaN(Number(totalSupply))) {
        toast.warn("Please input total supply!");
        return;
      }
    }

    setLoadingPrompt("Uploading metadata...");
    setOpenLoading(true);
    try {
      let metadata = useSuffix ? {
        name: name,
        symbol: symbol,
        showName: true,
        createdOn: "https://pump.fun"
      } : {
        name: name,
        symbol: symbol,
      };
      if (logo) {
        metadata.image = logo;
        metadata.file = logo;
      }
      if (description)
        metadata.description = description;
      if (website || twitter || telegram || discord) {
        if (website)
          metadata.website = website;
        if (twitter)
          metadata.twitter = twitter;
        if (telegram)
          metadata.telegram = telegram;
        if (discord && platform == "raydium")
          metadata.discord = discord;
      }

      // const uri = await pinJsonToNFTStorage(metadata);
      let uri = await pinJsonToPinata(metadata);
      uri = `https://ipfs.io/ipfs/${uri}`;
      console.log(uri);

      setLoadingPrompt("Creating tokens...");
      if (platform == "raydium") {
        try {
          const { mint, transaction } = await createToken(connection, publicKey, name, symbol, uri, Number(decimals), Number(totalSupply), useSuffix);
          if (transaction) {
            let txns = [transaction];
            if (USE_JITO) {
              const tipTxn = await getTipTransaction(connection, publicKey, user.presets.jitoTip);
              txns.push(tipTxn);
            }

            const signedTxns = await signAllTransactions(txns);
            const res = await sendAndConfirmSignedTransactions(USE_JITO, connection, signedTxns, signingData, sigData);
            if (res) {
              console.log("Mint Address:", mint.toBase58());
              setNotifyTitle("Token Address");
              setNotifyAddress(mint.toBase58());
              setNotifyAddressDialog(true);
              toast.success("Succeed to create token!");
            }
            else
              toast.warn("Failed to create token!");
          }
        }
        catch (err) {
          console.log(err);
          toast.warn("Failed to create token!");
        }
      } else {
        try {
          const { data } = await axios.post(`${SERVER_URL}/api/v1/pumpfun/upload_metadata`,
            {
              name: name,
              symbol: symbol,
              description: description,
              image: file,
              tokenUri: uri,
              twitter: twitter,
              telegram: telegram,
              website: website,
              signingData,
              sigData
            },
            {
              headers: {
                "Content-Type": "application/json",
                // "MW-USER-ID": localStorage.getItem("access-token"),
              },
            }
          );
          console.log(data);
          if (data.success === true) {
            console.log("Mint Address:", data.mintAddr);
            setNotifyTitle("Token Address");
            setNotifyAddress(data.mintAddr);
            setNotifyAddressDialog(true);
            toast.success("Succeed to create token!");
          }
          else
            toast.warn("Failed to create token!");
        }
        catch (err) {
          console.log(err)
          toast.warn("Failed to create token!");
        }
      }
    }
    catch (err) {
      console.log(err);
      toast.warn("Failed to upload metadata!");
    }
    setOpenLoading(false);
  };

  const handleDone = async () => {
    setNotifyAddressDialog(false);
    setShowInstructionDialog(true);
    setName("");
    setSymbol("");
    setDecimals("");
    setTotalSupply("");
    setLogo("");
    setWebsite("")
    setTwitter("")
    setTelegram("")
    setDiscord("")
    setDescription("");
  };

  return (
    <div className={`${className} w-full h-full flex justify-center text-white rounded-3xl `}>
      <NotifyAddressDialog
        isOpen={notifyAddressDialog}
        title="Token Contract"
        label="Contract Address"
        address={notifyAddress}
        onClose={handleDone}
      />
      {/* <InstructionPopupDialog
        isOpen={showInstructionDialog}
        onClose={() => setShowInstructionDialog(false)}
        activateLink={true}
      /> */}
      <div className="w-full flex flex-col h-full">
        <div className="flex items-center justify-between w-full h-auto mt-3 mb-3">
          <div className="flex gap-2 items-center m-auto text-sm font-medium text-white">
            Create SPL Token
          </div>
        </div>
        <div className="flex flex-col gap-4 w-full h-full rounded-b-[10px]">
          <div className="flex justify-between gap-4">
            <div className="w-[50%]">
              <div className="flex gap-1 justify-start items-center text-white text-left">
                Platform<span className="">*</span>
              </div>
              <div className="relative">
                <Select
                  className={
                    `outline-none rounded-lg text-orange border border-gray-blue placeholder:text-gray-border px-2 bg-light-black w-full h-8 mt-1`
                  }
                  onChange={(e) => setPlatform(e.target.value)}
                >
                  <option value="raydium" className="bg-gray-highlight text-white">Raydium</option>
                  <option value="pump.fun" className="bg-gray-highlight text-white">Pump.fun</option>
                </Select>
              </div>
            </div>
            <div className="w-[50%]">
              <div className="flex gap-1 text-white text-left">
                <input
                  type="checkbox"
                  className="w-4 h-4 outline-none bg-gray-highlight opacity-70 accent-[#4f0a7c70] ring-0"
                  checked={useSuffix}
                  onChange={(e) => setUseSuffix(e.target.checked)}
                />
                Use Suffix
              </div>
              <input
                className="outline-none rounded-lg text-orange border border-gray-blue placeholder:text-gray-border px-2.5 bg-light-black w-full h-8 mt-1 disabled:text-gray-normal disabled:border-gray-border"
                placeholder="Enter token symbol"
                value={"pump"}
                disabled={!useSuffix}
              />
            </div>
          </div>
          <div className="flex justify-between gap-4">
            <div className="w-[50%]">
              <div className="text-white text-left">
                Name<span className="pl-1 text-white">*</span>
              </div>
              <input
                className="outline-none rounded-lg text-orange border border-gray-blue placeholder:text-gray-border px-2.5 bg-light-black w-full h-8 mt-1"
                placeholder="Enter token name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="w-[50%]">
              <div className="text-white text-left">
                Symbol<span className="pl-1 text-white">*</span>
              </div>
              <input
                className="outline-none rounded-lg text-orange border border-gray-blue placeholder:text-gray-border px-2.5 bg-light-black w-full h-8 mt-1"
                placeholder="Enter token symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
              />
            </div>
          </div>
          {platform == "raydium" && <div className="flex justify-between gap-4">
            <div className="w-[50%]">
              <div className="text-white text-left">
                Decimals<span className="pl-1 text-white">*</span>
              </div>
              <input
                className="outline-none rounded-lg text-orange border border-gray-blue placeholder:text-gray-border px-2.5 bg-light-black w-full h-8 mt-1"
                placeholder="Enter decimals"
                value={decimals}
                onChange={(e) => setDecimals(e.target.value)}
              />
            </div>
            <div className="w-[50%]">
              <div className="text-white text-left">
                Total Supply<span className="pl-1 text-white">*</span>
              </div>
              <input
                className="outline-none rounded-lg text-orange border border-gray-blue placeholder:text-gray-border px-2.5 bg-light-black w-full h-8 mt-1"
                placeholder="Enter total supply"
                value={totalSupply}
                onChange={(e) => setTotalSupply(e.target.value)}
              />
            </div>
          </div>}
          <div className="flex justify-between gap-4">
            <div className="w-1/2 h-full items-center grow">
              <div className="flex items-center gap-2 font-sans text-xs uppercase text-gray-normal">
                <FaImage />
                Logo
              </div>
              <div className="mt-1 w-full h-24 flex flex-col items-center outline-none rounded-lg border border-gray-blue placeholder:text-gray-border px-2.5 py-1.5 bg-light-black">
                <input
                  className="w-full text-left outline-none border-none text-orange border placeholder:text-gray-border"
                  placeholder="Enter logo url"
                  value={logo}
                  onChange={(e) => setLogo(e.target.value)}
                />
                <label
                  className="h-[30%] grow p-2 flex justify-center items-center">
                  <input type="file"
                    className="hidden"
                    onChange={(e) => handleUploadLogo(e.target.files[0])} />
                  {logo ? <img className="w-8 h-8" src={logo} alt="logo" /> : <FaUpload className="w-8 h-8" />}
                </label>
              </div>
            </div>
            <div className="w-1/2">
              <div className="text-white text-left">
                Description
                <span className="pl-1 text-white"></span>
              </div>
              <textarea
                className="mt-1 w-full h-24 outline-none rounded-lg text-orange border border-gray-blue placeholder:text-gray-border px-2.5 py-1.5 bg-light-black"
                placeholder="Enter description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <div className="">
            <div className="flex gap-1 justify-start items-center text-white text-left">
              <FaLink /> Website URL
              <span className="pl-1 text-white"></span>
            </div>
            <input
              className="outline-none rounded-lg text-orange border border-gray-blue placeholder:text-gray-border px-2.5 bg-light-black w-full h-8 mt-1"
              placeholder="Enter website url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>
          <div className="">
            <div className="flex gap-1 justify-start items-center text-white text-left">
              <FaTwitter /> Twitter URL
              <span className="pl-1 text-white"></span>
            </div>
            <input
              className="outline-none rounded-lg text-orange border border-gray-blue placeholder:text-gray-border px-2.5 bg-light-black w-full h-8 mt-1"
              placeholder="Enter twitter url"
              value={twitter}
              onChange={(e) => setTwitter(e.target.value)}
            />
          </div>
          <div className="">
            <div className="flex gap-1 justify-start items-center text-white text-left">
              <FaTelegram /> Telegram URL
              <span className="pl-1 text-white"></span>
            </div>
            <input
              className="outline-none rounded-lg text-orange border border-gray-blue placeholder:text-gray-border px-2.5 bg-light-black w-full h-8 mt-1"
              placeholder="Enter telegram url"
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
            />
          </div>
          <div className="">
            <div className="flex gap-1 justify-start items-center text-white text-left">
              <FaDiscord /> Discord URL
              <span className="pl-1 text-white"></span>
            </div>
            <input
              className="outline-none rounded-lg text-orange border border-gray-blue placeholder:text-gray-border px-2.5 bg-light-black w-full h-8 mt-1"
              placeholder="Enter discord url"
              value={discord}
              onChange={(e) => setDiscord(e.target.value)}
            />
          </div>
          <div className="relative flex mt-2 text-white bg-transparent justify-evenly bg-clip-border">
            <button
              className="w-full font-medium text-center text-white uppercase px-6 h-10 rounded-lg justify-center items-center gap-2.5 inline-flex bg-gradient-blue-to-purple active:scale-95 transition duration-100 ease-in-out transform focus:outline-none"
              onClick={handleCreate}
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
