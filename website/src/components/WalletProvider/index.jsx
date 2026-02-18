import { useMemo } from "react";
import { clusterApiUrl } from "@solana/web3.js";
import { 
    ConnectionProvider, 
    WalletProvider
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";

function CustomWalletProvider({ children }) {
    const endpoint = import.meta.env.VITE_APP_DEVNET_MODE === "true" ? clusterApiUrl("devnet") : import.meta.env.VITE_APP_RPC_URL;
    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter()
        ],
        // [endpoint]
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    {children}
                    {/* <WalletModal container="body" /> */}
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
}

export default CustomWalletProvider;
