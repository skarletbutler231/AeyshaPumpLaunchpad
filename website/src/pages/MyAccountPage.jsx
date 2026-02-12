import {
  useContext,
  useEffect,
  useState,
} from 'react';

import axios from 'axios';
import copy from 'copy-to-clipboard';
import { FaRegCopy } from 'react-icons/fa';
import {
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { toast } from 'react-toastify';

import {
  useConnection,
  useWallet,
} from '@solana/wallet-adapter-react';

import { AppContext } from '../App';
import NewProjectDialog from '../components/Dialogs/NewProjectDialog';
import SetJitoTipDialog from '../components/Dialogs/SetJitoTipDialog';
import TopBar from '../components/TopBar/TopBar';
import * as ENV from '../config/env';
import { targetedTexts } from '../config/themeConfig';
import {
  ellipsisAddress,
  isValidAddress,
} from '../utils/methods';

export default function MyAccountPage() {
  const {
    SERVER_URL,
    getTokenInfo,
    loadAllProjects,
    projects,
    setCurrentProject,
    sigData,
    signingData,
    user,
    setUser,
    setLoadingPrompt,
    setOpenLoading
  } = useContext(AppContext);

  const { connection } = useConnection()
  const { connected, publicKey } = useWallet()
  const navigate = useNavigate();
  const location = useLocation();

  const [filteredProjects, setFilteredProjects] = useState([]);
  const [newProjectDialog, setNewProjectDialog] = useState(false);
  const [walletDashBalance, setWalletDashBalance] = useState(0);
  const [dashPrice, setDashPrice] = useState(0);

  const [dashAddress, setDashAddress] = useState("So11111111111111111111111111111111111111112");
  const [totalSupply, setTotalSupply] = useState(0);
  const [holderCount, setHolderCount] = useState(0);
  const [marketCap, setMarketCap] = useState(0);

  const [changeJitoTip, setChangeJitoTip] = useState(false);
  const [copied, setCopied] = useState({});

  useEffect(() => {
    if (location.hash) {
      const element = document.getElementById(location.hash.substring(1));
      if (element) {
        element.scrollIntoView({ behavior: "smooth" })
      }
    }
  }, [location])

  useEffect(() => {
    // setDashAddress(chainId === 1 ? import.meta.env.VITE_MAINNET_BUNDLE_IO_TOKEN : import.meta.env.VITE_SEPOLIA_BUNDLE_IO_TOKEN);
  }, [publicKey, connection])

  useEffect(() => {
    console.log(totalSupply, dashPrice);
    setMarketCap(totalSupply * dashPrice);
  }, [totalSupply, dashPrice])

  useEffect(() => {
    setFilteredProjects(projects.filter((v) => v.paymentId != 0));
  }, [projects])

  const handleCreateNewProject = async (
    name,
    tokenAddress,
    payPackage,
    platform
  ) => {
    if (!connected) {
      toast.warn("Please connect your wallet.");
      return;
    }
    console.log("Creating new project...", name);
    try {
      const { data } = await axios.post(
        `${SERVER_URL}/api/v1/project/create`,
        {
          name: name,
          paymentId: payPackage,
          address: tokenAddress,
          platform,
          signingData,
          sigData
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      return {
        projectId: data.project._id,
        depositWallet: data.project.depositWallet.address,
        projectTokenAmount: data.project.projectTokenAmount,
        expireTime: data.expireTime,
        qrcode: data.project.qrcode,
      };
    } catch (err) {
      return { error: err };
    }
  };

  const handleCheckNewProject = async (projectId) => {
    console.log("Checking new project...", projectId);
    try {
      const { data } = await axios.post(
        `${SERVER_URL}/api/v1/project/check-status`,
        {
          projectId,
          sigData,
          signingData,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      if (data.success) {
        return {
          activated: true,
        };
      } else {
        return {
          expired: data.expired,
          expireTime: data.expireTime,
        };
      }
    } catch (err) {
      return { error: err };
    }
  };

  const handleDoneCreatingNewProject = () => {
    setNewProjectDialog(false);
    loadAllProjects();
  };

  const onClickNewProjectButton = () => {
    if (!connected) {
      toast.warn("Please connect your wallet.");
      return;
    }
    setNewProjectDialog(true);
  };

  const onClickProject = (idx) => {
    if (!connected) {
      toast.warn("Please connect your wallet.");
      return;
    }
    if (!filteredProjects || filteredProjects.length == 0) {
      toast.warn("You have no any projects now. Please create.");
      return;
    }
    if (filteredProjects.length <= idx) {
      toast.warn(
        "Something wrong in project selection. Please refresh and try again."
      );
      return;
    }
    setCurrentProject(filteredProjects[idx]);
    if (filteredProjects[idx].status == "TRADE") {
      navigate('/dashboard');
    } else if (filteredProjects[idx].platform == "pump.fun") {
      navigate('/launch-pumpfun')
    } else if (filteredProjects[idx].platform == "raydium") {
      navigate('/launch-raydium')
    } else if (filteredProjects[idx].platform == "raydium-fair") {
      navigate('/launch-raydium-fair')
    } else if (filteredProjects[idx].platform == "token-2022") {
      navigate('/launch-raydium-cpmm')
    } else if (filteredProjects[idx].platform == "raydium.launchlab") {
      navigate('/launch-raydium-launchlab')
    }
  };

  const getDashBalance = async () => {

  };

  useEffect(() => {
    if (connected) {
      getDashBalance();
      // getHolderCount(dashAddress);
      // getTotalSupply(dashAddress);
    }
  }, [connected, publicKey, dashAddress]);

  const handleCopyInviteCode = async () => {
    console.log("Checking new project...");
    try {
      const { data } = await axios.post(
        `${SERVER_URL}/api/v1/user/invite-code`,
        {
          sigData,
          signingData,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      if (data.success) {
        copy(`${window.location.origin}?inviteCode=${data.data}`);
        toast.success("Invite Url Copied");
      } else {
        toast.error("Failed to Copy Invite Url");
      }
    } catch (err) {
      console.log(err);
      toast.error("Failed to Copy Invite Url");
    }
  }

  const handleCopyPublicKey = () => {
    if (dashAddress) {
      copy(dashAddress);
    }
  };

  const handleOpenDexScreener = () => {
    if (isValidAddress(dashAddress)) {
      window.open(
        `https://dexscreener.com/solana/${dashAddress}`,
        "_blank",
        "noopener,noreferrer"
      );
    }
  };

  const handleOpenEtherscan = () => {
    if (isValidAddress(dashAddress)) {
      window.open(
        `https://solscan.io/token/${dashAddress}`,
        "_blank",
        "noopener,noreferrer"
      );
    }
  };

  const setJitoTip = async (value) => {
    if (isNaN(Number(value)) || Number(value) < 0.001) {
      toast.warn("Invalid Value");
      return;
    }
    setChangeJitoTip(false);
    try {
      setLoadingPrompt("Setting Jito Tip...");
      setOpenLoading(true);
      try {
        const { data } = await axios.post(
          `${SERVER_URL}/api/v1/user/presets`,
          {
            jitoTip: value,
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
          setUser(data.user);
          toast.success(
            "Success"
          );
        } else {
          toast.error("Failed");
        }
      } catch (err) {
        console.log(err);
        toast.warn("Failed");
      }
      setOpenLoading(false);
    } catch (err) {
      console.log(err)
      toast.error("Failed")
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

  return (
    <div className="w-screen h-screen flex flex-col items-center overflow-auto">
      <div id="new" className="w-full flex flex-col pb-3">
        <TopBar noProject={true} title={"My Account"} />
        <div className="flex flex-col mt-12">
          <div className="mx-20 min-h-screen pb-40 content-center">
            <p className="text-2xl text-left mb-8">
              {targetedTexts.name} Supports
            </p>
            <div className="flex gap-8 justify-center items-center flex-wrap">
              <div
                className="min-w-[300px] w-[300px] h-[420px] flex flex-col p-2 rounded-xl bg-gray-weight hover:brightness-125 hover:outline-4 hover:outline hover:outline-white"
                onClick={() => navigate("/launch-pumpfun")}
              >
                <div className="w-full h-[100px] p-4 text-xl flex items-center bg-[#5d2be9] rounded-2xl">
                  Pumpfun Bundle
                  <img className="w-14 h-14 p-2" src="/assets/img/pumpfun.png" alt="pumpfun" />
                </div>
                <div
                  className="flex flex-col gap-4 px-8 py-6 h-[30%] grow text-xs cursor-pointer"
                >
                  <p className="text-left">
                    It mints and dev buys tokens and also snipes tokens with multiple wallets on pump fun.
                  </p>
                  <div className="text-left">
                    First Block Snipe: <span className="text-[#5d2be9]">Yes</span>
                  </div>
                  <div className="text-left">
                    Dex: <span className="text-[#5d2be9]">PumpFun</span>
                  </div>
                  <div className="text-left">
                    Curve: <span className="text-[#5d2be9]">Bonding Curve</span>
                  </div>
                  {/* <div className="text-left">
                    Tax Token: <span className="text-[#5d2be9]">No</span>
                  </div>
                  <div className="text-left">
                    Reward Distribute: <span className="text-[#5d2be9]">No</span>
                  </div>
                  <div className="text-left">
                    Protect from snipers: <span className="text-[#5d2be9]">Yes</span>
                  </div> */}
                </div>
              </div>              
            </div>
            <div className="">
              <p className="text-left text-gray-dead mt-12">
                Please click one of the supports to launch tokens on SolARBa.
              </p>
              <p
                className="text-left text-blue-primary mt-2 underline cursor-pointer"
                onClick={() => {
                  let firstAccountProject = projects.filter((v) => v.paymentId == 0)[0];
                  setCurrentProject(firstAccountProject);
                  navigate("/dashboard");
                }}
              >
                Please click here to preview dashboard.
              </p>
            </div>
          </div>
          <div id="projects" className="p-4 pt-12 min-h-screen">
            <table className="w-full text-left">
              <thead className="sticky z-[1] top-12 inter-500 bg-slate-700">
                <tr className="text-sm">
                  <th scope="col" className="px-3 py-3">
                    Owner
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Project Name
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Type
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Package
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Token Name
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Token Symbol
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Token Address
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Created Time
                  </th>
                  <th scope="col" className="px-3 py-3">
                  </th>
                </tr>
              </thead>
              <tbody>
                {projects &&
                  filteredProjects.map((_v, _i) => {
                    return (
                      <tr
                        key={"table" + _i}
                        className={`text-sm ${_i % 2 == 0 ? "bg-gray-dark/10" : "bg-gray-normal/10"}`}
                      >
                        <td className="px-3 py-2">
                          <div className="flex gap-1 items-center">
                            {ellipsisAddress(_v?.userName)}
                            {
                              copied["wallet_" + _i] ?
                                (<svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>) :
                                (<FaRegCopy className="w-3 h-3 transition ease-in-out transform cursor-pointer active:scale-95 duration-90" onClick={() => copyToClipboard("wallet_" + _i, _v?.userName)} />)
                            }
                          </div>
                        </td>
                        <td className="max-w-[200px] px-3 py-2 truncate">{_v?.name}</td>
                        <td className="px-3 py-2">{_v?.platform}</td>
                        <td className={`px-3 py-2 uppercase !text-xxs w-fit ${_v.paymentId <= 1 ? "" : _v.paymentId <= 2 ? "text-yellow-normal" : "text-blue-primary"}`}>
                          {ENV.PAYMENT_OPTIONS[_v.paymentId].title}
                        </td>
                        <td className="px-3 py-2">{_v?.token?.name ? _v?.token?.name : ""}</td>
                        <td className="px-3 py-2">{_v?.token?.symbol ? _v?.token?.symbol : ""}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1 items-center">
                            {_v?.token?.address ? ellipsisAddress(_v?.token?.address, false) : ""}
                            {
                              _v?.token?.address && (
                                copied["ca_" + _i] ?
                                  (<svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>) :
                                  (<FaRegCopy className="w-3 h-3 transition ease-in-out transform cursor-pointer active:scale-95 duration-90" onClick={() => copyToClipboard("ca_" + _i, _v?.token?.address)} />)
                              )
                            }
                          </div>
                        </td>
                        <td className="px-3 py-2">{new Date(_v?.timestamp).toLocaleString()}</td>
                        <td className="pl-3 py-2">
                          <div
                            className="w-full h-full rounded-md bg-[#09ca96] flex justify-center items-center p-2 cursor-pointer"
                            onClick={() => onClickProject(_i)}
                          >
                            Go To Project
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            {
              filteredProjects.length == 0 &&
              <div className="w-full h-full flex flex-col justify-center items-center">
                <div className="text-base text-white">No projects.</div>
              </div>
            }
          </div>
        </div>
        <NewProjectDialog
          isOpen={newProjectDialog}
          createProject={handleCreateNewProject}
          checkProject={handleCheckNewProject}
          onDone={handleDoneCreatingNewProject}
          onCancel={() => setNewProjectDialog(false)}
          initialData={{ step: -1, projectName: "" }}
        />
        <SetJitoTipDialog
          isOpen={changeJitoTip}
          onOK={setJitoTip}
          onClose={() => setChangeJitoTip(false)}
          title={"Set Bundle Tip"}
        />
      </div>
    </div >
  );
}
