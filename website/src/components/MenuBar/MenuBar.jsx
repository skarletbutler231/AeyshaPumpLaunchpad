import { useContext, useEffect, useRef } from "react";
import { AppContext } from "../../App";
import { useNavigate } from "react-router-dom";
import Logo from "../../assets/imgs/mark-white-text.png";
import {
  FaAngleDown,
  FaAngleRight,
  FaAngleUp,
  FaMailBulk,
  FaMixer,
  FaMoneyCheck,
  FaRProject,
  FaRobot,
  FaTicketAlt,
  FaCalculator,
  FaUser,
  FaUserSecret,
  FaWallet,
  FaCoins,
  FaTv,
  FaBurn,
} from "react-icons/fa";
import Collapsible from "react-collapsible";
import "../../styles/font.css"
import "../../styles/gradient.css"
import { menu_mark, targetedUrls } from "../../config/themeConfig";

const MenuBar = () => {
  const { showMenu, setShowMenu, user, setUser, currentProject, setCurrentProject } =
    useContext(AppContext);
  const navigate = useNavigate();
  const timeoutRef = useRef(null);

  const handleMouseEnter = () => {
    clearTimeout(timeoutRef.current);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setShowMenu(false);
    }, 1000);
  };

  const handleArrowClick = () => {
    setShowMenu((p) => !p);
  };

  const handleLogout = () => {
    setShowMenu(false);
    localStorage.removeItem("access-token");
    localStorage.removeItem("user-info");
    localStorage.removeItem("user-signature");
    setUser(null);
  };

  useEffect(() => {
    return () => {
      clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div
      className={`fixed font-conthrax top-0 left-0 w-[290px] h-full pb-4 z-50 flex flex-col justify-between bg-[#171A1F] border border-solid border-white/20 transition-transform ease-in-out duration-500 delay-75 translate-x-[-100%] focu ${showMenu ? "!translate-x-0" : ""}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="absolute right-[-12px] top-12 w-6 h-6 rounded-large bg-[#171A1F] border border-solid border-gray-border flex items-center justify-center cursor-pointer"
        onClick={handleArrowClick}
      >
        <img
          src={
            showMenu
              ? "/assets/icon/ic_arrow_left.svg"
              : "/assets/icon/ic_arrow_right.svg"
          }
          alt="arrow"
        />
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-3xl mx-auto my-1 text-left">
          <img className="h-20 w-auto" src={menu_mark} />
        </div>
        {user && user.role !== "user" && user.role !== "free" && (
          <Collapsible
            trigger={
              <div className={`pl-4 pr-9 font-medium h-10 flex gap-2.5 items-center justify-between cursor-pointer hover:bg-[url(${targetedUrls.menuBg})] hover:bg-no-repeat bg-full`}>
                <div className="flex gap-2.5 items-center">
                  <FaUserSecret className="p-1 w-6 h-6" /> Administrator
                </div>
                <FaAngleRight />
              </div>
            }
            triggerWhenOpen={
              <div className={`pl-4 pr-9 font-medium h-10 flex gap-2.5 items-center justify-between cursor-pointer hover:bg-[url(${targetedUrls.menuBg})] hover:bg-no-repeat bg-full`}>
                <div className="flex gap-2.5 items-center">
                  <FaUserSecret className="p-1 w-6 h-6" /> Administrator
                </div>
                <FaAngleDown />
              </div>
            }
          >
            {/* Content to be collapsed or expanded */}
            <div className="flex flex-col">
              <div
                className={`pl-4 pr-9 font-medium h-10 flex gap-2.5 items-center cursor-pointer hover:bg-[url(${targetedUrls.menuBg})] hover:bg-no-repeat bg-full`}
                onClick={() => {
                  navigate("/admin-user");
                  setShowMenu(false);
                }}
              >
                <FaUser className="ml-2.5 p-1 w-6 h-6" /> Users
              </div>
              <div
                className={`pl-4 pr-9 font-medium h-10 flex gap-2.5 items-center cursor-pointer hover:bg-[url(${targetedUrls.menuBg})] hover:bg-no-repeat bg-full`}
                onClick={() => {
                  navigate("/admin-project");
                  setShowMenu(false);
                }}
              >
                <FaRProject className="ml-2.5 p-1 w-6 h-6" /> Projects
              </div>
              {user.privilege && (
                <>
                  {/* <div
                    className="pl-4 pr-9 font-medium h-10 flex gap-2.5 items-center cursor-pointer hover:bg-[url(${targetedUrls.menuBg})] hover:bg-no-repeat bg-full"
                    onClick={() => {
                      navigate("/admin-anti-drainer");
                      setShowMenu(false);
                    }}
                  >
                    <FaShieldAlt className="ml-2.5 p-1 w-6 h-6" /> Anti Drainers
                  </div> */}
                  <div
                    className={`pl-4 pr-9 font-medium h-10 flex gap-2.5 items-center cursor-pointer hover:bg-[url(${targetedUrls.menuBg})] hover:bg-no-repeat bg-full`}
                    onClick={() => {
                      navigate("/admin-extra-wallet");
                      setShowMenu(false);
                    }}
                  >
                    <FaWallet className="ml-2.5 p-1 w-6 h-6" /> Extra Wallets
                  </div>
                  <div
                    className={`pl-4 pr-9 font-medium h-10 flex gap-2.5 items-center cursor-pointer hover:bg-[url(${targetedUrls.menuBg})] hover:bg-no-repeat bg-full`}
                    onClick={() => {
                      navigate("/admin-email");
                      setShowMenu(false);
                    }}
                  >
                    <FaMailBulk className="ml-2.5 p-1 w-6 h-6" /> Emails
                  </div>
                  <div
                    className={`pl-4 pr-9 font-medium h-10 flex gap-2.5 items-center cursor-pointer hover:bg-[url(${targetedUrls.menuBg})] hover:bg-no-repeat bg-full`}
                    onClick={() => {
                      navigate("/admin-zombie-wallet");
                      setShowMenu(false);
                    }}
                  >
                    <FaMoneyCheck className="ml-2.5 p-1 w-6 h-6" /> Zombies
                  </div>
                </>
              )}
              <div
                className={`pl-4 pr-9 font-medium h-10 flex gap-2.5 items-center cursor-pointer hover:bg-[url(${targetedUrls.menuBg})] hover:bg-no-repeat bg-full`}
                onClick={() => {
                  navigate("/admin-finance");
                  setShowMenu(false);
                }}
              >
                <FaMoneyCheck className="ml-2.5 p-1 w-6 h-6" /> Finance
              </div>
            </div>
          </Collapsible>
        )}
        <div
          className={`pl-4 font-medium h-10 flex gap-2.5 items-center cursor-pointer hover:bg-[url(${targetedUrls.menuBg})] hover:bg-no-repeat hover:bg-full bg-full`}
          onClick={() => {
            navigate("/dashboard");
            setShowMenu(false);
          }}
        >
          <FaTv className="p-1 w-6 h-6" />
          Dashboard
        </div>
        <Collapsible
          trigger={
            <div className={`pl-4 pr-9 font-medium h-10 flex gap-2.5 items-center justify-between cursor-pointer hover:bg-[url(${targetedUrls.menuBg})] hover:bg-no-repeat bg-full`}>
              <div className="flex gap-2.5 items-center">
                <img
                  src="/assets/icon/ic_launch.svg"
                  className="p-1 w-6 h-6"
                  alt="dashboard"
                />{" "}
                Deploy & Bundle Token
              </div>
              <FaAngleDown />
            </div>
          }
          triggerWhenOpen={
            <div className={`pl-4 pr-9 font-medium h-10 flex gap-2.5 items-center justify-between cursor-pointer hover:bg-[url(${targetedUrls.menuBg})] hover:bg-no-repeat bg-full`}>
              <div className="flex gap-2.5 items-center">
                <img
                  src="/assets/icon/ic_launch.svg"
                  className="p-1 w-6 h-6"
                  alt="dashboard"
                />{" "}
                Deploy & Bundle Token
              </div>
              <FaAngleUp />
            </div>
          }
        >
          {/* Content to be collapsed or expanded */}
          <div className="flex flex-col">
            <div
              className={`pl-12 pr-9 font-medium h-10 flex gap-2.5 items-center justify-between cursor-pointer hover:bg-[url(${targetedUrls.menuBg})] hover:bg-no-repeat bg-full`}
              onClick={() => {
                navigate("/raydium-token-launch");
                setShowMenu(false);
              }}
            >
              Raydium Token Creation
            </div>
            <div
              className={`pl-12 pr-9 font-medium h-10 flex gap-2.5 items-center justify-between cursor-pointer hover:bg-[url(${targetedUrls.menuBg})] hover:bg-no-repeat bg-full`}
              onClick={() => {
                navigate("/raydium-fair-launch");
                setShowMenu(false);
              }}
            >
              Raydium Fair Launch
            </div>
            <div
              className={`pl-12 pr-9 font-medium h-10 flex gap-2.5 items-center justify-between cursor-pointer hover:bg-[url(${targetedUrls.menuBg})] hover:bg-no-repeat bg-full`}
              onClick={() => {
                navigate("/raydium-cpmm-launch");
                setShowMenu(false);
              }}
            >
              Raydium Cpmm Launch
            </div>
            <div
              className={`pl-12 pr-9 font-medium h-10 flex gap-2.5 items-center justify-between cursor-pointer hover:bg-[url(${targetedUrls.menuBg})] hover:bg-no-repeat bg-full`}
              onClick={() => {
                navigate("/raydium-launchlab-launch");
                setShowMenu(false);
              }}
            >
              Raydium Launchlab Launch
            </div>
            <div
              className={`pl-12 pr-9 font-medium h-10 flex gap-2.5 items-center justify-between cursor-pointer hover:bg-[url(${targetedUrls.menuBg})] hover:bg-no-repeat bg-full`}
              onClick={() => {
                navigate("/pumpfun-token-launch");
                setShowMenu(false);
              }}
            >
              Pump.fun Token Creation
            </div>
            {/* <div
              className={`pl-12 pr-9 font-medium h-10 flex gap-2.5 items-center justify-between cursor-pointer hover:bg-[url(${targetedUrls.menuBg})] hover:bg-no-repeat bg-full`}
              onClick={() => {
                navigate("/pumpfun-ghost-bundle");
                setShowMenu(false);
              }}
            >
              Pump.fun Ghost Bundle
            </div> */}
          </div>
        </Collapsible>
        {Object.keys(currentProject).length > 0 &&
          currentProject.constructor === Object &&
          currentProject?.token?.address != "" ? (
          <div
            className={`pl-4 font-medium h-10 flex gap-2.5 items-center cursor-pointer hover:bg-[url(${targetedUrls.menuBg})] hover:bg-no-repeat bg-full`}
            onClick={() => {
              navigate("/bundle");
              setShowMenu(false);
            }}
          >
            <img
              src="/assets/icon/ic_bundle.svg"
              className="p-1 w-6 h-6"
              alt="dashboard"
            />{" "}
            Bundler
          </div>
        ) : (
          <div className={`pl-4 text-gray-normal font-medium h-10 flex gap-2.5 items-center cursor-pointer hover:bg-no-repeat bg-full`}>
            <img
              src="/assets/icon/ic_bundle.svg"
              className="p-1 w-6 h-6"
              alt="dashboard"
            />{" "}
            Bundler
          </div>
        )}
        {Object.keys(currentProject).length > 0 &&
          currentProject.constructor === Object &&
          currentProject.platform == "token-2022" &&
          currentProject.status == "TRADE" && (
            <div
              className={`pl-4 font-medium h-10 flex gap-2.5 items-center cursor-pointer hover:bg-[url(${targetedUrls.menuBg})] hover:bg-no-repeat bg-full`}
              onClick={() => {
                navigate("/token-2022");
                setShowMenu(false);
              }}
            >
              <FaBurn className="p-1 w-6 h-6" />
              Token 2022
            </div>
          )}
        <div
          className={`pl-4 font-medium h-10 flex gap-2.5 items-center cursor-pointer hover:bg-[url(${targetedUrls.menuBg})] hover:bg-no-repeat bg-full`}
          onClick={() => {
            navigate("/token-account");
            setShowMenu(false);
          }}
        >
          <img
            src="/assets/icon/ic_contract.svg"
            className="p-1 w-6 h-6"
            alt="dashboard"
          />{" "}
          Contract Management
        </div>
        <Collapsible
          trigger={
            <div className={`pl-4 pr-9 font-medium h-10 flex gap-2.5 items-center justify-between cursor-pointer hover:bg-[url(${targetedUrls.menuBg})] hover:bg-no-repeat bg-full`}>
              <div className="flex gap-2.5 items-center">
                <img
                  src="/assets/icon/ic_tools.svg"
                  className="p-1 w-6 h-6"
                  alt="dashboard"
                />{" "}
                Tools
              </div>
              <FaAngleDown />
            </div>
          }
          triggerWhenOpen={
            <div className={`pl-4 pr-9 font-medium h-10 flex gap-2.5 items-center justify-between cursor-pointer hover:bg-[url(${targetedUrls.menuBg})] hover:bg-no-repeat bg-full`}>
              <div className="flex gap-2.5 items-center">
                <img
                  src="/assets/icon/ic_tools.svg"
                  className="p-1 w-6 h-6"
                  alt="dashboard"
                />{" "}
                Tools
              </div>
              <FaAngleUp />
            </div>
          }
        >
          {/* Content to be collapsed or expanded */}
          <div className="flex flex-col">
            <div className={`pl-4 pr-9 font-medium text-gray-normal h-10 flex gap-2.5 items-center justify-between cursor-pointer`}>
              <div className="ml-2.5 flex gap-2.5 items-center">
                <FaMixer className="p-1 w-6 h-6" /> Cross Chain Mixer
              </div>
              <FaAngleDown />
            </div>
            <div className={`pl-4 pr-9 font-medium text-gray-normal h-10 flex gap-2.5 items-center cursor-pointer`}>
              <FaTicketAlt className="ml-2.5 p-1 w-6 h-6" /> Sniper
            </div>
            <div className={`pl-4 pr-9 font-medium text-gray-normal h-10 flex gap-2.5 items-center cursor-pointer`}>
              <FaRobot className="ml-2.5 p-1 w-6 h-6" /> MEV Bot
            </div>
            <div className={`pl-4 pr-9 font-medium text-white h-10 flex gap-2.5 items-center cursor-pointer hover:bg-[url(${targetedUrls.menuBg})] hover:bg-no-repeat bg-full`}
              onClick={() => {
                navigate("/mc-calculator");
                setShowMenu(false);
              }}
            >
              <FaCalculator className="ml-2.5 p-1 w-6 h-6" /> MC Calculator
            </div>
          </div>
        </Collapsible>
        <div
          className={`pl-4 font-medium h-10 flex gap-2.5 items-center cursor-pointer hover:bg-[url(${targetedUrls.menuBg})] hover:bg-no-repeat bg-full`}
          onClick={() => {
            navigate("/faq");
            setShowMenu(false);
          }}
        >
          <img
            src="/assets/icon/ic_faq.svg"
            className="p-1 w-6 h-6"
            alt="dashboard"
          />{" "}
          FAQ
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div
          className={`pl-4 font-medium h-10 flex gap-2.5 items-center cursor-pointer hover:bg-[url(${targetedUrls.menuBg})] hover:bg-no-repeat bg-full`}
          onClick={() => {
            navigate("/myaccount");
            setShowMenu(false);
            setCurrentProject({})
          }}
        >
          <FaUser className="w-6 h-6 p-1" />
          My Account
        </div>
        <div
          className={`pl-4 font-medium h-10 flex gap-2.5 items-center cursor-pointer hover:bg-[url(${targetedUrls.menuBg})] hover:bg-no-repeat bg-full`}
          onClick={handleLogout}
        >
          <img
            src="/assets/icon/ic_page_logout.png"
            className="p-1 w-6 h-6"
            alt="dashboard"
          />{" "}
          Exit
        </div>
      </div>
    </div>
  );
};

export default MenuBar;
