
import { useContext, useState, useEffect } from "react";
import { toast } from "react-toastify";
import { IoIosAddCircle, IoIosDownload } from "react-icons/io";
import { FaDatabase, FaEllipsisV, FaExclamationTriangle, FaQuestion, FaRegCopy, FaSave, FaRedo, FaMars, FaRandom } from "react-icons/fa";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Popover } from "@headlessui/react";
import BigNumber from "bignumber.js";
import {
    Keypair,
    PublicKey,
} from "@solana/web3.js";
import {
    getMint,
    getAccount,
    getAssociatedTokenAddress,
} from "@solana/spl-token";
import bs58 from "bs58";
import axios from "axios";

import { AppContext } from "../../App";
import ZombieDialog from "../Dialogs/ZombieDialog";
import NewWalletDialog from "../Dialogs/NewWalletDialog";
import TokenAmountDialog from "../Dialogs/TokenAmountDialog";
import SolAmountDialog from "../Dialogs/SolAmountDialog";
import { ellipsisAddress, isValidAddress, numberWithCommas } from "../../utils/methods";
import PumpfunSimulationDialog from "../Dialogs/PumpfunSimulationDialog";
import BundleProgressDialog from "../Dialogs/BundleProgressDailog";

export default function PumpfunGhostBundle({ className }) {
    const {
        SERVER_URL,
        setLoadingPrompt,
        setOpenLoading,
        user,
        currentProject,
        setCurrentProject,
        reloadAllBalances,
        updateProject,
        walletBalanceData,
        teamWalletBalanceData,
        notifyStatus,
        setNotifyStatus,
        signingData,
        sigData
    } = useContext(AppContext);
    const { connected, publicKey, signAllTransactions } = useWallet();
    const { connection } = useConnection();

    const MAX_AMOUNT_ON_CURVE = 783100000;

    const [copied, setCopied] = useState({});
    const [zombieDialog, setZombieDialog] = useState(false);
    const [newWalletDialog, setNewWalletDialog] = useState(false);
    const [tokenAmountDialog, setTokenAmountDialog] = useState(false);
    const [solAmountDialog, setSolAmountDialog] = useState(false);
    const [simulateData, setSimulateData] = useState({});
    const [simulateZombie, setSimulateZombie] = useState({ address: "", value: "" });
    const [simulationDialog, setSimulationDialog] = useState(false);
    const [targetWallet, setTargetWallet] = useState("");

    const [token, setToken] = useState("");
    const [tokenInfo, setTokenInfo] = useState({ decimals: "", totalSupply: "" });
    const [zombieWallet, setZombieWallet] = useState({ address: "", privateKey: "" });
    const [tokenAmount, setTokenAmount] = useState("783,100,000");
    const [solAmount, setSolAmount] = useState("85.005356");

    const [walletAllChecked, setWalletAllChecked] = useState(false);
    const [walletChecked, setWalletChecked] = useState([]);
    const [walletSolBalance, setWalletSolBalance] = useState([]);
    const [walletTokenBalance, setWalletTokenBalance] = useState([]);
    const [walletTokenAmount, setWalletTokenAmount] = useState([]);
    const [walletSolAmount, setWalletSolAmount] = useState([]);
    const [teamWalletAllChecked, setTeamWalletAllChecked] = useState(false);
    const [teamWalletChecked, setTeamWalletChecked] = useState([]);
    const [teamWalletSolBalance, setTeamWalletSolBalance] = useState([]);
    const [teamWalletTokenBalance, setTeamWalletTokenBalance] = useState([]);
    const [teamWalletTokenAmount, setTeamWalletTokenAmount] = useState([]);
    const [isDragging, setIsDragging] = useState(false);

    const [alreadyMint, setAlreadyMint] = useState(false);
    const [snipeMode, setSnipeMode] = useState(1);

    const [showBundleProgressDialog, setShowBundleProgressDialog] = useState(false);
    const [progressPercent, setProgressPercent] = useState(0);
    const [progressLeft, setProgressLeft] = useState(0);

    const disabled = !currentProject.token || currentProject.status !== "OPEN" || !user._id;

    const modeSetDisabled = alreadyMint || currentProject.status !== "OPEN";

    useEffect(() => {
        if (currentProject.token || currentProject.zombie) {
            setToken(currentProject.token.address);
            setZombieWallet({
                address: currentProject.zombie,
                privateKey: "",
            });
            handleGetCurrentStatus(currentProject);
        }
        else {
            setToken("");
            setZombieWallet({ address: "", privateKey: "" });
            setWalletAllChecked(false);
            setWalletChecked([]);
        }
    }, [currentProject.token, currentProject.zombie]);

    useEffect(() => {
        const getTokenInfo = async (tokenAddress, connection) => {
            try {
                const mint = new PublicKey(tokenAddress);
                const mintInfo = await getMint(connection, mint);
                setTokenInfo({
                    decimals: mintInfo.decimals.toString(),
                    totalSupply: new BigNumber(mintInfo.supply.toString() + "e-" + mintInfo.decimals.toString()).toFixed(0)
                });
            }
            catch (err) {
                console.log(err);
                setTokenInfo({
                    decimals: "",
                    totalSupply: "",
                });
            }
        };

        if (connected && isValidAddress(token)) {
            getTokenInfo(token, connection);
        }
        else {
            setTokenInfo({
                decimals: "",
                totalSupply: "",
            });
        }
    }, [connected, connection, token]);

    useEffect(() => {
        const updateBalance = async (connection, tokenAddress, owner) => {
            console.log("Updating balance...", tokenAddress, owner.toBase58());
            try {
                const mint = new PublicKey(tokenAddress);
                const mintInfo = await getMint(connection, mint);
                const tokenATA = await getAssociatedTokenAddress(mint, owner);
                const tokenAccountInfo = await getAccount(connection, tokenATA);
                const balance = Number(new BigNumber(tokenAccountInfo.amount.toString() + "e-" + mintInfo.decimals.toString()).toString()).toFixed(4);
                return balance;
            }
            catch (err) {
                console.log(err);
                return "0";
            }
        };

        // if (connected && isValidAddress(token)) {
        //     updateBalance(connection, token, publicKey).then(response => {
        //         setTokenAmount(response);
        //     });
        // }
        // else
        //     setTokenAmount("");
    }, [connected, connection, token, publicKey]);

    useEffect(() => {
        if (currentProject.wallets) {
            if (currentProject.wallets.length !== walletChecked.length) {
                const newWalletChecked = currentProject.wallets.map(() => false);
                setWalletChecked(newWalletChecked);
                setWalletAllChecked(false);
            }

            setWalletSolBalance(currentProject.wallets.map(() => "-"));
            setWalletTokenBalance(currentProject.wallets.map(() => "0"));
            setWalletTokenAmount(currentProject.wallets.map((item) => item.initialTokenAmount));
            setWalletSolAmount(currentProject.wallets.map(item => item.initialSolAmount));
        }
        else {
            setWalletSolBalance([]);
            setWalletTokenBalance([]);
            setWalletTokenAmount([]);
            setWalletSolAmount([]);
        }
    }, [currentProject.wallets, walletChecked.length]);

    useEffect(() => {
        if (currentProject.teamWallets) {
            if (currentProject.teamWallets.length !== teamWalletChecked.length) {
                const newTeamWalletChecked = currentProject.teamWallets.map(() => false);
                setTeamWalletChecked(newTeamWalletChecked);
                setTeamWalletAllChecked(false);
            }

            setTeamWalletSolBalance(currentProject.teamWallets.map(() => "-"));
            setTeamWalletTokenBalance(currentProject.teamWallets.map(() => ""));
            setTeamWalletTokenAmount(currentProject.teamWallets.map((item) => item.initialTokenAmount));
        }
        else {
            setTeamWalletSolBalance([]);
            setTeamWalletTokenBalance([]);
            setTeamWalletTokenAmount([]);
        }
    }, [currentProject.teamWallets, teamWalletChecked.length]);

    useEffect(() => {
        if (currentProject.token && walletBalanceData.address === currentProject.token.address && walletBalanceData.token.length === walletTokenBalance.length) {
            setWalletTokenBalance(walletBalanceData.token);
        }
    }, [currentProject.token, walletBalanceData.address, walletBalanceData.token, walletTokenBalance.length]);

    useEffect(() => {
        if (currentProject.token && walletBalanceData.address === currentProject.token.address && walletBalanceData.sol.length === walletSolBalance.length) {
            setWalletSolBalance(walletBalanceData.sol);
        }
    }, [currentProject.token, walletBalanceData.address, walletBalanceData.sol, walletSolBalance.length]);

    useEffect(() => {
        if (currentProject.token && teamWalletBalanceData.address === currentProject.token.address && teamWalletBalanceData.token.length === teamWalletTokenBalance.length) {
            setTeamWalletTokenBalance(teamWalletBalanceData.token);
        }
    }, [currentProject.token, teamWalletBalanceData.address, teamWalletBalanceData.token, teamWalletTokenBalance.length]);

    useEffect(() => {
        if (currentProject.token && teamWalletBalanceData.address === currentProject.token.address && teamWalletBalanceData.sol.length === teamWalletSolBalance.length) {
            setTeamWalletSolBalance(teamWalletBalanceData.sol);
        }
    }, [currentProject.token, teamWalletBalanceData.address, teamWalletBalanceData.sol, teamWalletSolBalance.length]);

    useEffect(() => {
        if (notifyStatus.tag === "SIMULATE_COMPLETED") {
            if (notifyStatus.success) {
                toast.success("Succeed to simulate!");
                if (notifyStatus.data) {
                    console.log(notifyStatus)
                    setSimulateZombie(notifyStatus.data.zombie);
                    setSimulationDialog(true);
                    setSimulateData(notifyStatus.data);
                }
            }
            else {
                toast.warn(`Failed to simulate! ${notifyStatus.error ? notifyStatus.error : ""}`);
                setSimulateData({});
            }
            setOpenLoading(false);
            // setNotifyStatus({ success: true, tag: "NONE" });
        }
        else if (notifyStatus.tag === "DISPERSE_COMPLETED") {
            if (notifyStatus.success)
                toast.success("Succeed to disperse!");
            else
                toast.warn("Failed to disperse SOL!");

            if (notifyStatus.project) {
                updateProject(notifyStatus.project);
                if (currentProject._id === notifyStatus.project._id)
                    setCurrentProject(notifyStatus.project);
            }

            setOpenLoading(false);
            // setNotifyStatus({ success: true, tag: "NONE" });
        }
        else if (notifyStatus.tag === "BUY_COMPLETED") {
            if (notifyStatus.success)
                toast.success("Succeed to enable and buy!");
            else
                toast.warn("Failed to enable and buy!");

            if (notifyStatus.project) {
                updateProject(notifyStatus.project);
                if (currentProject._id === notifyStatus.project._id)
                    setCurrentProject(notifyStatus.project);
            }

            setSimulateData({});
            setOpenLoading(false);
            // setNotifyStatus({ success: true, tag: "NONE" });
        }
        else if (notifyStatus.tag === "TRANSFER_ALL_COMPLETED") {
            if (notifyStatus.success)
                toast.success("Succeed to enable and buy!");
            else
                toast.warn("Failed to enable and buy!");

            if (notifyStatus.project) {
                updateProject(notifyStatus.project);
                if (currentProject._id === notifyStatus.project._id)
                    setCurrentProject(notifyStatus.project);
            }

            // setSimulateData({});
            setOpenLoading(false);
            // setNotifyStatus({ success: true, tag: "NONE" });
        }
        else if (notifyStatus.tag === "MINT_COMPLETED") {
            if (notifyStatus.success)
                toast.success("Succeed to mint pump fun token!");
            else
                toast.warn("Failed to mint!");

            if (notifyStatus.project) {
                updateProject(notifyStatus.project);
                if (currentProject._id === notifyStatus.project._id)
                    setCurrentProject(notifyStatus.project);
            }

            // setSimulateData({});
            setOpenLoading(false);
            // setNotifyStatus({ success: true, tag: "NONE" });
        }
        else if (notifyStatus.tag === "DISPERSE_TOKENS_COMPLETED") {
            if (notifyStatus.success)
                toast.success("Succeed to disperse tokens!");
            else
                toast.warn("Failed to disperse tokens!");

            if (notifyStatus.project) {
                updateProject(notifyStatus.project);
                if (currentProject._id === notifyStatus.project._id)
                    setCurrentProject(notifyStatus.project);
            }

            setOpenLoading(false);
            // setNotifyStatus({ success: true, tag: "NONE" });
        }
        else if (notifyStatus.tag === "COLLECT_ALL_SOL") {
            if (notifyStatus.success)
                toast.success("Succeed to collect all SOL!");
            else
                toast.warn("Failed to collect all SOL!");

            if (notifyStatus.project) {
                updateProject(notifyStatus.project);
                if (currentProject._id === notifyStatus.project._id)
                    setCurrentProject(notifyStatus.project);
            }

            setOpenLoading(false);
            // setNotifyStatus({ success: true, tag: "NONE" });
        }
    }, [notifyStatus, currentProject._id]);

    // useEffect(() => {
    //     if (currentProject.status == "OPEN" && alreadyMint) {
    //         setSnipeMode(1);
    //     } else {
    //         setSnipeMode(0);
    //     }
    // }, [alreadyMint, currentProject.status]);

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
            }), 600);
        }
        else
            console.error('Clipboard not supported');
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

    const handleReloadProject = async () => {
        setLoadingPrompt("Reloading Balances...");
        setOpenLoading(true);
        await reloadAllBalances()
        setOpenLoading(false);
    }

    const addRemainedTokensToDev = (remainedTokenAmount) => {
        let newWalletAmounts = [...walletTokenAmount];
        newWalletAmounts[0] = Number(newWalletAmounts[0]) + Number(remainedTokenAmount);
        setWalletTokenAmount(newWalletAmounts);
    }

    const disperseRemainedTokens = (remainedTokenAmount) => {
        if (!walletChecked || walletChecked.length === 0) {
            return;
        }

        const checkedWallets = walletChecked.filter(checked => checked);
        const checkedCnt = walletChecked[0] ? checkedWallets.length - 1 : checkedWallets.length;

        if (checkedCnt === 0) {
            return;
        }

        const amountPerWallet = Math.floor(remainedTokenAmount / checkedCnt);
        let remainedAmt = remainedTokenAmount - amountPerWallet * checkedCnt;
        let newWalletAmounts = [walletTokenAmount[0]];

        for (let i = 1; i < walletChecked.length; i++) {
            if (walletChecked[i]) {
                const newAmount = Number(walletTokenAmount[i]) + amountPerWallet + remainedAmt;
                remainedAmt = 0;
                newWalletAmounts = [...newWalletAmounts, newAmount];
            }
            else {
                newWalletAmounts = [...newWalletAmounts, walletTokenAmount[i]];
            }
        }

        setWalletTokenAmount(newWalletAmounts);
    }

    const handleCollectAllSol = async () => {
        if (!currentProject.token)
            return;

        if (!isValidAddress(targetWallet)) {
            toast.warn("Please input wallet to send SOL!");
            return;
        }

        const validWalletChecked = walletChecked.filter(item => item === true);
        const validTeamWalletChecked = teamWalletChecked.filter(item => item === true);
        if (validWalletChecked.length === 0 && validTeamWalletChecked.length === 0) {
            toast.warn("Please check wallets to collect SOL from!");
            return;
        }

        setLoadingPrompt("Collecting all SOL...");
        setOpenLoading(true);
        try {
            let wallets = [];
            let teamWallets = [];
            for (let i = 0; i < currentProject.wallets.length; i++) {
                if (walletChecked[i]) {
                    wallets = [
                        ...wallets,
                        currentProject.wallets[i].address,
                    ];
                }
            }

            if (currentProject.teamWallets) {
                for (let i = 0; i < currentProject.teamWallets.length; i++) {
                    if (teamWalletChecked[i]) {
                        teamWallets = [
                            ...teamWallets,
                            currentProject.teamWallets[i].address,
                        ];
                    }
                }
            }

            await axios.post(`${SERVER_URL}/api/v1/project/collect-all-sol`,
                {
                    projectId: currentProject._id,
                    targetWallet,
                    wallets,
                    teamWallets,
                    sigData,
                    signingData
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "MW-USER-ID": localStorage.getItem("access-token"),
                    },
                }
            );
        }
        catch (err) {
            console.log(err);
            toast.warn("Failed to collect all SOL!");
            setOpenLoading(false);
        }
    };

    const getSelectedTokenBalance = () => {
        try {
            let selectedBalance = 0;
            for (let i = 0; i < walletChecked.length; i++) {
                if (!walletChecked[i])
                    continue;

                selectedBalance += Number(walletTokenBalance[i]);
            }
            return selectedBalance.toFixed(4);
        }
        catch (err) {
            console.log(err);
        }
        return 0;
    };

    const getSelectedTokenAmount = () => {
        try {
            let selectedBalance = 0;
            for (let i = 0; i < walletChecked.length; i++) {
                if (!walletChecked[i])
                    continue;

                selectedBalance += Number(walletTokenAmount[i]);
            }
            if (currentProject.paymentId == 2 || currentProject.paymentId == 1) {
                if (selectedBalance > MAX_AMOUNT_ON_CURVE / 2)
                    selectedBalance += 10000000;
            }
            return selectedBalance.toFixed(4);
        }
        catch (err) {
            console.log(err);
        }
        return 0;
    };

    const getRemainingTokenAmountOnCurve = () => {
        try {
            let selectedAmount = 0;
            for (let i = 0; i < walletChecked.length; i++) {
                if (!walletChecked[i])
                    continue;

                selectedAmount += Number(walletTokenAmount[i]);
            }

            // if (currentProject.teamWallets && currentProject.teamWallets.length > 0) {
            //     if (selectedAmount > MAX_AMOUNT_ON_CURVE / 2)
            //         selectedAmount += 10000000;
            // }
            if (currentProject.paymentId == 2 || currentProject.paymentId == 1) {
                if (selectedAmount > MAX_AMOUNT_ON_CURVE / 2)
                    selectedAmount += 10000000;
            }
            return (MAX_AMOUNT_ON_CURVE - selectedAmount).toFixed(0);
        }
        catch (err) {
            console.log(err);
        }
        return 0;
    };

    const getTokenAmountPerWallet = () => {
        try {
            const selectedCnt = walletChecked.filter(wal => wal).length;
            return selectedCnt == 0 ? 0 : (MAX_AMOUNT_ON_CURVE / selectedCnt).toFixed(0);
        }
        catch (err) {
            console.log(err);
        }
        return 0;
    };

    const getSelectedSolBalance = () => {
        try {
            let selectedBalance = 0;
            for (let i = 0; i < walletChecked.length; i++) {
                if (!walletChecked[i])
                    continue;

                selectedBalance += Number(walletSolBalance[i]);
            }
            return selectedBalance.toFixed(4);
        }
        catch (err) {
            console.log(err);
        }
        return 0;
    };

    const handleSaveProject = async () => {
        setLoadingPrompt("Saving project...");
        setOpenLoading(true);
        try {
            const wallets = currentProject.wallets.map((item, index) => {
                return {
                    address: item.address,
                    initialTokenAmount: walletTokenAmount[index],
                    initialSolAmount: walletSolAmount[index],
                };
            });
            const { data } = await axios.post(`${SERVER_URL}/api/v1/project/save`,
                {
                    projectId: currentProject._id,
                    token: token,
                    zombie: zombieWallet,
                    wallets: wallets,
                    platform: 'pump.fun',
                    signingData,
                    sigData
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "MW-USER-ID": localStorage.getItem("access-token"),
                    },
                }
            );

            updateProject(data.project);
            if (currentProject._id === data.project._id)
                setCurrentProject(data.project);
            toast.success("Project has been saved successfully");
        }
        catch (err) {
            console.log(err);
            toast.warn("Failed to save project!");
        }
        setOpenLoading(false);
    };

    const handleOKZombiePrivateKey = (key) => {
        try {
            const keypair = Keypair.fromSecretKey(bs58.decode(key));
            setZombieWallet({ address: keypair.publicKey.toBase58(), privateKey: key });
        }
        catch (err) {
            console.log(err);
            toast.warn("Invalid private key!");
        }

        setZombieDialog(false);
    };

    const handleOKNewWallets = async (walletCount, fresh) => {
        console.log("New wallets:", walletCount, fresh);
        let count = 0;
        try {
            count = parseInt(walletCount);
        }
        catch (err) {
            console.log(err);
        }

        if (isNaN(count) || count < 0) {
            toast.warn("Invalid wallet count");
            return;
        }

        setNewWalletDialog(false);
        setLoadingPrompt("Generating new wallets...");
        setOpenLoading(true);
        try {
            const { data } = await axios.post(`${SERVER_URL}/api/v1/project/generate-wallets`,
                {
                    projectId: currentProject._id,
                    count: walletCount,
                    fresh: fresh,
                    signingData,
                    sigData
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "MW-USER-ID": localStorage.getItem("access-token"),
                    },
                }
            );
            const newCurrentProject = {
                ...currentProject,
                wallets: data.project.wallets,
            };
            updateProject(newCurrentProject);
            setCurrentProject(newCurrentProject);
            toast.success("New wallets has been generated successfully");
        }
        catch (err) {
            console.log(err);
            toast.warn("Failed to generate new wallets!");
        }
        setOpenLoading(false);
    };

    const handleDownloadWallets = async () => {
        if (!currentProject.token) {
            toast.warn("Select the project");
            return;
        }

        setLoadingPrompt("Downloading wallets...");
        setOpenLoading(true);
        try {
            const { data } = await axios.post(`${SERVER_URL}/api/v1/project/download-wallets`,
                {
                    projectId: currentProject._id,
                    sigData,
                    signingData
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "MW-USER-ID": localStorage.getItem("access-token"),
                    },
                }
            );

            const downloadFile = (data, fileName) => {
                const url = window.URL.createObjectURL(new Blob([data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute(
                    'download',
                    fileName,
                );

                // Append to html link element page
                document.body.appendChild(link);

                // Start download
                link.click();

                // Clean up and remove the link
                link.parentNode.removeChild(link);
            };

            downloadFile(data, `wallets_${currentProject.name}.csv`);
        }
        catch (err) {
            console.log(err);
            toast.warn("Failed to download wallets!");
        }
        setOpenLoading(false);
    };

    const handleDownloadSimulateData = async () => {
        if (Object.keys(simulateData).length > 0) {
            let new_data = { ...simulateData };

            let csvContent = "address,initialSolAmount,initialTokenAmount,sim.buy.solAmount,sim.buy.tokenAmount,sim.disperseAmount,sim.xfer.fromAddress,sim.xfer.tokenAmount\n";
            for (let i = 0; i < new_data.wallets.length; i++) {
                let wallet = new_data.wallets[i];
                csvContent += wallet?.address + ',' + wallet?.initialSolAmount + ',' + wallet?.initialTokenAmount + ',' + wallet?.sim?.buy?.solAmount + ',' + wallet?.sim?.buy?.tokenAmount + ',' + wallet?.sim?.disperseAmount + ',' + wallet?.sim?.xfer?.fromAddress + ',' + wallet?.sim?.xfer?.tokenAmount + '\n';
            }

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = "simulate_result.csv";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    const handleOKMinMaxTokenAmounts = (minAmount, maxAmount) => {
        function getRandomNumber(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        try {
            let minX = -1;
            let maxX = -1;
            if (minAmount.charAt(minAmount.length - 1) === '%') {
                minX = Number(minAmount.slice(0, minAmount.length - 1));
                minX = MAX_AMOUNT_ON_CURVE * minX / 100;
            }
            else
                minX = Number(minAmount.replace(/,/g, ''));

            if (isNaN(minX) || minX <= 0) {
                toast.warn("Invalid minimum amount");
                return;
            }

            if (maxAmount.charAt(maxAmount.length - 1) === '%') {
                maxX = Number(maxAmount.slice(0, maxAmount.length - 1));
                maxX = MAX_AMOUNT_ON_CURVE * maxX / 100;
            }
            else
                maxX = Number(maxAmount.replace(/,/g, ''));

            if (isNaN(maxX) || maxX <= 0) {
                toast.warn("Invalid maximum amount");
                return;
            }

            if (minX > maxX) {
                const t = minX;
                minX = maxX;
                maxX = t;
            }

            console.log("Min:", minX, "Max:", maxX);

            let newWalletTokenAmount = [...walletTokenAmount];
            let _MAX_AMOUNT_ON_CURVE = MAX_AMOUNT_ON_CURVE; // minX == maxX ? MAX_AMOUNT_ON_CURVE : MAX_AMOUNT_ON_CURVE * 0.98;
            let totalTokenAmount = 0;
            // if (currentProject.teamWallets && currentProject.teamWallets.length > 0) {
            //     totalTokenAmount += 20000000;
            // }
            if (currentProject.paymentId == 1 || currentProject.paymentId == 2) {
                totalTokenAmount += 10000000;
            }
            for (let i = 0; i < newWalletTokenAmount.length; i++) {
                if (walletChecked[i]) {

                    // check token amount overflow
                    let tokenAmount = getRandomNumber(minX, maxX);
                    let remainedTokenAmount = _MAX_AMOUNT_ON_CURVE - totalTokenAmount;
                    remainedTokenAmount = remainedTokenAmount < 0 ? 0 : remainedTokenAmount;

                    tokenAmount = remainedTokenAmount < tokenAmount ? remainedTokenAmount : tokenAmount;

                    newWalletTokenAmount[i] = tokenAmount;
                    totalTokenAmount += tokenAmount;
                }
            }
            setWalletTokenAmount(newWalletTokenAmount);
        }
        catch (err) {
            console.log(err);
            toast.warn("Invalid minimum/maximum amount");
        }

        setTokenAmountDialog(false);
    };

    const handleSetTokenAmounts = () => {
        const selectedWallets = walletChecked.filter((item) => item === true);
        if (selectedWallets.length === 0) {
            toast.warn("Please select wallets to set token amount");
            return;
        }
        setTokenAmountDialog(true);
    };

    const handleOKSolAmount = (solAmount) => {
        let amount = -1;
        try {
            amount = Number(solAmount);
        }
        catch (err) {
            console.log(err);
        }

        if (isNaN(amount) || amount < 0) {
            toast.warn("Invalid SOL amount");
            return;
        }

        let newWalletSolAmount = [...walletSolAmount];
        for (let i = 0; i < newWalletSolAmount.length; i++) {
            if (walletChecked[i])
                newWalletSolAmount[i] = amount;
        }
        setWalletSolAmount(newWalletSolAmount);
        setSolAmountDialog(false);
    };

    const handleSetSOLAmounts = () => {
        const selectedWallets = walletChecked.filter((item) => item === true);
        if (selectedWallets.length === 0) {
            toast.warn("Please select wallets to set additional SOL amount");
            return;
        }
        setSolAmountDialog(true);
    };

    const handleWalletAllChecked = (e) => {
        console.log("Wallet all checked:", e.target.value, walletAllChecked);
        const newWalletAllChecked = !walletAllChecked;
        setWalletAllChecked(newWalletAllChecked);
        setWalletChecked(walletChecked.map(() => newWalletAllChecked));
    };

    const handleWalletChanged = (index, key, value) => {
        console.log("Wallet changed:", index, key, value);
        if (key === "checked") {
            let newWalletChecked = [...walletChecked];
            newWalletChecked[index] = !newWalletChecked[index];
            setWalletChecked(newWalletChecked);

            let newWalletAllChecked = true;
            for (let i = 0; i < newWalletChecked.length; i++)
                newWalletAllChecked &&= newWalletChecked[i];
            setWalletAllChecked(newWalletAllChecked);
        }
        else if (key === "token_amount") {
            let newWalletTokenAmount = [...walletTokenAmount];
            newWalletTokenAmount[index] = value;
            setWalletTokenAmount(newWalletTokenAmount);
        }
        else if (key === "sol_amount") {
            let newWalletSOLAmount = [...walletSolAmount];
            newWalletSOLAmount[index] = value;
            setWalletSolAmount(newWalletSOLAmount);
        }
    };

    const handleTeamWalletAllChecked = (e) => {
        const newTeamWalletAllChecked = !teamWalletAllChecked;
        setTeamWalletAllChecked(newTeamWalletAllChecked);
        setTeamWalletChecked(teamWalletChecked.map(() => newTeamWalletAllChecked));
    };

    const handleTeamWalletChanged = (index, key, value) => {
        if (key === "checked") {
            let newTeamWalletChecked = [...teamWalletChecked];
            newTeamWalletChecked[index] = !newTeamWalletChecked[index];
            setTeamWalletChecked(newTeamWalletChecked);

            let newTeamWalletAllChecked = true;
            for (let i = 0; i < newTeamWalletChecked.length; i++)
                newTeamWalletAllChecked &&= newTeamWalletChecked[i];
            setTeamWalletAllChecked(newTeamWalletAllChecked);
        }
    };

    const handleDoneSimulate = () => {
        setSimulationDialog(false);
        if (simulateData.projectId === currentProject._id) {
            let newCurrentProject = { ...currentProject };
            newCurrentProject.token = simulateData.token;
            newCurrentProject.zombie = simulateData.zombie.address;
            for (let i = 0; i < simulateData.wallets.length; i++) {
                for (let j = 0; j < newCurrentProject.wallets.length; j++) {
                    if (simulateData.wallets[i].address === newCurrentProject.wallets[j].address) {
                        newCurrentProject.wallets[j].initialTokenAmount = simulateData.wallets[i].initialTokenAmount;
                        newCurrentProject.wallets[j].initialSolAmount = simulateData.wallets[i].initialSolAmount;
                        newCurrentProject.wallets[j].sim = simulateData.wallets[i].sim;
                        break;
                    }
                }
            }
            updateProject(newCurrentProject);
            if (currentProject._id === newCurrentProject._id)
                setCurrentProject(newCurrentProject);
        }
    };

    const handleSimulate = async () => {
        console.log("ghost")
        setSimulationDialog(false);
        if (!currentProject.token)
            return;

        // if (!connected) {
        //     toast.warn("Please connect wallet!");
        //     return;
        // }

        if (!isValidAddress(token)) {
            toast.warn("Invalid token address!");
            return;
        }

        if (!isValidAddress(zombieWallet.address)) {
            toast.warn("Invalid zombie wallet!");
            return;
        }

        // if (tokenAmount === "" || Number(tokenAmount.replaceAll(",", "")) <= 0) {
        //     toast.warn("Invalid token amount!");
        //     return;
        // }

        // if (solAmount === "" || Number(solAmount) <= 0) {
        //     toast.warn("Invalid SOL amount!");
        //     return;
        // }

        const validWalletChecked = walletChecked.filter(item => item === true);
        if (validWalletChecked.length === 0) {
            toast.warn("Please check wallets to buy tokens");
            return;
        }

        let wallets = [];
        let totalTokenAmount = 0;
        // if (currentProject.teamWallets && currentProject.teamWallets.length > 0) {
        //     totalTokenAmount += 20000000
        // }
        if (currentProject.paymentId == 2) {
            totalTokenAmount += 10000000
        }
        for (let i = 0; i < currentProject.wallets.length; i++) {
            if (!walletChecked[i])
                continue;

            if (!walletTokenAmount[i]) {
                toast.warn(`Wallet #${i + 1}: Invalid token amount`);
                return;
            }

            const initialTokenAmount = Number(walletTokenAmount[i].toString().replaceAll(",", ""));
            if (isNaN(initialTokenAmount) || initialTokenAmount <= 0) {
                toast.warn(`Wallet #${i + 1}: Invalid token amount`);
                return;
            }

            totalTokenAmount += initialTokenAmount;

            if (walletSolAmount[i] == null || walletSolAmount[i] == undefined) {
                toast.warn(`Wallet #${i + 1}: Invalid additional SOL amount`);
                return;
            }

            const initialSolAmount = Number(walletSolAmount[i].toString().replaceAll(",", ""));
            if (isNaN(initialSolAmount) || initialSolAmount < 0) {
                toast.warn(`Wallet #${i + 1}: Invalid additional SOL amount`);
                return;
            }

            wallets = [
                ...wallets,
                {
                    address: currentProject.wallets[i].address,
                    initialTokenAmount: initialTokenAmount,
                    initialSolAmount: initialSolAmount,
                }
            ];
        }

        if (totalTokenAmount > MAX_AMOUNT_ON_CURVE) {
            toast.warn(`Total token amount is too much!`);
            return;
        }

        try {
            setLoadingPrompt("Simulating...");
            setOpenLoading(true);
            await axios.post(`${SERVER_URL}/api/v1/project/pumpfun-simulate`,
                {
                    projectId: currentProject._id,
                    token,
                    tokenAmount,
                    solAmount,
                    zombie: zombieWallet,
                    wallets,
                    signingData,
                    sigData
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "MW-USER-ID": localStorage.getItem("access-token"),
                    },
                }
            );
        }
        catch (err) {
            console.log(err);
            toast.warn("Failed to simulate!");
            setOpenLoading(false);
        }
    };

    const handleDisperseSOL = async () => {
        if (!currentProject.token)
            return;

        if (!connected) {
            toast.warn("Please connect wallet!");
            return;
        }

        if (!isValidAddress(token)) {
            toast.warn("Invalid token address!");
            return;
        }

        if (!isValidAddress(zombieWallet.address)) {
            toast.warn("Invalid zombie wallet!");
            return;
        }

        // if (tokenAmount === "" || Number(tokenAmount.replaceAll(",", "")) <= 0) {
        //     toast.warn("Invalid token amount!");
        //     return;
        // }

        // if (solAmount === "" || Number(solAmount) <= 0) {
        //     toast.warn("Invalid SOL amount!");
        //     return;
        // }

        const validWalletChecked = walletChecked.filter(item => item === true);
        if (validWalletChecked.length === 0) {
            toast.warn("Please check wallets to buy tokens");
            return;
        }

        if (!simulateData.zombie) {
            toast.warn("Please simulate first");
            return;
        }

        let wallets = [];
        for (let i = 0; i < currentProject.wallets.length; i++) {
            if (!walletChecked[i])
                continue;

            const initialTokenAmount = Number(walletTokenAmount[i].toString().replaceAll(",", ""));
            if (isNaN(initialTokenAmount) || initialTokenAmount <= 0) {
                toast.warn(`Wallet #${i + 1}: Invalid token amount`);
                return;
            }

            const initialSolAmount = Number(walletSolAmount[i].toString().replaceAll(",", ""));
            if (isNaN(initialSolAmount) || initialSolAmount < 0) {
                toast.warn(`Wallet #${i + 1}: Invalid additional SOL amount`);
                return;
            }

            wallets = [
                ...wallets,
                {
                    address: currentProject.wallets[i].address,
                    initialTokenAmount: initialTokenAmount,
                    initialSolAmount: initialSolAmount,
                }
            ];
        }

        let simulated = true;
        if (simulateData.projectId !== currentProject._id) {
            simulated = false;
            console.log("Project id mismatch!");
        }

        if (simulated &&
            (!simulateData.zombie ||
                simulateData.zombie.address.toUpperCase() !== zombieWallet.address.toUpperCase())) {
            simulated = false;
            console.log("Zombie wallet mismatch!");
        }

        if (simulated && simulateData.wallets) {
            for (let i = 0; i < simulateData.wallets.length; i++) {
                let matched = false;
                const solAmount0 = simulateData.wallets[i].initialSolAmount.toString() === "" ? "0" : simulateData.wallets[i].initialSolAmount.toString();
                for (let j = 0; j < walletTokenAmount.length; j++) {
                    if (simulateData.wallets[i].address.toUpperCase() === currentProject.wallets[j].address.toUpperCase()) {
                        matched = true;
                        const solAmount1 = walletSolAmount[j].toString() === "" ? "0" : walletSolAmount[j].toString();
                        if (!walletChecked[j] ||
                            simulateData.wallets[i].initialTokenAmount.toString() !== walletTokenAmount[j].toString() ||
                            solAmount0 !== solAmount1) {
                            simulated = false;
                            console.log("Token amount or SOL amount mismatch!",
                                simulateData.wallets.length, walletSolAmount.length,
                                simulateData.wallets[i].initialSolAmount, walletSolAmount[j],
                                simulateData.wallets[i].initialTokenAmount, walletTokenAmount[j]);
                        }
                        break;
                    }
                }
                if (!matched) {
                    simulated = false;
                    console.log("No matched!");
                }
                if (!simulated)
                    break;
            }
        }
        else
            simulated = false;

        if (!simulated) {
            toast.warn("Please simulate first");
            return;
        }

        if (simulateData.zombie.value !== "0") {
            toast.warn("Please send enough SOL to zombie wallet and simulate again");
            return;
        }

        try {
            setLoadingPrompt("Dispersing SOL...");
            setOpenLoading(true);

            await axios.post(`${SERVER_URL}/api/v1/project/pumpfun-disperse`,
                {
                    projectId: currentProject._id,
                    simulateData,
                    signingData,
                    sigData
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "MW-USER-ID": localStorage.getItem("access-token"),
                    },
                }
            );
        }
        catch (err) {
            console.log(err);
            toast.warn("Failed to simulate!");
            setOpenLoading(false);
        }
    };

    const handleBuyTokens = async () => {
        setSimulationDialog(false);

        console.log("Buy", snipeMode);

        if (!currentProject.token)
            return;

        // if (!connected) {
        //     toast.warn("Please connect wallet!");
        //     return;
        // }

        if (!isValidAddress(token)) {
            toast.warn("Invalid token address!");
            return;
        }

        if (!isValidAddress(zombieWallet.address)) {
            toast.warn("Invalid zombie wallet!");
            return;
        }

        const validWalletChecked = walletChecked.filter(item => item === true);
        if (validWalletChecked.length === 0) {
            toast.warn("Please check wallets to buy tokens");
            return;
        }

        if (!simulateData.zombie) {
            toast.warn("Please simulate first");
            return;
        }

        if (simulateData.zombie.value !== "0") {
            toast.warn("Please send enough SOL to zombie wallet and simulate again");
            return;
        }

        console.log("SimulateData:", simulateData);

        let simulated = true;
        if (simulateData.projectId !== currentProject._id) {
            simulated = false;
            console.log("Project id mismatch!");
        }

        if (simulated && (!simulateData.token || simulateData.token.address.toUpperCase() !== token.toUpperCase())) {
            simulated = false;
            console.log("Token address mismatch!");
        }

        if (simulated &&
            (!simulateData.zombie ||
                simulateData.zombie.address.toUpperCase() !== zombieWallet.address.toUpperCase())) {
            simulated = false;
            console.log("Zombie wallet mismatch!");
        }

        if (simulated && simulateData.wallets) {
            for (let i = 0; i < simulateData.wallets.length; i++) {
                let matched = false;
                const solAmount0 = simulateData.wallets[i].initialSolAmount.toString() === "" ? "0" : simulateData.wallets[i].initialSolAmount.toString();
                for (let j = 0; j < walletTokenAmount.length; j++) {
                    if (simulateData.wallets[i].address.toUpperCase() === currentProject.wallets[j].address.toUpperCase()) {
                        matched = true;
                        const solAmount1 = walletSolAmount[j].toString() === "" ? "0" : walletSolAmount[j].toString();
                        if (!walletChecked[j] ||
                            simulateData.wallets[i].initialTokenAmount.toString() !== walletTokenAmount[j].toString() ||
                            solAmount0 !== solAmount1) {
                            simulated = false;
                            console.log("Token amount or SOL amount mismatch!");
                        }
                        break;
                    }
                }
                if (!matched) {
                    simulated = false;
                    console.log("No matched!");
                }
                if (!simulated)
                    break;
            }
        }
        else
            simulated = false;

        if (!simulated) {
            toast.warn("Please simulate first");
            return;
        }

        try {
            setOpenLoading(true);

            // const transactions = await createPool(connection,
            //     token,
            //     tokenAmount.replaceAll(",", ""),
            //     "So11111111111111111111111111111111111111112",
            //     solAmount.toString(),
            //     simulateData.poolInfo.marketId,
            //     publicKey);
            // const signedTxns = await signAllTransactions(transactions);
            // const txnsBase64 = signedTxns.map(item => Buffer.from(item.serialize()).toString("base64"));

            setLoadingPrompt("Enabling and Buying Tokens...");
            await axios.post(`${SERVER_URL}/api/v1/project/pumpfun-mint-snipe`,
                {
                    projectId: currentProject._id,
                    // signedTransactions: txnsBase64,
                    simulateData,
                    signingData,
                    sigData
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "MW-USER-ID": localStorage.getItem("access-token"),
                    },
                }
            );
        }
        catch (err) {
            console.log(err);
            toast.warn("Failed to enable and buy!");
            setOpenLoading(false);
        }
    };

    const handleMintBuyToken = async () => {
        setSimulationDialog(false);

        console.log("Mint buy", snipeMode);

        if (!currentProject.token)
            return;

        // if (!connected) {
        //     toast.warn("Please connect wallet!");
        //     return;
        // }

        if (!isValidAddress(token)) {
            toast.warn("Invalid token address!");
            return;
        }

        if (!isValidAddress(zombieWallet.address)) {
            toast.warn("Invalid zombie wallet!");
            return;
        }

        const validWalletChecked = walletChecked.filter(item => item === true);
        if (validWalletChecked.length === 0) {
            toast.warn("Please check wallets to buy tokens");
            return;
        }

        if (!simulateData.zombie) {
            toast.warn("Please simulate first");
            return;
        }

        if (simulateData.zombie.value !== "0") {
            toast.warn("Please send enough SOL to zombie wallet and simulate again");
            return;
        }

        console.log("SimulateData:", simulateData);

        let simulated = true;
        if (simulateData.projectId !== currentProject._id) {
            simulated = false;
            console.log("Project id mismatch!");
        }

        if (simulated && (!simulateData.token || simulateData.token.address.toUpperCase() !== token.toUpperCase())) {
            simulated = false;
            console.log("Token address mismatch!");
        }

        if (simulated &&
            (!simulateData.zombie ||
                simulateData.zombie.address.toUpperCase() !== zombieWallet.address.toUpperCase())) {
            simulated = false;
            console.log("Zombie wallet mismatch!");
        }

        if (simulated && simulateData.wallets) {
            for (let i = 0; i < simulateData.wallets.length; i++) {
                let matched = false;
                const solAmount0 = simulateData.wallets[i].initialSolAmount.toString() === "" ? "0" : simulateData.wallets[i].initialSolAmount.toString();
                for (let j = 0; j < walletTokenAmount.length; j++) {
                    if (simulateData.wallets[i].address.toUpperCase() === currentProject.wallets[j].address.toUpperCase()) {
                        matched = true;
                        const solAmount1 = walletSolAmount[j].toString() === "" ? "0" : walletSolAmount[j].toString();
                        if (!walletChecked[j] ||
                            simulateData.wallets[i].initialTokenAmount.toString() !== walletTokenAmount[j].toString() ||
                            solAmount0 !== solAmount1) {
                            simulated = false;
                            console.log("Token amount or SOL amount mismatch!");
                        }
                        break;
                    }
                }
                if (!matched) {
                    simulated = false;
                    console.log("No matched!");
                }
                if (!simulated)
                    break;
            }
        }
        else
            simulated = false;

        if (!simulated) {
            toast.warn("Please simulate first");
            return;
        }

        try {
            setOpenLoading(true);

            setLoadingPrompt("Enabling and Buying Tokens...");
            await axios.post(`${SERVER_URL}/api/v1/project/pumpfun-mint-buy`,
                {
                    projectId: currentProject._id,
                    // signedTransactions: txnsBase64,
                    simulateData,
                    signingData,
                    sigData
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "MW-USER-ID": localStorage.getItem("access-token"),
                    },
                }
            );
        }
        catch (err) {
            console.log(err);
            toast.warn("Failed to enable and buy!");
            setOpenLoading(false);
        }
    };

    const handleNextBundle = async () => {
        if (!currentProject.token)
            return;

        // if (!connected) {
        //     toast.warn("Please connect wallet!");
        //     return;
        // }

        if (!isValidAddress(token)) {
            toast.warn("Invalid token address!");
            return;
        }

        if (!isValidAddress(zombieWallet.address)) {
            toast.warn("Invalid zombie wallet!");
            return;
        }

        const validWalletChecked = walletChecked.filter(item => item === true);
        if (validWalletChecked.length === 0) {
            toast.warn("Please check wallets to buy tokens");
            return;
        }

        try {
            setOpenLoading(true);

            setLoadingPrompt("Enabling and Buying Tokens...");
            await axios.post(`${SERVER_URL}/api/v1/project/pumpfun-buy`,
                {
                    projectId: currentProject._id,
                    // signedTransactions: txnsBase64,
                    signingData,
                    sigData
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "MW-USER-ID": localStorage.getItem("access-token"),
                    },
                }
            );
        }
        catch (err) {
            console.log(err);
            toast.warn("Failed to enable and buy!");
            setOpenLoading(false);
        }
    }

    const handleTransferAll = async () => {
        setLoadingPrompt("Updating project wallet...");
        setOpenLoading(true);
        try {
            await axios.post(`${SERVER_URL}/api/v1/project/transfer-all`,
                {
                    projectId: currentProject._id,
                    signingData,
                    sigData
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "MW-USER-ID": localStorage.getItem("access-token"),
                    },
                }
            );
        } catch (err) {
            console.log(err);
            setOpenLoading(false);
        }
    }

    const handleDisperseTokens = async () => {
        if (!currentProject.token)
            return;

        setLoadingPrompt("Dispersing tokens...");
        setOpenLoading(true);
        try {
            await axios.post(`${SERVER_URL}/api/v1/project/disperse-tokens`,
                {
                    projectId: currentProject._id,
                    signingData,
                    sigData
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "MW-USER-ID": localStorage.getItem("access-token"),
                    },
                }
            );
        }
        catch (err) {
            console.log(err);
            toast.warn("Failed to disperse tokens!");
            setOpenLoading(false);
        }
    };

    const handleVisitDASHGitbook = () => {
        // window.open(
        //     `https://dash-developer-tools.gitbook.io/dash_developer_tools`,
        //     "_blank",
        //     "noopener,noreferrer"
        // );
    }

    const handleGetCurrentStatus = async (project) => {
        setOpenLoading(true);
        setLoadingPrompt("Loading...");
        if (isValidAddress(currentProject.token.address)) {
            let mintInfo = null;
            try {
                mintInfo = await getMint(connection, new PublicKey(currentProject.token.address));
            } catch (err) {
            }
            if (mintInfo) {
                console.log("alreadyMint", true);
                setAlreadyMint(true);
            } else {
                console.log("alreadyMint", false);
                setAlreadyMint(false);
            }
        }
        setOpenLoading(false);
    }

    return (
        <div className={`${className} flex flex-col text-white`}>
            <BundleProgressDialog params={{ solAmount, tokenAmount, zombieWallet, currentProject, walletChecked, walletTokenAmount, walletSolAmount, simulateData }} isOpen={showBundleProgressDialog} onClose={() => setShowBundleProgressDialog(false)} onChange={(percent, left) => { setProgressPercent(percent); setProgressLeft(left); }} />
            <ZombieDialog isOpen={zombieDialog} onOK={handleOKZombiePrivateKey} onCancel={() => setZombieDialog(false)} />
            <NewWalletDialog isOpen={newWalletDialog} onOK={handleOKNewWallets} onCancel={() => setNewWalletDialog(false)} />
            <TokenAmountDialog isOpen={tokenAmountDialog} onOK={handleOKMinMaxTokenAmounts} onCancel={() => setTokenAmountDialog(false)} />
            <SolAmountDialog isOpen={solAmountDialog} onOK={handleOKSolAmount} onCancel={() => setSolAmountDialog(false)} />
            <PumpfunSimulationDialog isOpen={simulationDialog} zombie={simulateZombie} tokenInfo={tokenInfo} tokenAmountInLP={tokenAmount} solAmountInLP={solAmount} buyTokenAmount={getSelectedTokenAmount()} onClose={handleDoneSimulate} handleDownloadSimuation={handleDownloadSimulateData} handleSimulateAgain={handleSimulate} handleDisperseSOL={handleDisperseSOL} handleBundle={snipeMode == 0 ? handleBuyTokens : handleMintBuyToken} simulateData={simulateData} alreadyMint={alreadyMint} />
            <div className="flex flex-col">
                <div className="flex items-start justify-between w-full h-auto">
                    <div className="flex items-center font-sans text-xs font-medium text-white">
                        <div className="font-bold uppercase text-xl">Bundling-</div>
                        {currentProject._id &&
                            <div className="text-gradient-blue-to-purple text-xl">{currentProject.name ? `${currentProject.name}` : "No project"}</div>
                        }
                        {currentProject?.token?.address &&
                            <>
                                <div className="mx-2 text-gray-normal opacity-30">/</div>
                                <div className="font-semibold text-gray-normal">{ellipsisAddress(currentProject?.token?.address)}</div>
                                {copied["token_address"] ?
                                    (<svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>) :
                                    <FaRegCopy className="w-3.5 h-3.5 ml-2 transition ease-in-out transform cursor-pointer active:scale-95 duration-90" onClick={() => copyToClipboard("token_address", currentProject?.token?.address)} />}
                            </>
                        }
                        {currentProject.status === 'TRADE' && (
                            <>
                                <a href={`https://solscan.io/token/${currentProject?.token?.address}`} target="_blank" rel="noreferrer">
                                    <img className="w-3.5 h-3.5 object-contain ml-2" src="/assets/solscan.png" alt="solscan" />
                                </a>
                                <a href={`https://pump.fun/${currentProject?.token?.address}`} target="_blank" rel="noreferrer">
                                    <img className="w-3.5 h-3.5 object-contain ml-2" src="/assets/pumpfun.webp" alt="pump.fun" />
                                </a>
                                <a href={`https://photon-sol.tinyastro.io/en/lp/${currentProject?.token?.address}`} target="_blank" rel="noreferrer">
                                    <img className="w-3.5 h-3.5 object-contain ml-2" src="/assets/photon.webp" alt="photon" />
                                </a>
                                <a href={`https://www.dextools.io/app/en/solana/pair-explorer/${currentProject?.token?.address}`} target="_blank" rel="noreferrer">
                                    <img className="w-3.5 h-3.5 object-contain ml-2" src="/assets/dextool.png" alt="dextools" />
                                </a>
                                <a href={`https://dexscreener.com/solana/${currentProject?.token?.address}`} target="_blank" rel="noreferrer">
                                    <img className="w-3.5 h-3.5 object-contain ml-2" src="/assets/dexscreener.png" alt="dexscreener" />
                                </a>
                            </>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            className={`text-xs font-medium text-center text-white px-6 py-2 rounded-lg justify-center items-center gap-2.5 bg-green-button active:scale-95 transition duration-100 ease-in-out transform focus:outline-none disabled:opacity-50 disabled:transform-none disabled:cursor-not-allowed`}
                            onClick={handleVisitDASHGitbook}>
                            Visit Gitbook
                        </button>
                        <button
                            className={`text-xs font-medium text-center text-white uppercase px-6 py-2 rounded-lg flex justify-center items-center gap-2.5 bg-green-button active:scale-95 transition duration-100 ease-in-out transform focus:outline-none disabled:opacity-50 disabled:transform-none disabled:cursor-not-allowed`}
                            onClick={handleReloadProject}>
                            <FaRedo className="w-4 h-4 m-auto" /> Reload
                        </button>
                        <button
                            className={`text-xs font-medium text-center text-white uppercase px-6 py-2 rounded-lg flex justify-center items-center gap-2.5 bg-green-button active:scale-95 transition duration-100 ease-in-out transform focus:outline-none disabled:opacity-50 disabled:transform-none disabled:cursor-not-allowed`}
                            disabled={disabled}
                            onClick={handleSaveProject}>
                            <FaSave className="w-4 h-4 m-auto" /> Save Project
                        </button>
                    </div>
                </div>
                <div className="w-full mt-[6px] grid grid-cols-12 gap-3">
                    <div className="col-span-12 md:col-span-6 2xl:col-span-3">
                        <div className="font-sans text-xs uppercase text-gray-normal">
                            Token Address<span className="pl-1 text-green-normal">*</span>
                        </div>
                        <input
                            className="outline-none border border-gray-border font-sans text-white placeholder:text-gray-border text-sm px-2.5 bg-transparent w-full h-button mt-1 rounded-lg"
                            placeholder="Enter Address"
                            disabled={disabled}
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                        />
                    </div>
                    <div className="col-span-12 md:col-span-6 2xl:col-span-3">
                        <Popover className="relative flex items-center font-sans text-xs uppercase text-gray-normal">
                            <div className="whitespace-nowrap">Zombie Wallet<span className="pl-1 text-green-normal">*</span></div>
                            <Popover.Button className="border border-green-normal text-[6px] flex items-center justify-center cursor-pointer rounded-full w-3 h-3 ml-1">
                                <FaQuestion className="text-green-normal" />
                            </Popover.Button>
                            <Popover.Panel className="absolute z-10 px-2 py-1 text-xs text-center text-white normal-case border rounded-sm bg-gray-highlight bottom-5 border-green-normal">
                                This wallet distributes SOL to all wallets.
                            </Popover.Panel>
                        </Popover>
                        <div className={`flex items-center justify-between outline-none border border-gray-border text-gray-normal font-sans text-sm pl-2.5 bg-transparent w-full h-button mt-1 pr-1 ${disabled && "text-gray-border border-gray-highlight"}`}>
                            <div className={`w-full pr-1 truncate ${zombieWallet.address && "text-white"}`}>
                                {
                                    zombieWallet.address ?
                                        ellipsisAddress(zombieWallet.address) :
                                        "NOT SET"
                                }
                            </div>
                            <div className="flex items-center text-base">
                                {zombieWallet.address && !copied["zombie_wallet_0"] &&
                                    <FaRegCopy className="w-4 cursor-pointer text-gray-normal hover:text-green-normal" onClick={() => copyToClipboard("zombie_wallet_0", zombieWallet.address)} />
                                }
                                {zombieWallet.address && copied["zombie_wallet_0"] &&
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                }
                                {!disabled && <FaEllipsisV className="w-4 ml-1 cursor-pointer text-gray-normal hover:text-green-normal" onClick={() => setZombieDialog(true)} />}
                            </div>
                        </div>
                    </div>
                    <div className="col-span-12 md:col-span-6 2xl:col-span-3">
                        <div className="font-sans text-xs uppercase text-gray-normal">
                            Token Amount in LP<span className="pl-1 text-green-normal">*</span>
                        </div>
                        <input
                            className="outline-none border border-gray-border font-sans text-white placeholder:text-gray-border text-sm px-2.5 bg-transparent w-full h-button mt-1 rounded-lg"
                            placeholder="Enter initial token amount"
                            disabled={true}
                            value={tokenAmount}
                        />
                    </div>
                    <div className="col-span-12 md:col-span-6 2xl:col-span-3">
                        <div className="font-sans text-xs uppercase text-gray-normal">
                            SOL Amount in LP<span className="pl-1 text-green-normal">*</span>
                        </div>
                        <input
                            className="outline-none border border-gray-border font-sans text-white placeholder:text-gray-border text-sm px-2.5 bg-transparent w-full h-button mt-1 rounded-lg"
                            placeholder="Enter initial SOL amount"
                            disabled={true}
                            value={solAmount}
                        />
                    </div>
                </div>
                <div className="flex justify-between flex-row-reverse w-full gap-2 mt-3 font-sans">
                    <div className="flex items-center gap-4 font-sans text-sm text-gray-normal">
                        {/* <div className="flex">
                            Avg Token Amount: <span className="text-white ml-2">{numberWithCommas(getTokenAmountPerWallet())}</span>
                            <span className="my-[5px] ml-1">
                            {
                            copied['token_amount_per_wallet'] ?
                                    (<svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>) :
                                    (<FaRegCopy className="w-3 h-3 transition ease-in-out transform cursor-pointer active:scale-95 duration-90" onClick={() => copyToClipboard('token_amount_per_wallet', getTokenAmountPerWallet())} />)
                            }
                            </span>                           
                        </div> */}
                        <div className="flex mr-4">
                            Remaining Token Amount on Curve: <span className={getRemainingTokenAmountOnCurve() >= 0 ? (getRemainingTokenAmountOnCurve() == 0 ? "text-white ml-2" : "text-green-normal ml-2") : "text-red-normal ml-2"}>{numberWithCommas(getRemainingTokenAmountOnCurve())}</span>
                            <span className="my-[5px] ml-1">
                                {
                                    copied['remaining_token_amount'] ?
                                        (<svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>) :
                                        (<FaRegCopy className="w-3 h-3 transition ease-in-out transform cursor-pointer active:scale-95 duration-90" onClick={() => copyToClipboard('remaining_token_amount', getRemainingTokenAmountOnCurve())} />)
                                }
                            </span>
                            <FaMars className="my-[3px] ml-1 w-4 h-4 transition ease-in-out transform cursor-pointer active:scale-95 duration-90" onClick={() => addRemainedTokensToDev(getRemainingTokenAmountOnCurve())} />
                            <FaRandom className="my-[5px] ml-1 w-3 h-3 transition ease-in-out transform cursor-pointer active:scale-95 duration-90" onClick={() => disperseRemainedTokens(getRemainingTokenAmountOnCurve())} />
                        </div>
                    </div>
                </div>
                <div className="flex flex-row justify-between w-full gap-2 mt-3 mb-3 font-sans">
                    <div className="flex items-center gap-3 font-sans text-sm text-gray-normal">
                        <div>
                            Selected: <span className="text-white">{walletChecked.filter(wal => wal).length}</span>
                        </div>
                        <div>
                            Sol balance: <span className="text-yellow-normal">{getSelectedSolBalance()}</span>
                        </div>
                        <div>
                            Token balance: <span className="text-white">{getSelectedTokenBalance()}</span>
                        </div>
                    </div>
                    <div className="flex flex-col justify-end gap-2 lg:items-center lg:flex-row">
                        <button
                            className="pl-3 pr-4 h-button rounded-[4px] justify-center items-center gap-1 inline-flex bg-[#1A1A37] active:scale-95 transition duration-90 ease-in-out transform focus:outline-none text-xs font-medium text-center text-white uppercase disabled:text-gray-border disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            disabled={disabled}
                            onClick={() => setNewWalletDialog(true)}
                        >
                            <IoIosAddCircle className="text-lg text-green-normal" />
                            Generate Wallets
                        </button>
                        <button
                            className="pl-3 pr-4 h-button rounded-[4px] justify-center items-center gap-1 inline-flex bg-[#1A1A37] active:scale-95 transition duration-90 ease-in-out transform focus:outline-none text-xs font-medium text-center text-white uppercase disabled:text-gray-border disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            onClick={handleDownloadWallets}
                        >
                            <IoIosDownload className="text-lg text-green-normal" />
                            Download Wallets
                        </button>
                        {Object.keys(simulateData).length > 0 && <button
                            className="pl-3 pr-4 h-button rounded-[4px] justify-center items-center gap-1 inline-flex bg-[#1A1A37] active:scale-95 transition duration-90 ease-in-out transform focus:outline-none text-xs font-medium text-center text-white uppercase disabled:text-gray-border disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            onClick={handleDownloadSimulateData}
                        >
                            <IoIosDownload className="text-lg text-green-normal" />
                            Download Simulate Data
                        </button>}
                        <button
                            className="pl-3 pr-4 h-button rounded-[4px] justify-center items-center gap-1 inline-flex bg-[#1A1A37] active:scale-95 transition duration-90 ease-in-out transform focus:outline-none text-xs font-medium text-center text-white uppercase disabled:text-gray-border disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            disabled={disabled}
                            onClick={handleSetTokenAmounts}
                        >
                            <FaDatabase className="text-sm text-green-normal" />
                            Set token amount
                        </button>
                        <button
                            className="pl-3 pr-4 h-button rounded-[4px] justify-center items-center gap-1 inline-flex bg-[#1A1A37] active:scale-95 transition duration-90 ease-in-out transform focus:outline-none text-xs font-medium text-center text-white uppercase disabled:text-gray-border disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            disabled={disabled}
                            onClick={handleSetSOLAmounts}
                        >
                            <img className="w-4 h-4 text-green-normal" src="/assets/sol.svg" alt="sol" />
                            Set SOL amount
                        </button>
                    </div>
                </div>
                <div className="w-full overflow-visible font-sans">
                    <div className="flex flex-col w-full h-full text-white bg-transparent bg-clip-border">
                        <div className="relative border border-gray-highlight rounded-lg">
                            {/* {
                                currentProject.teamWallets && currentProject.wallets &&
                                <div className="absolute -left-[23px] top-[8px] z-10 text-xxs text-center text-white font-bold uppercase -rotate-90">User</div>
                            } */}
                            <div className={`h-[calc(100vh-500px)] xl:h-[calc(100vh-480px)] 2xl:h-[calc(100vh-395px)] overflow-y-auto`}>

                                {(!currentProject.wallets || currentProject.wallets.length === 0) &&
                                    <div className="absolute flex items-center justify-center gap-2 my-3 text-base font-bold text-center uppercase -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2 text-gray-border">
                                        <FaExclamationTriangle className="text-sm opacity-50 text-green-normal" /> No Wallet
                                    </div>
                                }
                                <table className="min-w-[700px] w-full text-xs">
                                    <thead className=" text-gray-normal">
                                        <tr className="uppercase h-7 bg-[#1A1A37] sticky top-0 z-10">
                                            <th className="w-8 text-center">
                                                <div className="flex items-center justify-center">
                                                    <input type="checkbox"
                                                        className="w-4 h-4 outline-none bg-gray-highlight opacity-20 accent-green-normal ring-0 rounded-lg"
                                                        checked={walletAllChecked}
                                                        onChange={handleWalletAllChecked} />
                                                </div>
                                            </th>
                                            <th className="w-8">
                                                <p className="leading-none text-center">
                                                    #
                                                </p>
                                            </th>
                                            <th className="">
                                                <p className="leading-none text-center">
                                                    Address
                                                </p>
                                            </th>
                                            <th className="">
                                                <p className="leading-none text-center">
                                                    Mirror Wallet
                                                </p>
                                            </th>
                                            <th className="">
                                                <p className="leading-none text-left">
                                                    SOL Balance
                                                </p>
                                            </th>
                                            <th className="">
                                                <p className="leading-none text-left">
                                                    Token Balance
                                                </p>
                                            </th>
                                            <th className="w-[15%]">
                                                <p className="leading-none text-center">
                                                    Tokens to buy
                                                </p>
                                            </th>
                                            <th className="w-[15%]">
                                                <p className="leading-none text-center">
                                                    Additional SOL
                                                </p>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-xs text-white" onMouseLeave={handleMouseUp}>
                                        {
                                            currentProject.wallets &&
                                            currentProject.wallets.map((item, index) => {
                                                return (
                                                    <tr key={index}
                                                        className={`${index % 2 === 1 && "bg-[#ffffff02]"} hover:bg-[#ffffff08] ${walletChecked[index] && "!bg-[#00000030]"} h-8`}
                                                    >
                                                        <td className="text-center"
                                                            onMouseDown={(e) => handleMouseDown(e, index)}
                                                            onMouseEnter={() => handleMouseEnter(index)}
                                                            onMouseUp={handleMouseUp}
                                                        >
                                                            <div className="flex items-center justify-center">
                                                                <input type="checkbox"
                                                                    className="w-4 h-4 outline-none bg-gray-highlight opacity-20 accent-green-normal ring-0 rounded-lg"
                                                                    checked={walletChecked[index]}
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="">
                                                            <p className="leading-none text-center text-gray-normal">
                                                                {index + 1}
                                                            </p>
                                                        </td>
                                                        <td className="">
                                                            <div className="flex items-center justify-center gap-1 font-sans antialiased font-normal leading-normal text-gray-normal">
                                                                <p className="bg-transparent border-none outline-none flex">
                                                                    {index === 0 && <span className="text-white mr-1">🤵‍♂️</span>}
                                                                    {(index > 0 && index <= 24) ?
                                                                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 20 20" className="text-white my-[2px] mr-1" fill="none">
                                                                            <g clipPath="url(#clip0_19732_87946)">
                                                                                <path d="M10.8333 0.833344L10.8341 3.38501C12.3026 3.57067 13.6676 4.23954 14.7142 5.28627C15.7608 6.33301 16.4295 7.69814 16.6149 9.16668H19.1666V10.8333L16.6149 10.8342C16.4293 12.3026 15.7606 13.6675 14.714 14.7141C13.6674 15.7606 12.3025 16.4294 10.8341 16.615L10.8333 19.1667H9.16659V16.615C7.69805 16.4296 6.33292 15.7609 5.28618 14.7143C4.23945 13.6677 3.57058 12.3027 3.38492 10.8342L0.833252 10.8333V9.16668H3.38492C3.57041 7.69802 4.2392 6.33279 5.28595 5.28604C6.3327 4.23929 7.69792 3.5705 9.16659 3.38501V0.833344H10.8333ZM9.99992 5.00001C8.67384 5.00001 7.40207 5.52679 6.46439 6.46448C5.5267 7.40216 4.99992 8.67393 4.99992 10C4.99992 11.3261 5.5267 12.5979 6.46439 13.5355C7.40207 14.4732 8.67384 15 9.99992 15C11.326 15 12.5978 14.4732 13.5355 13.5355C14.4731 12.5979 14.9999 11.3261 14.9999 10C14.9999 8.67393 14.4731 7.40216 13.5355 6.46448C12.5978 5.52679 11.326 5.00001 9.99992 5.00001ZM9.99992 8.33334C10.4419 8.33334 10.8659 8.50894 11.1784 8.8215C11.491 9.13406 11.6666 9.55798 11.6666 10C11.6666 10.442 11.491 10.866 11.1784 11.1785C10.8659 11.4911 10.4419 11.6667 9.99992 11.6667C9.55789 11.6667 9.13397 11.4911 8.82141 11.1785C8.50885 10.866 8.33325 10.442 8.33325 10C8.33325 9.55798 8.50885 9.13406 8.82141 8.8215C9.13397 8.50894 9.55789 8.33334 9.99992 8.33334Z" fill="currentColor" />
                                                                            </g>
                                                                            <defs>
                                                                                <clipPath id="clip0_19732_87946">
                                                                                    <rect width="20" height="20" fill="white" />
                                                                                </clipPath>
                                                                            </defs>
                                                                        </svg> : <></>
                                                                    }
                                                                    {ellipsisAddress(item.address, 12)}
                                                                </p>
                                                                {
                                                                    copied["wallet_" + index] ?
                                                                        (<svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                                        </svg>) :
                                                                        (<FaRegCopy className="w-3 h-3 transition ease-in-out transform cursor-pointer active:scale-95 duration-90" onClick={() => copyToClipboard("wallet_" + index, item.address)} />)
                                                                }
                                                            </div>
                                                        </td>
                                                        <td className="">
                                                            {currentProject.mirrorWallets && currentProject.mirrorWallets[index] && currentProject.mirrorWallets[index].address &&
                                                                <div className="flex items-center justify-center gap-1 font-sans antialiased font-normal leading-normal text-gray-normal">
                                                                    <p className="bg-transparent border-none outline-none flex text-gray-dark">
                                                                        {ellipsisAddress(currentProject.mirrorWallets[index].address, 12)}
                                                                    </p>
                                                                    {
                                                                        copied["mirror_wallet_" + index] ?
                                                                            (<svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                                            </svg>) :
                                                                            (<FaRegCopy className="w-3 h-3 transition ease-in-out transform cursor-pointer active:scale-95 duration-90" onClick={() => copyToClipboard("mirror_wallet_" + index, currentProject.mirrorWallets[index].address)} />)
                                                                    }
                                                                </div>
                                                            }
                                                        </td>
                                                        <td className="">
                                                            <p className="flex items-center justify-start text-yellow-normal">
                                                                <img className="w-3 mr-1" src="/assets/solsemi.svg" alt="sol" />
                                                                {walletSolBalance[index]}
                                                            </p>
                                                        </td>
                                                        <td className="">
                                                            <p className="flex items-center justify-start text-white">
                                                                <FaDatabase className="mr-1 opacity-50 text-xxs text-gray-normal" />
                                                                <span>
                                                                    {
                                                                        walletTokenBalance[index] ?
                                                                            Number(walletTokenBalance[index]?.split(".")[0] ?? "0").toLocaleString()
                                                                            : "0"
                                                                    }
                                                                </span>
                                                                <span className="font-normal text-gray-normal">.{
                                                                    walletTokenBalance[index] ?
                                                                        walletTokenBalance[index]?.split(".")[1]
                                                                        : "0000"
                                                                }
                                                                </span>
                                                            </p>
                                                        </td>
                                                        <td className="text-center">
                                                            <input
                                                                className="outline-none border border-gray-highlight font-medium text-gray-normal placeholder:text-gray-border text-xs px-2.5 bg-transparent text-center w-[150px] h-[26px] rounded-lg"
                                                                disabled={disabled}
                                                                value={walletTokenAmount[index]}
                                                                onChange={(e) => handleWalletChanged(index, "token_amount", e.target.value)} />
                                                        </td>
                                                        <td className="text-center">
                                                            <input
                                                                className="outline-none border border-gray-highlight font-medium text-gray-normal placeholder:text-gray-border text-xs px-2.5 bg-transparent text-center w-[100px] h-[26px] rounded-lg"
                                                                disabled={disabled}
                                                                value={walletSolAmount[index]}
                                                                onChange={(e) => handleWalletChanged(index, "sol_amount", e.target.value)} />
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        }
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="relative flex items-center justify-between h-full gap-3 mt-3 text-white bg-transparent bg-clip-border">
                    <div className="pl-2 flex items-center border border-gray-border rounded-lg">
                        <div className="font-sans text-xs uppercase text-gray-normal whitespace-nowrap">
                            Target Wallet:
                        </div>
                        <input
                            className="outline-none font-sans text-white placeholder:text-gray-border text-sm px-2.5 bg-transparent w-full h-button ml-2 grow min-w-[350px] max-w-[430px]"
                            placeholder="Input address here"
                            value={targetWallet}
                            onChange={(e) => setTargetWallet(e.target.value)}
                        />
                        <button
                            className="text-xs font-medium text-center text-nowrap text-white uppercase px-6 h-10 rounded-lg justify-center items-center gap-2.5 bg-green-button active:scale-95 transition duration-100 ease-in-out transform focus:outline-none disabled:opacity-50 disabled:transform-none disabled:cursor-not-allowed"
                            onClick={handleCollectAllSol}
                        >
                            Collect All SOL
                        </button>
                    </div>
                    <div className="text-xs text-gray-normal">
                        Bundle Token Amount: <span className="text-white">{getSelectedTokenAmount()}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            className="flex gap-2 text-xs text-center text-white px-6 h-10 rounded-lg justify-center items-center bg-transparent border border-solid border-white active:scale-95 transition duration-100 ease-in-out transform disabled:transform-none disabled:cursor-not-allowed"
                            onClick={() => setShowBundleProgressDialog(true)}
                        >
                            <img className="w-4 h-4" src="/assets/icon/ic_progress.svg" alt="progres" />
                            Click Here to View Progress:
                            <span className={progressLeft == 0 ? "text-green-dark" : "text-red-normal"}>{progressLeft} Steps Left</span>
                        </button>
                        <div class="relative size-10">
                            <svg class="size-full -rotate-90" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="18" cy="18" r="16" fill="none" class="stroke-current text-gray-highlight" stroke-width="2"></circle>
                                <circle cx="18" cy="18" r="16" fill="none" class="stroke-current text-green-light" stroke-width="2" stroke-dasharray="100" stroke-dashoffset={(100 - progressPercent).toFixed(0)} stroke-linecap="round"></circle>
                            </svg>
                            <div class="absolute top-1/2 start-1/2 transform -translate-y-1/2 -translate-x-1/2">
                                <span class="text-center text-xxs text-green-dark">{parseInt(progressPercent)}%</span>
                            </div>
                        </div>
                        <button
                            className="text-xs font-medium text-center text-white uppercase px-6 h-10 rounded-lg justify-center items-center gap-2.5 bg-green-button active:scale-95 transition duration-100 ease-in-out transform focus:outline-none disabled:opacity-50 disabled:transform-none disabled:cursor-not-allowed"
                            disabled={disabled || alreadyMint}
                            onClick={handleSimulate}>
                            Simulate
                        </button>
                        {
                            snipeMode == 1 &&
                            <button
                                className="text-xs font-medium text-center text-white uppercase px-6 h-10 rounded-lg justify-center items-center gap-2.5 bg-green-button active:scale-95 transition duration-100 ease-in-out transform focus:outline-none disabled:opacity-50 disabled:transform-none disabled:cursor-not-allowed"
                                disabled={disabled || !alreadyMint}
                                onClick={handleNextBundle}>
                                Bundle Buy
                            </button>
                        }
                        {
                            // currentProject.status !== "OPEN" &&
                            // <button
                            //     className="text-xs font-medium text-center text-white uppercase px-6 h-10 rounded-lg justify-center items-center gap-2.5 bg-green-button active:scale-95 transition duration-100 ease-in-out transform focus:outline-none disabled:opacity-50 disabled:transform-none disabled:cursor-not-allowed"
                            //     disabled={disabled}
                            //     onClick={handleTransferAll}>
                            //     Transfer All
                            // </button>
                        }
                        {/* <button
                            className="text-xs font-medium text-center text-white uppercase px-6 h-10 rounded-lg justify-center items-center gap-2.5 bg-green-button active:scale-95 transition duration-100 ease-in-out transform focus:outline-none disabled:opacity-50 disabled:transform-none disabled:cursor-not-allowed"
                            disabled={disabled}
                            onClick={handleDisperseSOL}>
                            Disperse SOL
                        </button>
                        <button
                            className="text-xs font-medium text-center text-white uppercase px-6 h-10 rounded-lg justify-center items-center gap-2.5 bg-green-button active:scale-95 transition duration-100 ease-in-out transform focus:outline-none disabled:opacity-50 disabled:transform-none disabled:cursor-not-allowed"
                            disabled={disabled}
                            onClick={handleBuyTokens}>
                            Mint & Buy
                        </button> */}
                        {/* <button
                            className="text-xs font-medium text-center text-white uppercase px-6 h-10 rounded-lg justify-center items-center gap-2.5 bg-green-button active:scale-95 transition duration-100 ease-in-out transform focus:outline-none disabled:opacity-50 disabled:transform-none disabled:cursor-not-allowed"
                            onClick={handleDisperseTokens}>
                            Disperse Tokens
                        </button> */}
                    </div>
                </div>
            </div>
        </div>
    );
}
