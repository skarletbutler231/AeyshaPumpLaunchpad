import { createRoot } from 'react-dom/client'
import { BrowserRouter } from "react-router-dom";
import App from './App.jsx'
import './index.css'

import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";

import WalletProvider from './components/WalletProvider';
import Buffer from 'buffer'

window.Buffer = window.Buffer || Buffer.Buffer;

createRoot(document.getElementById('root')).render(
  <WalletProvider>
    <BrowserRouter>
      <App />
      <ToastContainer
        theme="dark"
        position="top-right"
        pauseOnFocusLoss={false}
        autoClose={2500}
        toastClassName="bg-black text-white"
        pauseOnHover={false}
        stacked
      />
    </BrowserRouter>
  </WalletProvider>
)
