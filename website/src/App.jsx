/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
import { createContext, useCallback, useEffect, useState } from 'react'
import './App.css'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
// import { useWalletMultiButton } from "@solana/wallet-adapter-base-ui";
import axios from 'axios';
import { toast } from 'react-toastify';
import io from 'socket.io-client';
import { Metadata, PROGRAM_ID } from '@metaplex-foundation/mpl-token-metadata';
import { PublicKey } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress, getMint, NATIVE_MINT } from '@solana/spl-token';
import Promise from 'bluebird';
import BigNumber from 'bignumber.js';
import { Buffer } from 'buffer';

import * as ENV from "./config/env"

import MenuBar from './components/MenuBar/MenuBar';

import Dashboard from './pages/Dashboard';
import MyAccountPage from './pages/MyAccountPage';
import TokenManagementPage from './pages/TokenManagementPage';
import LpManagementPage from './pages/LpManagementPage';
import CreateAndSetTokenPage from './pages/CreateAndSetTokenPage';
import MarketAndLpPage from './pages/MarketAndLpPage';
import TokenAccountPage from './pages/TokenAccountPage';
import McCalculator from './pages/McCalculator';

import { isValidAddress } from './utils/methods';
import HomePage from './pages/HomePage';
import BundlePage from './pages/BundlePage';
import Faq from './pages/Faq';
import LoadingDialog from './components/Dialogs/LoadingDialog';
import { getPoolInfo, isOnRaydium } from './utils/solana';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminProjectsPage from './pages/AdminProjectsPage';
import AdminExtraWalletsPage from './pages/AdminExtraWalletsPage';
import AdminEmailsPage from './pages/AdminEmailsPage';
import AdminFinancePage from './pages/AdminFinancePage';
import AdminZombieWalletPage from './pages/AdminZombieWalletPage';
import PumpfunLaunchPage from './pages/PumpfunLaunchPage';
import PumpfunGhostLaunchPage from './pages/PumpfunGhostLaunchPage';
import { getSdk, initSdk } from './utils/raydiumSdk';
import { LAUNCHPAD_PROGRAM } from '@raydium-io/raydium-sdk-v2';

