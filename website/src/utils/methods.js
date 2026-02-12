import bs58 from "bs58";

export const numberWithCommas = (x, digits = 3) => {
    return parseFloat(x).toLocaleString(undefined, { maximumFractionDigits: digits });
};

export const ellipsisAddress = (address, isLong = false) => {
    return address?.toString()?.slice(0, isLong ? 8 : 4) + "..." + address?.toString()?.slice(isLong ? -8 : -4);
}

export const isValidAddress = (addr) => {
    try {
        const decodedAddr = bs58.decode(addr);
        if (decodedAddr.length !== 32)
            return false;
        return true;
    }
    catch (err) {
        console.log(err);
        return false;
    }
};

function getRndNumber(min, max) {
    return Math.random() * (max - min) + min;
}

export const getTokenAmounts = (totalAmount, walletNumber) => {
    if (totalAmount === 0 || walletNumber < 1) return []
    try {
        const avg = totalAmount / walletNumber
        const rlt = []
        let sum = 0
        for (let i = 0; i < walletNumber; i++) {
            const rnd = Math.round(avg + getRndNumber(-1 * avg / 10, avg / 10))
            rlt.push(rnd)
            sum += rnd
        }

        let diff = totalAmount - sum
        sum = 0
        for (let i = 0; i < walletNumber; i++) {
            rlt[i] = Math.round(rlt[i] + diff / walletNumber)
            sum += rlt[i]
        }
        diff = totalAmount - sum
        rlt[walletNumber - 1] += diff

        // for (let i = 1; i < walletNumber; i++) {
        //     rlt[0] += rlt[i];
        // }
        return rlt
    } catch (error) {
        console.log("Getting token amounts was failed ===> ", error)
        let erlt = []
        for (let i = 0; i < walletNumber; i++) {
            erlt.push(0)
        }
        return erlt
    }
}

export const formatNumber = (number) => {
    let suffix = '';
    let formattedNumber = number;

    if (number >= 1e6) {
        suffix = 'M';
        formattedNumber = number / 1e6;
    }
    else if (number >= 1e3) {
        suffix = 'k';
        formattedNumber = number / 1e3;
    }
    return (formattedNumber && formattedNumber > 0) ? `${parseFloat(formattedNumber)?.toFixed(2)}${suffix}` : 0;
}

export const getCurrentDate = () => {
    const date = new Date();

    // Extract the year, month, and day
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based, so add 1
    const day = String(date.getDate()).padStart(2, '0');

    // Format the date as yyyy-mm-dd
    return `${year}-${month}-${day}`;
};

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));