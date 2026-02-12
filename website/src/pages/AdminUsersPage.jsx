import { useContext, useState } from "react";
import { toast } from "react-toastify";
import { FaTrash } from "react-icons/fa";
import { IoIosRefresh } from "react-icons/io";
import { MdOutlineTransferWithinAStation } from "react-icons/md";
import axios from "axios";

import { AppContext } from "../App";
import ConfirmDialog from "../components/Dialogs/ConfirmDialog";
import TopBar from "../components/TopBar/TopBar";

export default function AdminUsersPage({ className }) {
  const {
    SERVER_URL,
    setLoadingPrompt,
    setOpenLoading,
    user,
    users,
    setUsers,
    loadAllUsers,
    sigData,
    signingData
  } = useContext(AppContext);

  const [confirmDialog, setConfirmDialog] = useState(false);
  const [confirmDialogTitle, setConfirmDialogTitle] = useState("");
  const [confirmDialogMessage, setConfirmDialogMessage] = useState("");
  const [confirmDialogAction, setConfirmDialogAction] = useState("");
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  
  const handleConfirmDialogOK = async () => {
    setSelectedProject(null);
    setConfirmDialog(false);

    const accessToken = localStorage.getItem("access-token");
    if (confirmDialogAction === "delete-user") {
      setLoadingPrompt("Deleting user...");
      setOpenLoading(true);
      try {
        const { data } = await axios.post(
          `${SERVER_URL}/api/v1/user/delete`,
          {
            userId: selectedUser._id,
            sigData,
            signingData
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        if (data.users) setUsers(data.users);
        toast.success("User has been deleted successfully");
      } catch (err) {
        console.log(err);
        toast.warn("Failed to delete user");
      }
      setOpenLoading(false);
    } else if (confirmDialogAction === "switch-free-user") {
      setLoadingPrompt("Switching user role...");
      setOpenLoading(true);
      try {
        const { data } = await axios.post(
          `${SERVER_URL}/api/v1/user/switch-free`,
          {
            userId: selectedUser._id,
            sigData,
            signingData
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        if (data.users) setUsers(data.users);
        toast.success("User role has been changed successfully");
      } catch (err) {
        console.log(err);
        toast.warn("Failed to switch user role");
      }
      setOpenLoading(false);
    } 
  };

  const handleDeleteUser = (user) => {
    setSelectedUser(user);
    setConfirmDialogTitle("Delete User");
    setConfirmDialogMessage(
      `Are you sure that you want to delete "${user.name}"?`
    );
    setConfirmDialogAction("delete-user");
    setConfirmDialog(true);
  };

  const handleSwitchUser = (user) => {
    setSelectedUser(user);
    setConfirmDialogTitle("Switch User Role");
    setConfirmDialogMessage(
      `Are you sure that you want to switch the role of "${user.name}"?`
    );
    setConfirmDialogAction("switch-free-user");
    setConfirmDialog(true);
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
      {user && user.role === "admin" && (
        <div className="w-full h-[30%] grow overflow-auto px-32 py-3">
          <div className="flex items-center justify-between w-full h-auto mb-2 text-xs font-medium text-white uppercase">
            <div className="text-base">All Users</div>
            <button
              className="pl-3 pr-4 h-button rounded-lg justify-center items-center gap-1 inline-flex bg-[#1A1A37] active:scale-95 transition duration-100 ease-in-out transform focus:outline-none text-xs font-medium text-center text-white uppercase disabled:text-gray-border disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              onClick={() => loadAllUsers()}
            >
              <IoIosRefresh className="text-lg text-green-normal" />
              Refresh
            </button>
          </div>
          <div className="relative flex flex-col w-full overflow-x-hidden text-white bg-transparent border border-gray-highlight rounded-lg">
            <table className="w-full text-xs">
              <thead className=" text-gray-normal">
                <tr className="uppercase bg-[#1A1A37] h-7">
                  <th className="w-8">
                    <p className="leading-none text-center">#</p>
                  </th>
                  <th className="">
                    <p className="leading-none text-center">Name</p>
                  </th>
                  <th className="">
                    <p className="leading-none text-center">Role</p>
                  </th>
                  <th className="">
                    <p className="leading-none text-center">Code</p>
                  </th>
                  <th className="">
                    <p className="leading-none text-center">Referral</p>
                  </th>
                  <th className="w-[20%]">
                    <p className="leading-none text-center">Action</p>
                  </th>
                </tr>
              </thead>
              <tbody className="text-xs text-gray-normal">
                {users.map((item, index) => {
                  return (
                    <tr
                      key={index}
                      className={`${
                        index % 2 === 1 && "bg-[#ffffff02]"
                      } hover:bg-[#ffffff05] h-8`}
                    >
                      <td className="text-center">{index + 1}</td>
                      <td className="text-center text-white">{item.name}</td>
                      <td className="text-center">{item.role}</td>
                      <td className="text-center">{item.code}</td>
                      <td className="text-center">{item.referral}</td>
                      <td className="text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            className="relative flex items-center justify-center px-2 h-6 text-xxxs transition ease-in-out transform rounded-[2px] font-medium cursor-pointer active:scale-95 duration-100 bg-gray-highlight text-gray-normal hover:bg-gray-border hover:text-white uppercase"
                            onClick={() => handleSwitchUser(item)}
                          >
                            {/* <FaCheck /> */}
                            <MdOutlineTransferWithinAStation className="mr-2 text-xxs text-green-normal" />
                            Switch Role
                          </button>
                          {
                            // (user && user.role === "admin" && !user.privilege) ? (<></>) : (
                            <button
                              className="relative flex items-center justify-center px-2 h-6 text-xxxs transition ease-in-out transform rounded-[2px] font-medium cursor-pointer active:scale-95 duration-100 bg-gray-highlight text-gray-normal hover:bg-gray-border hover:text-white uppercase"
                              onClick={() => handleDeleteUser(item)}
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
            {users.length === 0 && (
              <div className="my-3 text-sm font-bold text-center text-gray-700 uppercase">
                No User
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
