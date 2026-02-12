import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { FaCheck, FaEye, FaTrash } from "react-icons/fa";
import { IoIosAdd, IoIosRefresh } from "react-icons/io";
import axios from "axios";

import { AppContext } from "../App";
import NewProjectDialog from "../components/Dialogs/NewProjectDialog";
import ConfirmDialog from "../components/Dialogs/ConfirmDialog";
import TopBar from "../components/TopBar/TopBar";

export default function AdminProjectsPage({ className }) {
  const {
    SERVER_URL,
    setLoadingPrompt,
    setOpenLoading,
    user,
    projects,
    setProjects,
    setCurrentProject,
    loadAllProjects,
    sigData,
    signingData
  } = useContext(AppContext);
  const navigate = useNavigate();

  const [confirmDialog, setConfirmDialog] = useState(false);
  const [confirmDialogTitle, setConfirmDialogTitle] = useState("");
  const [confirmDialogMessage, setConfirmDialogMessage] = useState("");
  const [confirmDialogAction, setConfirmDialogAction] = useState("");

  const [newProjectDialog, setNewProjectDialog] = useState(false);

  const [selectedProject, setSelectedProject] = useState(null);

  const handleConfirmDialogOK = async () => {
    setSelectedProject(null);
    setConfirmDialog(false);

    const accessToken = localStorage.getItem("access-token");
    if (confirmDialogAction === "activate-project") {
      setLoadingPrompt("Activating project...");
      setOpenLoading(true);
      try {
        const { data } = await axios.post(
          `${SERVER_URL}/api/v1/project/activate`,
          {
            projectId: selectedProject._id,
            sigData,
            signingData
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        if (data.projects) setProjects(data.projects);
        toast.success("Project has been activated successfully");
      } catch (err) {
        console.log(err);
        toast.warn("Failed to activate project");
      }
      setOpenLoading(false);
    } else if (confirmDialogAction === "delete-project") {
      setLoadingPrompt("Deleting project...");
      setOpenLoading(true);
      try {
        const { data } = await axios.post(
          `${SERVER_URL}/api/v1/project/delete`,
          {
            projectId: selectedProject._id,
            sigData,
            signingData
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        if (data.projects) setProjects(data.projects);
        toast.success("Project has been deleted successfully");
      } catch (err) {
        console.log(err);
        toast.warn("Failed to delete project");
      }
      setOpenLoading(false);
    }
  };

  const handleActivateProject = (project) => {
    setSelectedProject(project);
    setConfirmDialogTitle("Activate Project");
    setConfirmDialogMessage(
      `Are you sure that you want to activate "${project.name}"?`
    );
    setConfirmDialogAction("activate-project");
    setConfirmDialog(true);
  };

  const handleDeleteProject = (project) => {
    setSelectedProject(project);
    setConfirmDialogTitle("Delete Project");
    setConfirmDialogMessage(
      `Are you sure that you want to delete "${project.name}"?`
    );
    setConfirmDialogAction("delete-project");
    setConfirmDialog(true);
  };

  const handleViewProject = (project) => {
    setCurrentProject(project);
    if (project.status === "OPEN") navigate("/buy");
    else navigate("/sell");
  };

  const handleCreateNewProject = async (
    name,
    tokenAddress,
    payPackage,
    platform
  ) => {
    console.log("Creating new project...", name, tokenAddress, payPackage, platform);
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

  return (
    <div className={`w-screen h-screen flex flex-col items-center`}>
      <TopBar noProject={true} />
      <ConfirmDialog
        isOpen={confirmDialog}
        title={confirmDialogTitle}
        message={confirmDialogMessage}
        onOK={handleConfirmDialogOK}
        onCancel={() => setConfirmDialog(false)}
      />
      <NewProjectDialog
        isOpen={newProjectDialog}
        createProject={handleCreateNewProject}
        checkProject={handleCheckNewProject}
        onDone={handleDoneCreatingNewProject}
        onCancel={() => setNewProjectDialog(false)}
        initialData={{ step: 0, projectName: "" }}
      />
      <div className="w-full h-[30%] grow overflow-auto px-32 py-3">
        <div className="flex items-center justify-between w-full h-auto mb-2 text-xs font-medium text-white uppercase">
          <div className="text-base">
            {user && user.role === "admin" ? "All Projects" : "My Projects"}
          </div>
          {user && user.role !== "admin" ? (
            <div className="flex items-center gap-2">
              <button
                className="pl-3 pr-4 h-button rounded-lg justify-center items-center gap-1 inline-flex bg-[#1A1A37] active:scale-95 transition duration-100 ease-in-out transform focus:outline-none text-xs font-medium text-center text-white uppercase disabled:text-gray-border disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                onClick={() => setNewProjectDialog(true)}
              >
                <IoIosAdd className="text-lg text-green-normal" />
                New
              </button>
              <button
                className="pl-3 pr-4 h-button rounded-lg justify-center items-center gap-1 inline-flex bg-[#1A1A37] active:scale-95 transition duration-100 ease-in-out transform focus:outline-none text-xs font-medium text-center text-white uppercase disabled:text-gray-border disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                onClick={() => loadAllProjects()}
              >
                <IoIosRefresh className="text-lg text-green-normal" />
                Refresh
              </button>
            </div>
          ) : (
            <button
              className="pl-3 pr-4 h-button rounded-lg justify-center items-center gap-1 inline-flex bg-[#1A1A37] active:scale-95 transition duration-100 ease-in-out transform focus:outline-none text-xs font-medium text-center text-white uppercase disabled:text-gray-border disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              onClick={() => loadAllProjects()}
            >
              <IoIosRefresh className="text-lg text-green-normal" />
              Refresh
            </button>
          )}
        </div>
        <div className="relative flex flex-col w-full overflow-x-hidden text-white bg-transparent border border-gray-highlight rounded-lg">
          <table className="w-full text-xs">
            <thead className=" text-gray-normal">
              <tr className="uppercase bg-[#1A1A37] h-7">
                <th className="w-8">#</th>
                {user && user.role === "admin" && (
                  <th className="">User Name</th>
                )}
                <th className="">
                  {user && user.role === "admin" ? "Project Name" : "Name"}
                </th>
                <th className="">Status</th>
                <th className="w-[20%]">Action</th>
              </tr>
            </thead>
            <tbody className="text-xs text-gray-normal">
              {projects.map((item, index) => {
                return (
                  <tr
                    className={`${index % 2 === 1 && "bg-[#ffffff02]"
                      } hover:bg-[#ffffff05] h-8`}
                    key={`project${index}`}
                  >
                    <td className="text-center">{index + 1}</td>
                    {user && user.role === "admin" && (
                      <td className="text-center">{item.userName}</td>
                    )}
                    <td className="text-center text-white">{item.name}</td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${(() => {
                            switch (item.status) {
                              case "INIT":
                                return "bg-white";
                              case "EXPIRED":
                                return "bg-gray-normal";
                              case "TRADE":
                                return "bg-green-normal";
                              default:
                                return "bg-green-normal";
                            }
                          })()}`}
                        ></div>
                        {item.status}
                      </div>
                    </td>
                    <td className="text-center">
                      <div className="flex justify-center gap-1">
                        {item.status === "INIT" || item.status === "EXPIRED" ? (
                          <button
                            className="relative flex items-center justify-center px-2 h-6 text-xxxs transition ease-in-out transform font-medium rounded-[2px] cursor-pointer active:scale-95 duration-100 bg-gray-highlight text-gray-normal hover:bg-gray-border hover:text-white uppercase"
                            onClick={() => handleActivateProject(item)}
                          >
                            <FaCheck className="mr-2 text-xxs text-green-normal" />
                            Activate
                          </button>
                        ) : (
                          // (user && user.role === "admin" && !user.privilege) ? (<></>) :
                          <button
                            className="relative flex items-center justify-center px-2 h-6 text-xxxs transition ease-in-out transform font-medium rounded-[2px] cursor-pointer active:scale-95 duration-100 bg-gray-highlight text-gray-normal hover:bg-gray-border hover:text-white uppercase"
                            onClick={() => handleViewProject(item)}
                          >
                            <FaEye className="mr-2 text-xxs text-green-normal" />
                            Go to project
                          </button>
                        )}
                        {
                          // (user && user.role === "admin" && !user.privilege) ? (<></>) : (
                          <button
                            className="relative flex items-center justify-center px-2 h-6 text-xxxs transition ease-in-out transform rounded-[2px] font-medium cursor-pointer active:scale-95 duration-100 bg-gray-highlight text-gray-normal hover:bg-gray-border hover:text-white uppercase"
                            onClick={() => handleDeleteProject(item)}
                          >
                            <FaTrash className="mr-2 text-xxs text-green-normal" />
                            Delete
                          </button>
                          // )
                        }
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {projects.length === 0 && (
            <div className="my-3 text-sm font-bold text-center text-gray-700 uppercase">
              No Project
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
