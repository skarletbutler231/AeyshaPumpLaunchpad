import default_mark from "../assets/imgs/mark.png"
import default_mark_text from "../assets/imgs/mark_text.png"
import default_menu_mark from "../assets/imgs/mark-white-text.png"

import muscle_mark from "../assets/rebranding/muscle/mark.png"
import muscle_mark_text from "../assets/rebranding/muscle/mark-text.png"
import muscle_menu_mark from "../assets/rebranding/muscle/menu-mark.png"

import clickpadfun_mark from "../assets/rebranding/memepad/logo.png"
import memepadspace_mark from "../assets/rebranding/memepad/logo.png"
// import clickpadfun_mark_text from "../assets/rebranding/clickpadfun/mark-text.png"
// import clickpadfun_menu_mark from "../assets/rebranding/clickpadfun/menu-mark.png"


const urls = {
    default: {
        logo: "/assets/meme-tools-logo.png",
        mark: "/assets/img/mark.png",
        menuBg: "/assets/img/img_menubg.png",
    },
    muscle: {
        logo: "/assets/rebranding/muscle/logo.png",
        mark: "/assets/rebranding/muscle/mark.png",
        menuBg: "/assets/rebranding/muscle/img_menubg.png"
    },
    kingpingod: {
        logo: "/assets/rebranding/memepad/logo.png",
        mark: "/assets/rebranding/memepad/mark.png",
        menuBg: "/assets/rebranding/memepad/img_menubg.png"
    },
    memepadspace: {
        logo: "/assets/rebranding/memepad/logo.png",
        mark: "/assets/rebranding/memepad/mark.png",
        menuBg: "/assets/rebranding/memepad/img_menubg.png"
    }
}

const texts = {
    default: {
        server_address: "https://sol.meme-tools.io/",
        title: "Welcome To MEME Tools",
        coin_title: "Meme Tools Token",
        coin_symbol: "$MEME",
        launch_description: "Meme Tools Multisender sends tokens to multiple addresses while minimizing costs for the sender. All transaction fees are paid by recipients when sending tokens. Choose a token, input a list of recipients, sign the approval, and pay only for a single transaction.",
        package_payment: "Bundler Package Supply payment Will be Automatically Deducted from your Bundle Contract and Transferred to the MemeTools Team",
        copyright: "© 2024 Meme Tools. All rights reserved."
    },
    probabyfun: {
        name: "ProBaby.Fun",
        server_address: "https://probaby.fun/backend",
        title: "Welcome To ProBaby.Fun",
        title_description: "Let's launch token to the moon on probaby.fun. Please connect your wallet and sign in to get started.",
        launch_description: "ProBaby.Fun multisender sends tokens to multiple addresses while minimizing costs for the sender. All transaction fees are paid by recipients when sending tokens. Choose a token, input a list of recipients, sign the approval, and pay only for a single transaction.",
        package_payment: "Bundler Package Supply payment Will be Automatically Deducted from your Bundle Contract and Transferred to the ProBaby.Fun Team",
        copyright: "@ 2025 ProBaby.Fun. All rights reserved."
    },
    kingpingod: {
        name: "Kingpingod.Com",
        server_address: "https://kingpingod.com",
        title: "Welcome To Kingpingod.Com",
        title_description: "Let's launch token to the moon on kingpingod.com. Please connect your wallet and sign in to get started.",
        launch_description: "Kingpingod.Com multisender sends tokens to multiple addresses while minimizing costs for the sender. All transaction fees are paid by recipients when sending tokens. Choose a token, input a list of recipients, sign the approval, and pay only for a single transaction.",
        package_payment: "Bundler Package Supply payment Will be Automatically Deducted from your Bundle Contract and Transferred to the Kingpingod.Com Team",
        copyright: "@ 2026 Kingpingod.Com. All rights reserved."
    },
    memepadspace: {
        name: "Memepad.Space",
        server_address: "http://localhost:7109",
        title: "Welcome To Memepad.Space",
        title_description: "Let's launch token to the moon on memepad.space. Please connect your wallet and sign in to get started. We recommend using phantom wallet and PC.",
        launch_description: "Memepad.Space multisender sends tokens to multiple addresses while minimizing costs for the sender. All transaction fees are paid by recipients when sending tokens. Choose a token, input a list of recipients, sign the approval, and pay only for a single transaction.",
        package_payment: "Bundler Package Supply payment Will be Automatically Deducted from your Bundle Contract and Transferred to the Memepad.Space Team",
        copyright: "@ 2025 Memepad.Space. All rights reserved."
    }
}

export const targetedUrls = import.meta.env.VITE_REBRAND_TITLE == "muscle" ? urls.muscle
    : import.meta.env.VITE_REBRAND_TITLE == "kingpingod" ? urls.kingpingod
    : import.meta.env.VITE_REBRAND_TITLE == "memepadspace" ? urls.memepadspace
        : urls.default

export const targetedTexts = import.meta.env.VITE_REBRAND_TITLE == "muscle" ? texts.muscle
    : import.meta.env.VITE_REBRAND_TITLE == "kingpingod" ? texts.kingpingod
    : import.meta.env.VITE_REBRAND_TITLE == "memepadspace" ? texts.memepadspace
        : texts.default

export const mark = import.meta.env.VITE_REBRAND_TITLE == "muscle" ? muscle_mark
    : import.meta.env.VITE_REBRAND_TITLE == "kingpingod" ? clickpadfun_mark
    : import.meta.env.VITE_REBRAND_TITLE == "memepadspace" ? memepadspace_mark
        : default_mark
export const mark_text = import.meta.env.VITE_REBRAND_TITLE == "muscle" ? muscle_mark_text
    : import.meta.env.VITE_REBRAND_TITLE == "kingpingod" ? clickpadfun_mark
    : import.meta.env.VITE_REBRAND_TITLE == "memepadspace" ? memepadspace_mark
        : default_mark_text
export const menu_mark = import.meta.env.VITE_REBRAND_TITLE == "muscle" ? muscle_menu_mark
    : import.meta.env.VITE_REBRAND_TITLE == "kingpingod" ? clickpadfun_mark
    : import.meta.env.VITE_REBRAND_TITLE == "memepadspace" ? memepadspace_mark
        : default_menu_mark