const RPC_CONCURRENCY = parseInt(import.meta.env.VITE_APP_RPC_CONCURRENCY);
export const AppContext = createContext(null);

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { connection } = useConnection();
  const { connected, publicKey, signMessage } = useWallet();
  // const [walletModalConfig, setWalletModalConfig] = useState(null);
  // const { buttonState } = useWalletMultiButton({ onSelectWallet: setWalletModalConfig });
  const [loadingPrompt, setLoadingPrompt] = useState("");
  const [openLoading, setOpenLoading] = useState(false);

  const userInfo = localStorage.getItem("user-info")
  const [user, setUser] = useState(userInfo ? JSON.parse(userInfo) : null);

  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState({});
  const [webSocket, setWebSocket] = useState(null);
  const [disperseContract, setDisperseContract] = useState({});
  const [emails, setEmails] = useState([]);
  const [walletBalanceData, setWalletBalanceData] = useState({ address: "", token: [], sol: [], wsol: [] });
  const [teamWalletBalanceData, setTeamWalletBalanceData] = useState({ address: "", token: [], sol: [] });
  const [additionalWalletBalanceData, setAdditionalWalletBalanceData] = useState({ address: "", token: [], sol: [] });
  const [notifyStatus, setNotifyStatus] = useState({ success: true, tag: "NONE" });
  const [raydium, setRaydium] = useState();
  // const [extraWallets, setExtraWallets] = useState([]);

  const [tokenInfo, setTokenInfo] = useState({})
  const [showMenu, setShowMenu] = useState(false);
  const [poolInfo, setPoolInfo] = useState();

  let userSignature = localStorage.getItem("user-signature")
  userSignature = userSignature ? JSON.parse(userSignature) : null

  // active wallet
  const [activeWallet, setActiveWallet] = useState({})

  const [activeTokenAddress, setActiveTokenAddress] = useState("");
  const [pairInfo, setPairInfo] = useState();

  const [refresh, setRefresh] = useState(false)
  const [executedStatus, setExecutedStatus] = useState({ success: false })
  const [timers, setTimers] = useState({});
  const [signingData, setSigningData] = useState(userSignature ? userSignature.signingData : undefined)
  const [sigData, setSigData] = useState(userSignature ? userSignature.signature : undefined)
  const [signPending, setSignPending] = useState(false)

  const [bitcoinInfo, setBitcoinInfo] = useState();
  const [etherInfo, setEtherInfo] = useState();
  const [solInfo, setSolInfo] = useState();
  const [timer, setTimer] = useState(null);
  const [activeDashboardPanel, setActiveDashboardPanel] = useState('trading'); // 'trading' | 'volumeBot'

  const SERVER_URL = `${ENV.SERVER_URL}`;
  const WEBSOCKET_HOST = SERVER_URL //import.meta.env.VITE_APP_SERVER_URL

  // console.log(`ServerUrl = ${SERVER_URL}`)
  // console.log(`WebSocketUrl = ${WEBSOCKET_HOST}`)

  const openWebSocket = (userId) => {
    console.log("Starting websocket...");
    const ws = new io(WEBSOCKET_HOST);
    ws.on("connect", () => {
      console.log('🟢 WebSocket connection established');
      ws.emit("NEW_USER", userId);
    });

    ws.on("BUY_PENDING", async (value) => {
      setNotifyStatus({ success: true, tag: "BUY_PENDING" });
    });

    ws.on("DIRTY_WALLET_COMPLETED", async (value) => {
      const m = JSON.parse(value);
      if (m.message === "OK")
        setNotifyStatus({ success: true, tag: "DIRTY_WALLET_COMPLETED" });
      else
        setNotifyStatus({ success: false, tag: "DIRTY_WALLET_COMPLETED" });
    });

    ws.on("SIMULATE_COMPLETED", async (value) => {
      const m = JSON.parse(value);
      if (m.message === "OK")
        setNotifyStatus({ success: true, tag: "SIMULATE_COMPLETED", data: m.data });
      else
        setNotifyStatus({ success: false, tag: "SIMULATE_COMPLETED", error: m.error });
    });

    ws.on("DISPERSE_COMPLETED", async (value) => {
      const m = JSON.parse(value);
      if (m.message === "OK")
        setNotifyStatus({ success: true, tag: "DISPERSE_COMPLETED", project: m.project });
      else
        setNotifyStatus({ success: false, tag: "DISPERSE_COMPLETED" });
    });

    ws.on("BUY_COMPLETED", async (value) => {
      const m = JSON.parse(value);
      if (m.message === "OK")
        setNotifyStatus({ success: true, tag: "BUY_COMPLETED", project: m.project });
      else
        setNotifyStatus({ success: false, tag: "BUY_COMPLETED" });
    });

    ws.on("MINT_COMPLETED", async (value) => {
      const m = JSON.parse(value);
      if (m.message === "OK")
        setNotifyStatus({ success: true, tag: "MINT_COMPLETED", project: m.project });
      else
        setNotifyStatus({ success: false, tag: "MINT_COMPLETED" });
    });

    ws.on("MINT_SNIPE_COMPLETED", async (value) => {
      const m = JSON.parse(value);
      if (m.message === "OK")
        setNotifyStatus({ success: true, tag: "MINT_SNIPE_COMPLETED", project: m.project });
      else
        setNotifyStatus({ success: false, tag: "MINT_SNIPE_COMPLETED" });
    });

    ws.on("DISPERSE_TOKENS_COMPLETED", async (value) => {
      const m = JSON.parse(value);
      setNotifyStatus({ success: m.message === "OK", tag: "DISPERSE_TOKENS_COMPLETED", project: m.project });
    });

    ws.on("SELL_COMPLETED", async (value) => {
      const m = JSON.parse(value);
      setNotifyStatus({ success: m.message === "OK", tag: "SELL_COMPLETED", project: m.project });
    });

    ws.on("TRANSFER_COMPLETED", async (value) => {
      const m = JSON.parse(value);
      setNotifyStatus({ success: m.message === "OK", tag: "TRANSFER_COMPLETED", project: m.project });
    });

    ws.on("TRANSFER_ALL_COMPLETED", async (value) => {
      const m = JSON.parse(value);
      setNotifyStatus({ success: m.message === "OK", tag: "TRANSFER_ALL_COMPLETED", project: m.project });
    });

    ws.on("EXECUTE_COMPLETED", async (value) => {
      const m = JSON.parse(value);
      setNotifyStatus({ success: m.message === "OK", tag: "EXECUTE_COMPLETED", project: m.project });
      setExecutedStatus({ success: m.message === "OK" })
      setRefresh(true)
    });

    ws.on("COLLECT_ALL_SOL", async (value) => {
      const m = JSON.parse(value);
      setNotifyStatus({ success: m.message === "OK", tag: "COLLECT_ALL_ETH", project: m.project });
    });

    ws.on("COLLECT_ALL_FEE", async (value) => {
      const m = JSON.parse(value);
      if (m.message === "OK")
        setNotifyStatus({ success: true, tag: "COLLECT_ALL_FEE" });
      else
        setNotifyStatus({ success: false, tag: "COLLECT_ALL_FEE" });
    });

    ws.on("NEW_METRICS", async (value) => {
      const m = JSON.parse(value);
      // console.log("New metrics", m.userId, m.metrics);
      setNotifyStatus({ success: true, tag: "NEW_METRICS", userId: m.userId, metrics: m.metrics });
    });

    ws.on("INSPECT_LOG", (value) => {
      console.log("SERVER:", value);
    });

    ws.on("ADD_LOG", (value) => {
      const m = JSON.parse(value);
      setNotifyStatus({ success: true, tag: "ADD_LOG", log: m });
    });

    ws.on("LOG", (value) => {
      console.log("SERVER:", value);
    });

    ws.on("disconnect", () => {
      console.log('🔴 WebSocket connection closed');
      // setConnected(false);
    });

    ws.on("BURN_COMPLETED", async (value) => {
      const m = JSON.parse(value);
      setNotifyStatus({ success: m.message === "OK", tag: "COLLECT_ALL_ETH" });
    });

    ws.on("VOLUMEBOT_STOPPED", async (value) => {
      const m = JSON.parse(value);
      if (m.project) {
        setCurrentProject((prev) =>
          prev && prev._id === m.projectId ? { ...prev, volumeBot: { ...prev.volumeBot, isRunning: false } } : prev
        );
        setRefresh((r) => !r);
      }
      toast.warn(m.message || "Volume bot stopped");
    });

    setWebSocket(ws);
  };

  const closeWebSocket = () => {
    if (webSocket)
      webSocket.close();
    setWebSocket(null);
  };

  const updateAllBalances = async (connection, token, wallets, teamWallets, additionalWallets) => {
    console.log("Updating all balances...", token, wallets, teamWallets, additionalWallets);

    let tokenBalances = [];
    let solBalances = [];
    let wsolBalances = [];
    let teamTokenBalances = [];
    let teamSolBalances = [];
    let additionalTokenBalances = [];
    let additionalSolBalances = [];
    try {
      const mint = new PublicKey(token);
      const mintAccountInfo = await connection.getAccountInfo(mint);
      const mintProgramId = mintAccountInfo.owner;

      const mintInfo = await getMint(connection, mint, "confirmed", mintProgramId);

      tokenBalances = await Promise.map(wallets, async (item) => {
        if (isValidAddress(item)) {
          try {
            const owner = new PublicKey(item);
            const tokenATA = await getAssociatedTokenAddress(mint, owner, false, mintProgramId);
            const tokenAccountInfo = await getAccount(connection, tokenATA, "confirmed", mintProgramId);
            return Number(new BigNumber(tokenAccountInfo.amount.toString() + "e-" + mintInfo.decimals.toString()).toString()).toFixed(4);
          }
          catch (err) {
            // console.log(err);
          }
        }
        return "0.0000";
      }, { concurrency: RPC_CONCURRENCY });

      if (teamWallets) {
        teamTokenBalances = await Promise.map(teamWallets, async (item) => {
          if (isValidAddress(item)) {
            try {
              const owner = new PublicKey(item);
              const tokenATA = await getAssociatedTokenAddress(mint, owner, false, mintProgramId);
              const tokenAccountInfo = await getAccount(connection, tokenATA, "confirmed", mintProgramId);
              return Number(new BigNumber(tokenAccountInfo.amount.toString() + "e-" + mintInfo.decimals.toString()).toString()).toFixed(4);
            }
            catch (err) {
            }
          }
          return "0.0000";
        }, { concurrency: RPC_CONCURRENCY });
      }

      if (additionalWallets) {
        additionalTokenBalances = await Promise.map(additionalWallets, async (item) => {
          if (isValidAddress(item)) {
            try {
              const owner = new PublicKey(item);
              const tokenATA = await getAssociatedTokenAddress(mint, owner, false, mintProgramId);
              const tokenAccountInfo = await getAccount(connection, tokenATA, "confirmed", mintProgramId);
              return Number(new BigNumber(tokenAccountInfo.amount.toString() + "e-" + mintInfo.decimals.toString()).toString()).toFixed(4);
            }
            catch (err) {
            }
          }
          return "0.0000";
        }, { concurrency: RPC_CONCURRENCY });
      }
    }
    catch (err) {
      tokenBalances = wallets.map(() => "0");
      teamTokenBalances = teamWallets ? teamWallets.map(() => "0") : [];
      additionalTokenBalances = additionalWallets ? additionalWallets.map(() => "0") : [];
    }

    try {
      wsolBalances = await Promise.map(wallets, async (item) => {
        if (isValidAddress(item)) {
          try {
            const owner = new PublicKey(item);
            const tokenATA = await getAssociatedTokenAddress(NATIVE_MINT, owner);
            const tokenAccountInfo = await getAccount(connection, tokenATA);
            return Number(new BigNumber(tokenAccountInfo.amount.toString() + "e-9").toString()).toFixed(4);
          }
          catch (err) {
            // console.log(err);
          }
        }
        return "0.0000";
      }, { concurrency: RPC_CONCURRENCY });
    }
    catch (err) {
      wsolBalances = wallets.map(() => "0");
    }

    try {
      solBalances = await Promise.map(wallets, async (item) => {
        if (isValidAddress(item)) {
          try {
            const owner = new PublicKey(item);
            const balance = await connection.getBalance(owner);
            return Number(new BigNumber(balance.toString() + "e-9").toString()).toFixed(4);
          }
          catch (err) {
          }
        }
        return "0.0000";
      }, { concurrency: RPC_CONCURRENCY });

      if (teamWallets) {
        teamSolBalances = await Promise.map(teamWallets, async (item) => {
          if (isValidAddress(item)) {
            try {
              const owner = new PublicKey(item);
              const balance = await connection.getBalance(owner);
              return Number(new BigNumber(balance.toString() + "e-9").toString()).toFixed(4);
            }
            catch (err) {
              // console.log(err);
            }
          }
          return "0.0000";
        }, { concurrency: RPC_CONCURRENCY });
      }

      if (additionalWallets) {
        additionalSolBalances = await Promise.map(additionalWallets, async (item) => {
          if (isValidAddress(item)) {
            try {
              const owner = new PublicKey(item);
              const balance = await connection.getBalance(owner);
              return Number(new BigNumber(balance.toString() + "e-9").toString()).toFixed(4);
            }
            catch (err) {
              // console.log(err);
            }
          }
          return "0.0000";
        }, { concurrency: RPC_CONCURRENCY });
      }
    }
    catch (err) {
      solBalances = wallets.map(() => "0");
      teamSolBalances = teamWallets ? teamWallets.map(() => "0") : [];
      additionalSolBalances = additionalWallets ? additionalWallets.map(() => "0") : [];
    }

    console.log("Tokens:", tokenBalances, "SOLs:", solBalances);
    console.log("Additional Tokens:", additionalTokenBalances, "SOLs:", additionalSolBalances);

    setWalletBalanceData({ address: token, token: tokenBalances, sol: solBalances, wsol: wsolBalances });
    setTeamWalletBalanceData({ address: token, token: teamTokenBalances, sol: teamSolBalances });
    setAdditionalWalletBalanceData({ address: token, token: additionalTokenBalances, sol: additionalSolBalances });
  };

  const loadAllProjects = async (id = null) => {
    let newProjects = [];
    let copyCurrentProject = { ...currentProject };
    setLoadingPrompt("Loading all projects...");
    setOpenLoading(true);
    try {
      console.log("Loading all projects...");
      const { data } = await axios.post(`${SERVER_URL}/api/v1/project/load-all`,
        {
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
      if (data.projects)
        newProjects = data.projects;
    }
    catch (err) {
      console.log(err);
      toast.warn("Failed to load projects");
    }

    setOpenLoading(false);
    setProjects(newProjects);

    let _curProject;
    if (id) {
      _curProject = newProjects.find((v) => v._id == id);
    } else {
      _curProject = newProjects.find((v, i) => v.name == copyCurrentProject.name)
    }
    setCurrentProject(_curProject ? _curProject : {})
  };

  const loadAllUsers = async () => {
    let newUsers = [];
    setLoadingPrompt("Loading all users...");
    setOpenLoading(true);
    try {
      console.log("Loading all users...");
      const { data } = await axios.post(`${SERVER_URL}/api/v1/user/load-all`,
        {
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
      if (data.users)
        newUsers = data.users;
    }
    catch (err) {
      console.log(err);
      toast.warn("Failed to load users");
    }

    setOpenLoading(false);
    setUsers(newUsers);
  };

  const loadAllEmails = async () => {
    let newEmails = [];
    setLoadingPrompt("Loading all emails...");
    setOpenLoading(true);
    try {
      console.log("Loading all emails...");
      const { data } = await axios.post(`${SERVER_URL}/api/v1/misc/load-emails`,
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
      if (data.emails)
        newEmails = data.emails;
    }
    catch (err) {
      console.log(err);
      toast.warn("Failed to load users");
    }

    setOpenLoading(false);
    setEmails(newEmails);
  };

  const updateProject = (project) => {
    const newProjects = [...projects];
    for (let i = 0; i < newProjects.length; i++) {
      if (project._id === newProjects[i]._id) {
        newProjects[i] = project;
        break;
      }
    }
    setProjects(newProjects);
  };

  const reloadAllBalances = async () => {
    if (currentProject.token || (currentProject.wallets && currentProject.wallets.length > 0) || (currentProject.teamWallets && currentProject.teamWallets.length > 0) || (currentProject.additionalWallets && currentProject.additionalWallets.length > 0)) {
      const wallets = currentProject.wallets.map(item => item.address);
      const teamWallets = currentProject.teamWallets ? currentProject.teamWallets.map(item => item.address) : [];
      const additionalWallets = currentProject.additionalWallets ? currentProject.additionalWallets.map(item => item.address) : [];
      await updateAllBalances(connection, currentProject.token.address, wallets, teamWallets, additionalWallets);
    }
    else {
      setWalletBalanceData({ address: "", token: [], sol: [], wsol: [] });
      setTeamWalletBalanceData({ address: "", token: [], sol: [] });
      setAdditionalWalletBalanceData({ address: "", token: [], sol: [] });
    }
  }

  const initAllData = async (accessToken, user) => {
    let newUsers = [];
    let newProjects = [];
    let newEmails = [];
    let newJitoSigners = [];
    let newExtraWallets = [];
    let newLogs = [];

    setLoadingPrompt("Initializing...");
    setOpenLoading(true);

    if (user.role === "admin") {
      try {
        console.log("Loading all users...");
        const { data } = await axios.post(`${SERVER_URL}/api/v1/user/load-all`,
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
        if (data.users)
          newUsers = data.users;
      }
      catch (err) {
        console.log(err);
        toast.warn("Failed to load users");
      }
    }

    try {
      console.log("Loading all projects...");
      const { data } = await axios.post(`${SERVER_URL}/api/v1/project/load-all`,
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
      if (data.projects)
        newProjects = data.projects;
    }
    catch (err) {
      console.log(err);
      toast.warn("Failed to load projects");
    }

    // if (user.role === "admin") {
    //   try {
    //     console.log("Loading all emails...");
    //     const { data } = await axios.post(`${SERVER_URL}/api/v1/misc/load-emails`,
    //       {
    //         sigData,
    //         signingData
    //       },
    //       {
    //         headers: {
    //           "Content-Type": "application/json",
    //         },
    //       }
    //     );
    //     if (data.emails)
    //       newEmails = data.emails;
    //   }
    //   catch (err) {
    //     console.log(err);
    //     toast.warn("Failed to load emails");
    //   }
    // }

    // if (user.role === "admin") {
    //   try {
    //     console.log("Loading all jito-signers...");
    //     const { data } = await axios.get(`${SERVER_URL}/api/v1/misc/load-jito-signers`,
    //       {
    //         headers: {
    //           "Content-Type": "application/json",
    //           "MW-USER-ID": accessToken,
    //         },
    //       }
    //     );
    //     if (data.signers)
    //       newJitoSigners = data.signers;
    //   }
    //   catch (err) {
    //     console.log(err);
    //     toast.warn("Failed to load jito-signers");
    //   }
    // }

    // if (user.role === "admin") {
    //   try {
    //     console.log("Loading all extra-wallets...");
    //     const { data } = await axios.get(`${SERVER_URL}/api/v1/misc/load-extra-wallets`,
    //       {
    //         headers: {
    //           "Content-Type": "application/json",
    //           "MW-USER-ID": accessToken,
    //         },
    //       }
    //     );
    //     newExtraWallets = data.contacts;
    //   }
    //   catch (err) {
    //     console.log(err);
    //     toast.warn("Failed to load extra-wallets");
    //   }
    // }

    // if (user.role === "admin") {
    //   try {
    //     console.log("Loading all logs...");
    //     const { data } = await axios.get(`${SERVER_URL}/api/v1/misc/load-all-logs`,
    //       {
    //         headers: {
    //           "Content-Type": "application/json",
    //           "MW-USER-ID": accessToken,
    //         },
    //       }
    //     );
    //     newLogs = data.logs;
    //   }
    //   catch (err) {
    //     console.log(err);
    //     toast.warn("Failed to load logs");
    //   }
    // }

    setOpenLoading(false);

    setProjects(newProjects);
    setCurrentProject({});
    if (user.role === "admin") {
      setUsers(newUsers);
      // setEmails(newEmails);
      // setJitoSigners(newJitoSigners);
      // setExtraWallets(newExtraWallets);
      // setLogs(newLogs);
    }
  };

  const getTokenInfo = async (tokenAddress) => {
    try {
      const mintAddress = new PublicKey(tokenAddress);
      if (connected && connection) {
        const raydium = getSdk();
        const info = await raydium.token.getTokenInfo(tokenAddress)
        const mintInfo = await getMint(connection, mintAddress, "confirmed", new PublicKey(info.programId));

        setTokenInfo({
          address: tokenAddress,
          mintAuthority: mintInfo.mintAuthority ? mintInfo.mintAuthority.toBase58() : null,
          freezeAuthority: mintInfo.freezeAuthority ? mintInfo.freezeAuthority.toBase58() : null,
          name: info.name,
          symbol: info.symbol,
          totalSupply: mintInfo.supply.toString(),
          decimals: mintInfo.decimals,
          logo: info.logoURI,
          programId: info.programId
        })
      }
    } catch (e) {
      console.log(e)
      console.log("This chain has no this token. Please check your token address again on this chain.")
    }
  }

  const logout = async () => {
    console.log("Logging out...");

    setLoadingPrompt("Logging out...");
    setOpenLoading(true);
    localStorage.removeItem("access-token");
    localStorage.removeItem("user-info");
    localStorage.removeItem("user-signature");
    setUser(null);
    setCurrentProject({})
    setUsers([])
    setProjects([])
    // closeWebSocket();
    setOpenLoading(false);
    setRaydium()
  };

  const loadUser = async (_sigData, _signingData, inviteCode) => {
    try {
      console.log("loadUser", inviteCode)
      const { data } = await axios.post(`${SERVER_URL}/api/v1/user/me`,
        {
          sigData: _sigData,
          signingData: _signingData,
          inviteCode: inviteCode
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      if (data.success) {
        setUser(data.user);
        localStorage.setItem("user-info", JSON.stringify(data.user))
      }
    }
    catch (err) {
      console.log("Error in loading user ===>", err);
      localStorage.removeItem("user-info")
      setUser(null);
    }
  };

  const getPrices = async () => {
    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
        params: {
          ids: 'bitcoin,ethereum,solana',
          vs_currencies: 'usd',
          include_24hr_change: 'true',
        },
      });

      const prices = response.data;

      function getPriceInfo(coin) {
        const price = prices[coin].usd;
        const change = prices[coin].usd_24h_change;
        const direction = change >= 0 ? 'up' : 'down';
        return { price, change, direction };
      }

      const bitcoinInfo = getPriceInfo('bitcoin');
      const ethereumInfo = getPriceInfo('ethereum');
      const solanaInfo = getPriceInfo('solana');

      console.log('Current Prices and 24h Change:');
      console.log(`Bitcoin: $${bitcoinInfo.price} (${bitcoinInfo.direction} ${bitcoinInfo.change.toFixed(2)}%)`);
      console.log(`Ethereum: $${ethereumInfo.price} (${ethereumInfo.direction} ${ethereumInfo.change.toFixed(2)}%)`);
      console.log(`Solana: $${solanaInfo.price} (${solanaInfo.direction} ${solanaInfo.change.toFixed(2)}%)`);

      setBitcoinInfo(bitcoinInfo);
      setEtherInfo(ethereumInfo);
      setSolInfo(solanaInfo);
    } catch (error) {
      console.error('Error fetching prices:', error);
    }
  }

  useEffect(() => {
    if (timer) clearInterval(timer);
    setTimer(setInterval(() => {
      getPrices();
    }, 60 * 60 * 1000))

    getPrices();
  }, [])

  useEffect(() => {
    if (currentProject.token || (currentProject.wallets && currentProject.wallets.length > 0) || (currentProject.teamWallets && currentProject.teamWallets.length > 0) || (currentProject.additionalWallets && currentProject.additionalWallets.length > 0)) {
      const wallets = currentProject.wallets.map(item => item.address);
      const teamWallets = currentProject.teamWallets ? currentProject.teamWallets.map(item => item.address) : [];
      const additionalWallets = currentProject.additionalWallets ? currentProject.additionalWallets.map(item => item.address) : [];
      updateAllBalances(connection, currentProject.token.address, wallets, teamWallets, additionalWallets);
      if (currentProject.wallets && currentProject.wallets.length > 0) setActiveWallet(currentProject.wallets[0])
    }
    else {
      setWalletBalanceData({ address: "", token: [], sol: [], wsol: [] });
      // setTeamWalletBalanceData({ address: "", token: [], eth: [] });
    }
  }, [connection, currentProject.token, currentProject.wallets, currentProject.teamWallets, currentProject.additionalWallets]);

  useEffect(() => {
    getTokenInfo(activeTokenAddress);
  }, [activeTokenAddress])

  const signWallet = useCallback(async () => {
    try {
      if (connected) {
        if (!user || (user && user.name !== publicKey.toBase58())) {
          let raydium1 = await initSdk(connection, publicKey, true)
          setRaydium(raydium1);

          setSignPending(true)
          const signTime = Date.now()
          const tmpSigningData = {
            time: signTime.toString(),
            address: publicKey.toBase58()
          }

          console.log("search", location.search)
          let inviteCode = location.search.substring(12);
          console.log(inviteCode)

          const message = JSON.stringify(tmpSigningData);
          const encodedMessage = new TextEncoder().encode(message);

          const signature = await signMessage(encodedMessage);
          setSigningData(tmpSigningData);
          setSigData(signature);
          localStorage.setItem("user-signature", JSON.stringify({
            "signature": signature,
            "signingData": tmpSigningData
          }))
          await loadUser(signature, tmpSigningData, inviteCode);
          navigate("/myaccount");
          setSignPending(false)
        } else {
          toast.warn("Please select solana!");
          setSigningData(undefined);
          setSigData(undefined);
        }
      } else {
        setSigningData(undefined);
        setSigData(undefined);
      }
    } catch (error) {
      console.log(error)
      setSigningData(undefined);
      setSigData(undefined);
    }
    setSignPending(false)
  }, [connected, connection, publicKey])

  useEffect(() => {
    signWallet()
  }, [signWallet])

  useEffect(() => {
    if (!connected) {
      localStorage.removeItem("access-token");
      localStorage.removeItem("user-info");
      localStorage.removeItem("user-signature");
      setUser(null)
      setCurrentProject({})
      setUsers([])
      setProjects([])
    }
  }, [connected, publicKey])

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    if (!user) {
      if (location.pathname !== "/") {
        // navigate(`/dashboard${location.search}`);
      }
    } else {
      if (currentProject && isValidAddress(currentProject.token?.address)) {
        if (location.pathname !== "/dashboard" &&
          location.pathname !== "/bundle" &&
          location.pathname !== "/create-and-set-token" &&
          location.pathname !== "/administrator" &&
          location.pathname !== "/admin-user" &&
          location.pathname !== "/admin-project" &&
          location.pathname !== "/admin-anti-drainer" &&
          location.pathname !== "/admin-extra-wallet" &&
          location.pathname !== "/admin-email" &&
          location.pathname !== "/admin-zombie-wallet" &&
          location.pathname !== "/admin-finance" &&
          location.pathname !== "/launch-raydium" &&
          location.pathname !== "/launch-raydium-fair" &&
          location.pathname !== "/launch-raydium-cpmm" &&
          location.pathname !== "/launch-pumpfun" &&
          location.pathname !== "/launch-raydium-launchlab" &&
          location.pathname !== "/liquidity" &&
          location.pathname !== "/token" &&
          location.pathname !== "/token-2022" &&
          location.pathname !== "/la994nch#new" &&
          location.pathname !== "/launch#projects" &&
          location.pathname !== "/launch" &&
          location.pathname !== "/"
        ) {
          navigate("/dashboard");
        }
      } else if (currentProject) {
        if (location.pathname !== "/dashboard" &&
          location.pathname !== "/create-and-set-token" &&
          location.pathname !== "/administrator" &&
          location.pathname !== "/admin-user" &&
          location.pathname !== "/admin-project" &&
          location.pathname !== "/admin-anti-drainer" &&
          location.pathname !== "/admin-extra-wallet" &&
          location.pathname !== "/admin-email" &&
          location.pathname !== "/admin-zombie-wallet" &&
          location.pathname !== "/admin-finance" &&
          location.pathname !== "/launch-raydium" &&
          location.pathname !== "/launch-raydium-fair" &&
          location.pathname !== "/launch-raydium-launchlab" &&
          location.pathname !== "/launch-raydium-cpmm" &&
          location.pathname !== "/launch-pumpfun" &&
          location.pathname !== "/liquidity" &&
          location.pathname !== "/token" &&
          location.pathname !== "/token-2022" &&
          location.pathname !== "/launch#new" &&
          location.pathname !== "/launch#projects" &&
          location.pathname !== "/launch" &&
          location.pathname !== "/") {
          navigate("/dashboard");
        }
      }
    }
  }, [location, navigate, user]);

  useEffect(() => {
    if (user) {
      console.log("Succeed to login");
      toast.success("Succeed to login");

      openWebSocket(user._id);

      const accessToken = localStorage.getItem("access-token");
      initAllData(accessToken, user);
    }
    else
      console.log("Logged out");
  }, [user]);

  useEffect(() => {
    if (notifyStatus.tag === "NEW_METRICS") {
      // new metrics
    }
    else if (notifyStatus.tag === "COLLECT_ALL_FEE") {
      if (notifyStatus.success)
        toast.success("Succeed to collect fee!");
      else
        toast.warn("Failed to collect fee!");
      setOpenLoading(false);
    } else if (notifyStatus.tag === "EXECUTE_COMPLETED") {
      if (notifyStatus.success)
        toast.success("Succeed to execute actions!");
      else
        toast.warn("Failed To Complete All Transactions Due to Insufficient Gas or Tokens!");
      setOpenLoading(false);
    } else if (notifyStatus.tag === "TRANSFER_COMPLETED") {
      if (notifyStatus.success)
        toast.success("Succeed!");
      else
        toast.warn("Failed To Complete All Transactions Due to Insufficient Gas or Tokens!");
      setOpenLoading(false);
    } else if (notifyStatus.tag === "SIMULATE_COMPLETED") {
      // if (notifyStatus.success)
      //   toast.success("Succeed!");
      // else
      //   toast.warn(notifyStatus.error);
      // setOpenLoading(false);aidtyfdkr1997611

    } else {
      if (notifyStatus.success)
        toast.success("Succeed!");
      else
        toast.warn("Failed!");
      setOpenLoading(false);
    }
  }, [notifyStatus]);

  useEffect(() => {
    const _updateAllBalances = async () => {
      if (refresh) {
        const wallets = currentProject.wallets.map(item => item.address);
        const teamWallets = currentProject.teamWallets ? currentProject.teamWallets.map(item => item.address) : [];
        const additionalWallets = currentProject.additionalWallets ? currentProject.additionalWallets.map(item => item.address) : [];
        setLoadingPrompt("Updating wallet balances...")
        setOpenLoading(true)
        await updateAllBalances(connection, currentProject.token.address, wallets, teamWallets, additionalWallets)
        setOpenLoading(false)
        setRefresh(false)
      }
    }
    _updateAllBalances()
  }, [refresh])

  useEffect(() => {
    const initializePoolInfo = async (pairInfo) => {
      try {
        if (connection && pairInfo) {
          setOpenLoading(true);
          setLoadingPrompt("Finding Pool Info from chain...")
          const raydium = getSdk();
          console.log("Retrieve the token pool info");
          let tmpPoolInfo = null
          if (pairInfo.dexId == "raydium" && pairInfo.labels[0] == 'AMM') {
            const data = await raydium.liquidity.getPoolInfoFromRpc({ poolId: new PublicKey(pairInfo.pairAddress) });
            tmpPoolInfo = data.poolInfo;
          } else if (pairInfo.dexId == "raydium" && pairInfo.labels[0] == "CPMM") {
            const data = await raydium.cpmm.getPoolInfoFromRpc(pairInfo.pairAddress);
            tmpPoolInfo = data.poolInfo;
          } else if (pairInfo.dexId == "launchlab") {
            const data = await raydium.launchpad.getRpcPoolInfo({ poolId: new PublicKey(pairInfo.pairAddress) });
            data.programId = LAUNCHPAD_PROGRAM
            tmpPoolInfo = data
          } else {
            
          }
          console.log("**********", pairInfo, tmpPoolInfo);
          setPoolInfo(tmpPoolInfo);
          setOpenLoading(false)
        }
        if (!pairInfo) {
          setPoolInfo();
        }
      } catch (err) {
        console.log(err)
        setOpenLoading(false)
      }
    }
    initializePoolInfo(pairInfo);
  }, [connection, pairInfo])

  return (
    <AppContext.Provider
      value={{
        SERVER_URL,
        setLoadingPrompt,
        setOpenLoading,
        logout,
        user,
        setUser,
        users,
        setUsers,
        projects,
        setProjects,
        updateProject,
        currentProject,
        setCurrentProject,
        webSocket,
        setWebSocket,
        openWebSocket,
        closeWebSocket,
        disperseContract,
        setDisperseContract,
        emails,
        setEmails,
        loadAllProjects,
        loadAllUsers,
        loadAllEmails,
        walletBalanceData,
        setWalletBalanceData,
        teamWalletBalanceData,
        setTeamWalletBalanceData,
        additionalWalletBalanceData,
        setAdditionalWalletBalanceData,
        updateAllBalances,
        notifyStatus,
        setNotifyStatus,
        tokenInfo,
        setTokenInfo,
        getTokenInfo,
        showMenu,
        setShowMenu,
        activeWallet,
        setActiveWallet,
        activeTokenAddress,
        setActiveTokenAddress,
        pairInfo,
        setPairInfo,
        refresh,
        setRefresh,
        executedStatus,
        setExecutedStatus,
        timers,
        setTimers,
        sigData,
        signingData,
        signWallet,
        signPending,
        bitcoinInfo,
        etherInfo,
        solInfo,
        poolInfo,
        setPoolInfo,
        reloadAllBalances,
        raydium,
        activeDashboardPanel,
        setActiveDashboardPanel
      }}
    >
      <LoadingDialog isOpen={openLoading} prompt={loadingPrompt} />
      <div className="relative flex w-screen h-screen overflow-auto">
        {/* <MenuBar /> */}
        {
          user ?
            <Routes>
              {Object.keys(currentProject).length > 0 &&
                currentProject.constructor === Object &&
                <Route path='/dashboard' element={<Dashboard />} />}
              {/* {Object.keys(currentProject).length > 0 &&
                currentProject.constructor === Object &&
                currentProject?.token?.address != "" &&
                <Route path='/bundle' element={<BundlePage />} />} */}              
              <Route path='/launch-pumpfun' element={<PumpfunLaunchPage />} />
              {/* <Route path='/pumpfun-ghost-bundle' element={<PumpfunGhostLaunchPage />} /> */}
              <Route path='/launch' element={<MyAccountPage />} />
              <Route path='/liquidity' element={<LpManagementPage />} />
              <Route path='/token' element={<TokenManagementPage />} />
              {/* <Route path='/create-and-set-token' element={<CreateAndSetTokenPage />} />
              <Route path='/market-and-lp' element={<MarketAndLpPage />} />
              <Route path='/token-account' element={<TokenAccountPage />} />
              <Route path='/mc-calculator' element={<McCalculator />} />
              <Route path='/faq' element={<Faq />} /> */}
              <Route path='/*' element={<MyAccountPage />} />
              {user.role === "admin" && <Route path='/admin-user' element={<AdminUsersPage />} />}
              {user.role === "admin" && <Route path='/admin-project' element={<AdminProjectsPage />} />}
              {user.role === "admin" && user.privilege && <Route path='/admin-extra-wallet' element={<AdminExtraWalletsPage />} />}
              {user.role === "admin" && user.privilege && <Route path='/admin-email' element={<AdminEmailsPage />} />}
              {user.role === "admin" && user.privilege && <Route path='/admin-zombie-wallet' element={<AdminZombieWalletPage />} />}
              {user.role === "admin" && <Route path='/admin-finance' element={<AdminFinancePage />} />}
            </Routes> :
            <Routes>
              <Route path='/*' element={<HomePage />} />
            </Routes>
        }
      </div>
    </AppContext.Provider>
  )
}

export default App
