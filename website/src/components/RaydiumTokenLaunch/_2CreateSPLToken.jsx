/* eslint-disable react/prop-types */
import { useContext, useState } from "react";
import { toast } from "react-toastify";
import { Listbox, Select } from "@headlessui/react";
import { IoIosArrowDown } from "react-icons/io";
import axios from "axios";
import { FaChevronDown, FaDiscord, FaImage, FaLink, FaTelegram, FaTwitter, FaUpload } from "react-icons/fa";

import NotifyAddressDialog from "../Dialogs/NotifyAddressDialog";
import { pinFileToPinata, pinJsonToPinata, pinFileToNFTStorage, pinJsonToNFTStorage, pinFileToPinataSDK } from "../../utils/pinatasdk";
import etherIcon from '../../assets/images/ethereum.svg'
// import InstructionPopupDialog from "../components/Dialogs/InstructionPopupDialog";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AppContext } from "../../App";
import { USE_JITO, createFreezeToken, createFreezeToken2022, createToken, getTipTransaction, sendAndConfirmSignedTransactions } from "../../utils/solana";
import { isValidAddress } from "../../utils/methods";

export default function _2CreateSPLToken(props) {
    const { SERVER_URL, user, setCurrentProject, setLoadingPrompt, setOpenLoading, sigData, signingData } =
        useContext(AppContext);

    const { selectedProject, setSelectedProject, setStep: setMainStep, type = "raydium" } = props;
    const { connection } = useConnection();
    const { connected, publicKey, signAllTransactions } = useWallet();

    const [platform, setPlatform] = useState(type);
    const [useSuffix, setUseSuffix] = useState(false);
    const [suffix, setSuffix] = useState("pump");
    const [name, setName] = useState("");
    const [symbol, setSymbol] = useState("");
    const [decimals, setDecimals] = useState("");
    const [totalSupply, setTotalSupply] = useState("");
    const [feeRate, setFeeRate] = useState("");
    const [reflectionInterval, setReflectionInterval] = useState("");
    const [logo, setLogo] = useState("");
    const [website, setWebsite] = useState("");
    const [twitter, setTwitter] = useState("");
    const [telegram, setTelegram] = useState("");
    const [discord, setDiscord] = useState("");
    const [description, setDescription] = useState("");
    const [rewardCA, setRewardCA] = useState("");
    const [treasury1, setTreasury1] = useState("");
    const [treasuryPercent1, setTreasuryPercent1] = useState("");
    const [treasury2, setTreasury2] = useState("");
    const [treasuryPercent2, setTreasuryPercent2] = useState("");
    const [customRpc, setCustomRpc] = useState("");

    const [showInstructionDialog, setShowInstructionDialog] = useState(false);
    const [notifyAddressDialog, setNotifyAddressDialog] = useState(false);
    const [notifyTitle, setNotifyTitle] = useState("");
    const [notifyAddress, setNotifyAddress] = useState("");
    const [file, setFile] = useState();
    const [fileUrl, setFileUrl] = useState();
    const [creatorLpFeeShare, setCreatorLpFeeShare] = useState(true);

    const inputCSSString = "token-deploy-input rounded-xl outline-none text-orange placeholder:text-gray-border px-2.5 w-full h-8 mt-1";

    const handleUploadLogo = async (_file) => {
        setFile(_file);
        const file = _file;
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                console.log("image localhost url:", e.target.result)
                setFileUrl(e.target.result); // Set the image source to the file's data URL
            };
            reader.readAsDataURL(file);
        }
        if (platform == "raydium" || platform == "raydium-fair" || platform == "token-2022") {
            setLoadingPrompt("Uploading logo...");
            setOpenLoading(true);
            try {
                console.log(_file);
                // const uri = await pinFileToNFTStorage(file);
                let uri = await pinFileToPinata(_file);
                // let uri = await pinFileToPinataSDK(_file);
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
        }
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

        if (platform == "raydium" || platform == "raydium-fair") {
            if (decimals === "" || isNaN(Number(decimals))) {
                toast.warn("Please input decimals!");
                return;
            }

            if (totalSupply === "" || isNaN(Number(totalSupply))) {
                toast.warn("Please input total supply!");
                return;
            }
        }

        if (platform == "token-2022") {
            if (decimals === "" || isNaN(Number(decimals))) {
                toast.warn("Please input decimals!");
                return;
            }

            if (totalSupply === "" || isNaN(Number(totalSupply))) {
                toast.warn("Please input total supply!");
                return;
            }

            if (feeRate === "" || isNaN(Number(feeRate))) {
                toast.warn("Please input fee rate!");
                return;
            }

            if (reflectionInterval === "" || isNaN(Number(reflectionInterval))) {
                toast.warn("Please input reflection interval");
                return;
            }

            if (rewardCA != "" && !isValidAddress(rewardCA)) {
                toast.warn("Wrong reward CA!!!")
                return;
            }

            if (treasury1 != "" && !isValidAddress(treasury1)) {
                toast.warn("Wrong address of treasury wallet 1")
                return;
            }

            if (treasuryPercent1 != "" && isNaN(Number(treasuryPercent1))) {
                toast.warn("treas of treasury wallet 1")
                return;
            }

            if (treasury1 != "" && treasuryPercent1 == "") {
                toast.warn("Please input reward percentage of treasury wallet 1");
                return;
            }

            if (treasury1 == "" && treasuryPercent1 != "") {
                toast.warn("Please input address of treasury wallet 1");
                return;
            }

            if (treasury2 != "" && !isValidAddress(treasury2)) {
                toast.warn("Wrong address of treasury wallet 1")
                return;
            }

            if (treasuryPercent2 != "" && isNaN(Number(treasuryPercent2))) {
                toast.warn("treas of treasury wallet 1")
                return;
            }

            if (treasury2 != "" && treasuryPercent2 == "") {
                toast.warn("Please input reward percentage of treasury wallet 1");
                return;
            }

            if (treasury2 == "" && treasuryPercent2 != "") {
                toast.warn("Please input address of treasury wallet 1");
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
                if (discord && (platform == "raydium" || platform == "raydium-fair" || platform == "token-2022"))
                    metadata.discord = discord;
            }

            // const uri = await pinJsonToNFTStorage(metadata);
            let uri = await pinJsonToPinata(metadata);
            uri = `https://ipfs.io/ipfs/${uri}`;
            console.log(uri);

            setLoadingPrompt("Creating tokens...");
            if (platform == "raydium") {
                try {
                    const { mint, transaction } = await createToken(connection, publicKey, name, symbol, uri, Number(decimals), Number(totalSupply), useSuffix, suffix, sigData, signingData);
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
                            toast.success("Succeed to create token!");

                            if (selectedProject._id) {
                                await handleSetTokenAddress(selectedProject._id, mint.toBase58())
                            } else {
                                let updatedProject = { ...selectedProject };
                                updatedProject.token = { address: mint.toBase58() };
                                setSelectedProject(updatedProject);
                                setMainStep(p => p + 1);
                            }
                        }
                        else
                            toast.warn("Failed to create token!");
                    }
                }
                catch (err) {
                    console.log(err);
                    toast.warn("Failed to create token!");
                }
            } else if (platform == "raydium-fair") {
                try {
                    const { mint, transaction } = await createFreezeToken(connection, publicKey, name, symbol, uri, Number(decimals), Number(totalSupply), useSuffix, suffix, sigData, signingData);
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
                            toast.success("Succeed to create token!");

                            if (selectedProject._id) {
                                await handleSetTokenAddress(selectedProject._id, mint.toBase58())
                            } else {
                                let updatedProject = { ...selectedProject };
                                updatedProject.token = { address: mint.toBase58() };
                                setSelectedProject(updatedProject);
                                setMainStep(p => p + 1);
                            }
                        }
                        else
                            toast.warn("Failed to create token!");
                    }
                }
                catch (err) {
                    console.log(err);
                    toast.warn("Failed to create token!");
                }
            } else if (platform == "token-2022") {
                try {
                    const { mint, transaction, authority } = await createFreezeToken2022(connection, publicKey, name, symbol, uri, Number(decimals), Number(totalSupply), Number(feeRate), useSuffix, suffix, sigData, signingData);
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
                            toast.success("Succeed to create token!");

                            if (selectedProject._id) {
                                await handleSetTokenAddress(selectedProject._id, mint.toBase58(), authority, Number(reflectionInterval) * 60, treasury1, treasuryPercent1, treasury2, treasuryPercent2, customRpc, rewardCA)
                            } else {
                                let updatedProject = { ...selectedProject };
                                updatedProject.token = { address: mint.toBase58() };
                                setSelectedProject(updatedProject);
                                setMainStep(p => p + 1);
                            }
                        }
                        else
                            toast.warn("Failed to create token!");
                    }
                }
                catch (err) {
                    console.log(err);
                    toast.warn("Failed to create token!");
                }
            } else if (platform == "raydium.launchlab") {
                try {
                    const formData = new FormData();
                    formData.append("file", file);
                    formData.append("name", name);
                    formData.append("symbol", symbol);
                    formData.append("tokenUri", uri);
                    formData.append("creatorLpFeeShare", creatorLpFeeShare)
                    formData.append("twitter", twitter);
                    formData.append("telegram", telegram);
                    formData.append("website", website);
                    formData.append("signingData", JSON.stringify(signingData));
                    formData.append("sigData", JSON.stringify(sigData));
                    const { data } = await axios.post(`${SERVER_URL}/api/v1/raydiumlaunchlab/upload_metadata`, formData);
                    console.log(data);
                    if (data.success === true) {
                        console.log("Mint Address:", data.mintAddr);
                        toast.success("Succeed to create token!");

                        if (selectedProject._id) {
                            await handleSetTokenAddress(selectedProject._id, data.mintAddr)
                        } else {
                            let updatedProject = { ...selectedProject };
                            updatedProject.token = { address: data.mintAddr };
                            setSelectedProject(updatedProject);
                            setMainStep(p => p + 1);
                        }
                    }
                    else
                        toast.warn("Failed to create token!");
                }
                catch (err) {
                    console.log(err)
                    toast.warn("Failed to create token!");
                }
            } else {
                try {
                    const formData = new FormData();
                    formData.append("file", file);
                    formData.append("name", name);
                    formData.append("symbol", symbol);
                    formData.append("tokenUri", uri);
                    formData.append("twitter", twitter);
                    formData.append("telegram", telegram);
                    formData.append("website", website);
                    formData.append("signingData", JSON.stringify(signingData));
                    formData.append("sigData", JSON.stringify(sigData));
                    const { data } = await axios.post(`${SERVER_URL}/api/v1/pumpfun/upload_metadata`, formData);
                    console.log(data);
                    if (data.success === true) {
                        console.log("Mint Address:", data.mintAddr);
                        toast.success("Succeed to create token!");

                        if (selectedProject._id) {
                            await handleSetTokenAddress(selectedProject._id, data.mintAddr)
                        } else {
                            let updatedProject = { ...selectedProject };
                            updatedProject.token = { address: data.mintAddr };
                            setSelectedProject(updatedProject);
                            setMainStep(p => p + 1);
                        }
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

    const handleSetTokenAddress = async (projectId, tokenAddress, authorityPrivateKey = undefined, interval = undefined, wallet1 = undefined, percent1 = undefined, wallet2 = undefined, percent2 = undefined, customRpc = undefined, rewardCA = undefined) => {
        console.log("Setting token address to selected project...", projectId, tokenAddress, platform);
        setLoadingPrompt("Setting Token Address...")
        try {
            const { data } = await axios.post(`${SERVER_URL}/api/v1/project/set-token-address`,
                {
                    projectId,
                    address: tokenAddress,
                    name,
                    symbol,
                    platform,
                    authority: authorityPrivateKey,
                    interval,
                    wallet1,
                    percent1,
                    wallet2,
                    percent2,
                    customRpc,
                    rewardCA,
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
                let updatedProject = { ...selectedProject };
                updatedProject.token = data.data;
                setSelectedProject(updatedProject);
                setCurrentProject(updatedProject);
                toast.success("Project Updated Successfully");
                setMainStep(2);
            } else {
                console.log(data.error);
                toast.warn("Failed to set token address");
            }
        }
        catch (err) {
            console.log(err)
            toast.error("Failed to set token address");
        }
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
        <div className={`w-fit h-fit flex justify-center text-white rounded-3xl `}>
            <div className="w-full flex flex-col h-full">
                <p className="text-lg mb-4">Create Token</p>
                <div className="flex items-center justify-between w-full h-auto mt-3 mb-3">
                    <div className="w-[250px] p-2 rounded-md bg-[#FFFFFF0A] flex gap-2 items-center font-conthrax text-xs font-medium text-white">
                        <img className="w-8 h-8 rounded-sm p-1 bg-[#FFFFFF12]" src={(platform == "pump.fun" || platform == "pump.fun-ghost") ? "/assets/img/pumpfun.png" : "/assets/img/raydium.png"} />
                        Platform: <span className="capitalize">{(platform == "pump.fun" || platform == "pump.fun-ghost") ? "pump.fun" : platform == "raydium.launchlab" ? "Raydium LaunchLab" : "raydium"}</span>
                    </div>
                </div>
                <div className="flex flex-col gap-4 w-full h-full rounded-b-[10px]">
                    {/* <div className="flex justify-between gap-4">
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
                        <div className="w-[50%]"> */}
                    {
                        (type == "raydium" || type == "raydium-fair" || type == "token-2022") &&
                        <div className="flex gap-1 text-white text-left items-center">
                            <input
                                type="checkbox"
                                className="w-4 h-4 outline-none bg-gray-highlight opacity-70 accent-[#4f0a7c70] ring-0"
                                checked={useSuffix}
                                onChange={(e) => setUseSuffix(e.target.checked)}
                                maxLength={5}
                            />
                            Use Suffix
                            {
                                useSuffix && <input
                                    className={`${inputCSSString} ml-4 !w-36`}
                                    placeholder="Enter Suffix"
                                    value={suffix}
                                    maxLength={32}
                                    onChange={(e) => setSuffix(e.target.value)}
                                />
                            }
                        </div>
                    }
                    {
                        (type == "raydium" || type == "raydium-fair" || type == "token-2022") && useSuffix &&
                        <div className="-mt-2 text-red-normal text-left">⚠️ You should wait for a few minutes while find out the token address. Long suffix makes this longer. Please use short suffix.</div>
                    }
                    {/*<input
                                className="outline-none rounded-lg text-orange border border-gray-blue placeholder:text-gray-border px-2.5 bg-light-black w-full h-8 mt-1 disabled:text-gray-normal disabled:border-gray-border"
                                placeholder="Enter token symbol"
                                value={"pump"}
                                disabled={!useSuffix}
                            />
                        </div>
                    </div> */}
                    <div className="flex justify-between gap-2">
                        <div className="w-[50%]">
                            <div className="text-white text-left">
                                Name<span className="pl-1 text-white">*</span>
                            </div>
                            <input
                                className={inputCSSString}
                                placeholder="Enter token name"
                                value={name}
                                maxLength={32}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div className="w-[50%]">
                            <div className="text-white text-left">
                                Symbol<span className="pl-1 text-white">*</span>
                            </div>
                            <input
                                className={inputCSSString}
                                placeholder="Enter token symbol"
                                value={symbol}
                                maxLength={32}
                                onChange={(e) => setSymbol(e.target.value)}
                            />
                        </div>
                    </div>
                    {(platform == "raydium" || platform == "raydium-fair" || platform == "token-2022") && <div className="flex justify-between gap-2">
                        <div className="w-[50%]">
                            <div className="text-white text-left">
                                Decimals<span className="pl-1 text-white">*</span>
                            </div>
                            <input
                                className={inputCSSString}
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
                                className={inputCSSString}
                                placeholder="Enter total supply"
                                value={totalSupply}
                                onChange={(e) => setTotalSupply(e.target.value)}
                            />
                        </div>
                    </div>}
                    {(platform == "token-2022") && <div className="flex justify-between gap-2">
                        <div className="w-[50%]">
                            <div className="text-white text-left">
                                FeeRate<span className="pl-1 text-white">*</span>
                            </div>
                            <input
                                className={inputCSSString}
                                placeholder="Enter fee rate as percentage"
                                value={feeRate}
                                onChange={(e) => setFeeRate(e.target.value)}
                            />
                        </div>
                        <div className="w-[50%]">
                            <div className="text-white text-left">
                                Distribution Interval<span className="pl-1 text-white">*</span>
                            </div>
                            <input
                                className={inputCSSString}
                                placeholder="Enter interval value as minute"
                                value={reflectionInterval}
                                onChange={(e) => setReflectionInterval(e.target.value)}
                            />
                        </div>
                    </div>}
                    {(platform == "token-2022") && <div className="flex justify-between gap-2">
                        <div className="w-full">
                            <div className="text-white text-left">
                                Reward CA<span className="pl-1 text-white">{" (Left blank if reward is sol)"}</span>
                            </div>
                            <input
                                className={inputCSSString}
                                placeholder="Enter Reward CA."
                                value={rewardCA}
                                onChange={(e) => setRewardCA(e.target.value)}
                            />
                        </div>
                    </div>}
                    {(platform == "token-2022") && <div className="flex justify-between gap-2">
                        <div className="w-[50%]">
                            <div className="text-white text-left">
                                Wallet 1<span className="pl-1 text-white"></span>
                            </div>
                            <input
                                className={inputCSSString}
                                placeholder="Enter the address of treasury wallet 1"
                                value={treasury1}
                                onChange={(e) => setTreasury1(e.target.value)}
                            />
                        </div>
                        <div className="w-[50%]">
                            <div className="text-white text-left">
                                Percentage<span className="pl-1 text-white"></span>
                            </div>
                            <input
                                className={inputCSSString}
                                placeholder="Enter the percentage for wallet 1"
                                value={treasuryPercent1}
                                onChange={(e) => setTreasuryPercent1(e.target.value)}
                            />
                        </div>
                    </div>}
                    {(platform == "token-2022") && <div className="flex justify-between gap-2">
                        <div className="w-[50%]">
                            <div className="text-white text-left">
                                Wallet 2<span className="pl-1 text-white"></span>
                            </div>
                            <input
                                className={inputCSSString}
                                placeholder="Enter the address of treasury wallet 2"
                                value={treasury2}
                                onChange={(e) => setTreasury2(e.target.value)}
                            />
                        </div>
                        <div className="w-[50%]">
                            <div className="text-white text-left">
                                Percentage<span className="pl-1 text-white"></span>
                            </div>
                            <input
                                className={inputCSSString}
                                placeholder="Enter the percentage for wallet 2"
                                value={treasuryPercent2}
                                onChange={(e) => setTreasuryPercent2(e.target.value)}
                            />
                        </div>
                    </div>}
                    {(platform == "token-2022") && <div className="flex justify-between gap-2">
                        <div className="w-full">
                            <div className="text-white text-left">
                                Custom Rpc Endpoint<span className="pl-1 text-white"></span>
                            </div>
                            <input
                                className={inputCSSString}
                                placeholder="Enter rpc endpoint url"
                                value={customRpc}
                                onChange={(e) => setCustomRpc(e.target.value)}
                            />
                        </div>
                    </div>}
                    <div className="flex justify-between gap-2">
                        <div className="w-1/2 h-full items-center grow">
                            <div className="flex items-center gap-2 font-sans text-xs uppercase text-gray-normal">
                                <FaImage />
                                Logo
                            </div>
                            <div className="mt-1 w-full h-24 flex flex-col token-deploy-input items-center rounded-lg px-2.5 py-1.5">
                                <input
                                    className="w-full text-left outline-none border-none text-orange border placeholder:text-gray-border bg-transparent"
                                    placeholder="Enter logo url"
                                    value={logo}
                                    onChange={(e) => setLogo(e.target.value)}
                                />
                                <label
                                    className="h-[30%] grow p-2 flex justify-center items-center">
                                    <input type="file"
                                        className="hidden"
                                        onChange={(e) => handleUploadLogo(e.target.files[0])} />
                                    {fileUrl ? <img className="w-8 h-8" src={fileUrl} alt="logo" /> : <FaUpload className="w-8 h-8" />}
                                </label>
                            </div>
                        </div>
                        <div className="w-1/2">
                            <div className="text-white text-left">
                                Description
                                <span className="pl-1 text-white"></span>
                            </div>
                            <textarea
                                className="mt-1 w-full h-24 outline-none rounded-lg text-orange placeholder:text-gray-border px-2.5 py-1.5 token-deploy-input"
                                placeholder="Enter description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>
                    </div>
                    {/* {type == "raydium.launchlab" && <div className="flex gap-1 text-white text-left items-center">
                        <input
                            type="checkbox"
                            className="w-4 h-4 outline-none bg-gray-highlight opacity-70 accent-[#4f0a7c70] ring-0"
                            checked={creatorLpFeeShare}
                            onChange={(e) => setCreatorLpFeeShare(e.target.checked)}
                            maxLength={5}
                        />
                        Creator LP fee share
                    </div>} */}
                    <div className="flex justify-between gap-2">
                        <div className="w-1/4">
                            <div className="flex gap-1 justify-start items-center text-white text-left">
                                <FaLink /> Website URL
                                <span className="pl-1 text-white"></span>
                            </div>
                            <input
                                className={inputCSSString}
                                placeholder="Enter website url"
                                value={website}
                                onChange={(e) => setWebsite(e.target.value)}
                            />
                        </div>
                        <div className="w-1/4">
                            <div className="flex gap-1 justify-start items-center text-white text-left">
                                <FaTwitter /> Twitter URL
                                <span className="pl-1 text-white"></span>
                            </div>
                            <input
                                className={inputCSSString}
                                placeholder="Enter twitter url"
                                value={twitter}
                                onChange={(e) => setTwitter(e.target.value)}
                            />
                        </div>
                        <div className="w-1/4">
                            <div className="flex gap-1 justify-start items-center text-white text-left">
                                <FaTelegram /> Telegram URL
                                <span className="pl-1 text-white"></span>
                            </div>
                            <input
                                className={inputCSSString}
                                placeholder="Enter telegram url"
                                value={telegram}
                                onChange={(e) => setTelegram(e.target.value)}
                            />
                        </div>
                        <div className="w-1/4">
                            <div className="flex gap-1 justify-start items-center text-white text-left">
                                <FaDiscord /> Discord URL
                                <span className="pl-1 text-white"></span>
                            </div>
                            <input
                                className={inputCSSString}
                                placeholder="Enter discord url"
                                value={discord}
                                onChange={(e) => setDiscord(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="relative flex mt-2 text-white bg-transparent justify-evenly bg-clip-border">
                        <button
                            className="w-full font-medium text-center text-white uppercase px-6 h-10 rounded-lg justify-center items-center gap-2.5 inline-flex bg-green-button active:scale-95 transition duration-100 ease-in-out transform focus:outline-none"
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
