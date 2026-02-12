import { useContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { FaRegCopy, FaTrash } from "react-icons/fa";
import { IoIosAdd, IoIosRefresh } from "react-icons/io";
import axios from "axios";

import { AppContext } from "../App";
import AddEmailDialog from "../components/Dialogs/AddEmailDialog";
import ConfirmDialog from "../components/Dialogs/ConfirmDialog";
import TopBar from "../components/TopBar/TopBar";

export default function AdminEmailsPage({ className }) {
  const {
    SERVER_URL,
    setLoadingPrompt,
    setOpenLoading,
    user,
    emails,
    setEmails,
    loadAllEmails,
    sigData,
    signingData
  } = useContext(AppContext);

  const [confirmDialog, setConfirmDialog] = useState(false);
  const [confirmDialogTitle, setConfirmDialogTitle] = useState("");
  const [confirmDialogMessage, setConfirmDialogMessage] = useState("");
  const [confirmDialogAction, setConfirmDialogAction] = useState("");

  const [addEmailDialog, setAddEmailDialog] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [copied, setCopied] = useState({});

  useEffect(() => {
    loadAllEmails()
  }, [])

  const copyToClipboard = async (key, text) => {
    if ("clipboard" in navigator) {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
      setCopied({
        ...copied,
        [key]: true,
      });
      setTimeout(
        () =>
          setCopied({
            ...copied,
            [key]: false,
          }),
        2000
      );
    } else console.error("Clipboard not supported");
  };

  const handleConfirmDialogOK = async () => {
    setSelectedProject(null);
    setConfirmDialog(false);

    const accessToken = localStorage.getItem("access-token");
    if (confirmDialogAction === "delete-email") {
      setLoadingPrompt("Deleting email...");
      setOpenLoading(true);
      try {
        const { data } = await axios.post(
          `${SERVER_URL}/api/v1/misc/delete-email`,
          {
            emailId: selectedEmail._id,
            sigData,
            signingData
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        if (data.emails) setEmails(data.emails);
        toast.success("Email has been deleted successfully");
      } catch (err) {
        console.log(err);
        toast.warn("Failed to delete email");
      }
      setOpenLoading(false);
    }
  };

  const handleDeleteEmail = (email) => {
    setSelectedEmail(email);
    setConfirmDialogTitle("Delete Email");
    setConfirmDialogMessage(
      `Are you sure that you want to delete "${email.email}"?`
    );
    setConfirmDialogAction("delete-email");
    setConfirmDialog(true);
  };

  const handleSaveEmail = async (name, email) => {
    console.log("Saving email...", name, email);
    setAddEmailDialog(false);

    setLoadingPrompt("Adding email...");
    setOpenLoading(true);
    try {
      const { data } = await axios.post(
        `${SERVER_URL}/api/v1/misc/add-email`,
        {
          name: name,
          email: email,
          sigData,
          signingData
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      setEmails(data.emails);
      toast.success("Email has been added successfully");
    } catch (err) {
      console.log(err);
      toast.warn("Failed to add email");
    }
    setOpenLoading(false);
  };

  return (
    <div className={`"w-screen h-screen flex flex-col items-center`}>
      <TopBar noProject={true} />
      <ConfirmDialog
        isOpen={confirmDialog}
        title={confirmDialogTitle}
        message={confirmDialogMessage}
        onOK={handleConfirmDialogOK}
        onCancel={() => setConfirmDialog(false)}
      />
      <AddEmailDialog
        isOpen={addEmailDialog}
        onOK={handleSaveEmail}
        onClose={() => setAddEmailDialog(false)}
      />
      {user.privilege && user && user.role === "admin" && (
        <div className="w-full h-[30%] grow overflow-auto px-32 py-3">
          <div className="flex items-center justify-between w-full h-auto mb-2 text-base font-medium text-white uppercase">
            <div className="">All Emails</div>
            <div className="flex items-center gap-2">
              <button
                className="pl-3 pr-4 h-button rounded-lg justify-center items-center gap-1 inline-flex bg-[#1A1A37] active:scale-95 transition duration-100 ease-in-out transform focus:outline-none text-xs font-medium text-center text-white uppercase disabled:text-gray-border disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                onClick={() => setAddEmailDialog(true)}
              >
                <IoIosAdd className="text-lg text-green-normal" />
                Add New Email
              </button>
              <button
                className="pl-3 pr-4 h-button rounded-lg justify-center items-center gap-1 inline-flex bg-[#1A1A37] active:scale-95 transition duration-100 ease-in-out transform focus:outline-none text-xs font-medium text-center text-white uppercase disabled:text-gray-border disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                onClick={() => loadAllEmails()}
              >
                <IoIosRefresh className="text-lg text-green-normal" />
                Refresh
              </button>
            </div>
          </div>
          <div className="relative flex flex-col w-full overflow-x-hidden text-white bg-transparent border border-gray-highlight rounded-lg">
            <table className="w-full text-xs">
              <thead className=" text-gray-normal">
                <tr className="uppercase h-7 bg-[#1A1A37] sticky top-0 z-10">
                  <th className="w-8">#</th>
                  <th className="">Name</th>
                  <th className="">Email</th>
                  <th className="w-[20%]">Action</th>
                </tr>
              </thead>
              <tbody className="text-gray-normal">
                {emails.map((item, index) => {
                  return (
                    <tr
                      key={index}
                      className={`${index % 2 === 1 && "bg-[#ffffff02]"
                        } hover:bg-[#ffffff08] h-7`}
                    >
                      <td className="text-center">{index + 1}</td>
                      <td className="text-center">{item.name}</td>
                      <td className="text-center text-white">
                        <div className="flex items-center justify-center gap-1 m-auto">
                          <p className="">{item.email}</p>
                          {copied["email_" + index] ? (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="w-3.5 h-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          ) : (
                            <FaRegCopy
                              className="text-gray-normal w-3.5 h-3.5 transition ease-in-out transform cursor-pointer active:scale-95 duration-100"
                              onClick={() =>
                                copyToClipboard("email_" + index, item.email)
                              }
                            />
                          )}
                        </div>
                      </td>
                      <td className="text-center">
                        <div className="flex justify-center">
                          <button
                            className="relative flex items-center justify-center px-2 h-6 text-xxs transition ease-in-out transform rounded-[2px] font-medium cursor-pointer active:scale-95 duration-100 bg-gray-highlight text-gray-normal hover:bg-gray-border hover:text-white uppercase"
                            onClick={() => handleDeleteEmail(item)}
                          >
                            <FaTrash className="mr-2 text-green-normal" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {emails.length === 0 && (
              <div className="my-3 text-sm font-bold text-center text-gray-700 uppercase">
                No Email
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
