import { targetedTexts } from "./themeConfig"

export const SERVER_URL = targetedTexts.server_address;
export const TEST_MODE = false

export const DEPOSIT_ADDRESS="0x552594b83058882C2263DBe23235477f63e7D60B"

export const PAYMENT_OPTIONS = [
    {
        title: "account",
        cash: 0,
        token: 0
    },
    {
        title: "silver",
        cash: 0.5,
        token: 1,
        desc: "Launch & Bundle Max 10% Supply"
    },
    {
        title: "gold",
        cash: 2,
        token: 1,
        desc: "Launch & Bundle Unlimited Supply"
    },
    {
        title: "diamond",
        cash: 3.5,
        token: 0,
        desc: "Launch & Bundle Unlimited Supply"
    },
]