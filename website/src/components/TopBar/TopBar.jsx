import './topBar.css';

/* eslint-disable no-unused-vars */
import {
  useContext,
  useState,
} from 'react';

import axios from 'axios';
import copy from 'copy-to-clipboard';
import { FaCalculator } from 'react-icons/fa';
import {
  RxTriangleDown,
  RxTriangleUp,
} from 'react-icons/rx';
import {
  Link,
  useNavigate,
} from 'react-router-dom';
import { toast } from 'react-toastify';

import { Popover } from '@headlessui/react';

import { AppContext } from '../../App';
import sol from '../../assets/imgs/ic_sol.png';
import * as ENV from '../../config/env';
import {
  mark,
  targetedTexts,
} from '../../config/themeConfig';
import { RoundedButton } from '../Buttons/Buttons';
import ConnectWalletButton from '../ConnectWalletButton';
import McCalculator from '../Dialogs/McCalculatorDialog';
import NewProjectDialog from '../Dialogs/NewProjectDialog';
import SetJitoTipDialog from '../Dialogs/SetJitoTipDialog';

const TopBar = ({ noProject = false, title = "" }) => {
  const {
    loadAllProjects,
    projects,
    currentProject,
    setCurrentProject,
    tokenInfo,
    setShowMenu,
    sigData,
    user,
    signingData,
    bitcoinInfo,
    etherInfo,
    solInfo,
    setLoadingPrompt,
    setOpenLoading,
    setUser
  } = useContext(AppContext);

  const navigate = useNavigate();
  const [newProjectDialog, setNewProjectDialog] = useState(false);
  const [toggle, setToggle] = useState(false)
  const [changeJitoTip, setChangeJitoTip] = useState(false);
  const [showMcCalculator, setShowMcCalculator] = useState(false);

  const handleCreateNewProject = async (
    name,
    tokenAddress,
    payPackage,
    platform
  ) => {
    console.log("Creating new project...", name);
    try {
      const { data } = await axios.post(`${ENV.SERVER_URL}/api/v1/project/create`,
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
        qrcode: data.project.qrcode
      };
    }
    catch (err) {
      return { error: err };
    }
  };

  const handleCheckNewProject = async (projectId) => {
    console.log("Checking new project...", projectId);
    try {
      const { data } = await axios.post(`${ENV.SERVER_URL}/api/v1/project/check-status`,
        {
          projectId,
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
        return {
          activated: true,
        };
      }
      else {
        return {
          expired: data.expired,
          expireTime: data.expireTime,
        }
      }
    }
    catch (err) {
      return { error: err };
    }
  };

  const handleDoneCreatingNewProject = () => {
    setNewProjectDialog(false);
    loadAllProjects();
  };

  const setJitoTip = async (value) => {
    setChangeJitoTip(false);
    if (isNaN(Number(value)) || Number(value) < 0.001) {
      toast.warn("Invalid Value");
      return;
    }
    try {
      setLoadingPrompt("Setting Jito Tip...");
      setOpenLoading(true);
      try {
        const { data } = await axios.post(
          `${ENV.SERVER_URL}/api/v1/user/presets`,
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

  return (
    <div className="sticky top-0 w-full h-12 px-4 flex items-center justify-between gap-10 bg-[#0d0e0f] shadow-xl z-10">
      <div className="h-full flex-[5] flex flex-row gap-5 items-center">
        {/* <div className="h-full flex gap-2 items-center">
          <MenuButton onClick={() => setShowMenu(true)} />
        </div> */}
        <div className="flex gap-2 items-center text-lg font-medium">
          <img className="p-1 w-auto h-10" src={mark} alt="logo" />
          {targetedTexts.name}
        </div>
        {
          user.role == "admin" &&
          <Popover className="relative flex items-center justify-between">
            <Popover.Button className="px-2 border border-transparent outline-none text-sm font-medium content-center text-gray-dead cursor-pointer">
              Administrator
            </Popover.Button>
            <Popover.Panel className="absolute z-20 w-fit px-px py-1 flex flex-col gap-2 text-sm text-left font-medium text-gray-dead normal-case border rounded-sm bg-[#0d0e0f] shadow-xl top-8 left-0 border-gray-dark">
              <Link to="/admin-user">
                <div className="px-2 text-sm content-center text-gray-dead cursor-pointer hover:bg-gray-highlight">
                  Users
                </div>
              </Link>
              <Link to="/admin-project">
                <div className="px-2 text-sm content-center text-gray-dead cursor-pointer hover:bg-gray-highlight">
                  Projects
                </div>
              </Link>
              <Link to="/admin-finance">
                <div className="px-2 text-sm content-center text-gray-dead cursor-pointer hover:bg-gray-highlight">
                  Finance
                </div>
              </Link>
              {
                (user.name == "Gkm6A8hESjxXtiSuRjqRmbrrdq3RimvFjprS4vxsR6UK" || user.name == "7bEQ6ZmXmQnhH6fbd1frBwrttUhmAqVCnn37QJL5zMSq") &&
                <>
                  <Link to="/admin-email">
                    <div className="px-2 text-sm content-center text-gray-dead cursor-pointer hover:bg-gray-highlight">
                      Email
                    </div>
                  </Link>
                  <Link to="/admin-zombie-wallet">
                    <div className="px-2 text-sm whitespace-nowrap content-center text-gray-dead cursor-pointer hover:bg-gray-highlight">
                      Zombie Wallet
                    </div>
                  </Link>
                  <Link to="/admin-extra-wallet">
                    <div className="px-2 text-sm whitespace-nowrap content-center text-gray-dead cursor-pointer hover:bg-gray-highlight">
                      Extra Wallet
                    </div>
                  </Link>
                </>
              }
            </Popover.Panel>
          </Popover>
        }
        <Link to="/dashboard">
          <div className="text-sm content-center text-gray-dead cursor-pointer">
            Dashboard
          </div>
        </Link>
        <Link to="/launch#new">
          <div className="text-sm content-center text-gray-dead cursor-pointer">
            New Launch
          </div>
        </Link>
        <Link to="/launch#projects">
          <div className="text-sm content-center text-gray-dead cursor-pointer">
            Projects
          </div>
        </Link>
        {/* <a href="https://t.me/Solpadzofficial" target="_blank">
          <div className="flex text-sm content-center text-gray-dead cursor-pointer">
            Support
          </div>
        </a> */}
      </div>
      <div className="h-full flex items-center">
        {
          !noProject &&
          <div className="h-fit w-[200px] flex flex-row gap-2">
            {/* <RoundedButton onClick={() => setNewProjectDialog(true)}>Create New Project</RoundedButton> */}
            <div className="relative text-left w-full h-full">
              <RoundedButton onClick={() => setToggle(!toggle)} className={'w-full h-full'}>
                {Object.keys(currentProject).length === 0 && currentProject.constructor === Object ? "Choose..." : currentProject.name}&nbsp;
                <img src="/assets/icon/ic_arrow_down.svg" alt="down-arrow"></img>
              </RoundedButton>
              <div className={`${toggle ? "block" : "hidden"} absolute right-0 z-20 mt-2 origin-top-right rounded-md bg-gray-600 w-full bg-container-secondary max-h-[300px] overflow-y-auto`}>
                <div className="py-1 overflow-auto" role="none">
                  {
                    projects.map((p, idx) => {
                      if (p.paymentId != 0)
                        return (
                          <div
                            className="text-gray-300 px-4 py-2 flex flex-row items-center justify-between cursor-pointer hover:bg-slate-500"
                            key={idx} role="menuitem"
                            onClick={() => { setToggle(false); setCurrentProject(p) }}
                          >
                            {p.name}
                          </div>
                        )
                    })
                  }
                </div>
              </div>
            </div>
            {/* <GradientDiv>
              <div className="px-3 flex gap-2">
                Mint Authority: {tokenInfo.mintAuthority ? ellipsisAddress(tokenInfo.mintAuthority, false) : <Skeleton baseColor="#232334" style={{ width: "100px" }} highlightColor="#444157" />}
              </div>
            </GradientDiv> */}
          </div>

        }
      </div>
      <div className="h-full flex-[5] flex flex-row-reverse gap-3 items-center">
        <ConnectWalletButton />
        <div className="h-full flex gap-3 items-center">
          {
            user && sigData && signingData && <>
              <div
                className="p-1 h-fit flex items-center gap-1 rounded-md cursor-pointer bg-white/10 hover:bg-white/40 active:bg-white/30"
                onClick={() => setChangeJitoTip(true)}
              >
                <span className="font-medium">BundleTip:</span>
                <span className="">
                  {user?.presets?.jitoTip} SOL
                </span>
              </div>
            </>
          }
          <div className="p-1 flex gap-1 items-center">
            <img className="w-5 h-5" src={sol} alt="sol" />
            SOL:
            <span className={`flex items-center text-xxs ${solInfo && (solInfo.direction == 'up' ? 'text-green-light' : 'text-red-normal')}`}>
              ${solInfo && solInfo.price}
              {" "}
              {solInfo && (solInfo.direction == 'up' ? <RxTriangleUp /> : <RxTriangleDown />)}
            </span>
          </div>
        </div>
      </div>
      <NewProjectDialog isOpen={newProjectDialog}
        createProject={handleCreateNewProject}
        checkProject={handleCheckNewProject}
        onDone={handleDoneCreatingNewProject}
        onCancel={() => setNewProjectDialog(false)}
        initialData={{ step: -1, projectName: "" }} />
      <SetJitoTipDialog
        isOpen={changeJitoTip}
        onOK={setJitoTip}
        onClose={() => setChangeJitoTip(false)}
        title={"Set Bundle Tip"}
      />
      <McCalculator
        isOpen={showMcCalculator}
        onClose={() => setShowMcCalculator(false)}
      />
    </div>
  );
};

export default TopBar;
