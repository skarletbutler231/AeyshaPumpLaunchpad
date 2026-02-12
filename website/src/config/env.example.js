import { mainnet, sepolia } from "wagmi/chains"

export const SERVER_URL = "https://eth.ibundle.io"
export const TEST_MODE = false

export const CHAIN = TEST_MODE ? sepolia : mainnet

export const DEPOSIT_ADDRESS="0x552594b83058882C2263DBe23235477f63e7D60B"

export const PAYMENT_OPTIONS = [
    {
        cash: 0,
        token: 0
    },
    {
        cash: 0.5,
        token: 0.5,
        desc: "Contract Creator + Bundler"
    },
    {
        cash: 0.75,
        token: 0,
        desc: "Contract Creator + Bundler"
    },
    {
        cash: 0.75,
        token: 0,
        desc: "Launch and Bundle Your Own Code Contract"
    }
]