import { TxVersion } from "@raydium-io/raydium-sdk";
import {
    AMM_V4,
    AMM_STABLE,
    CREATE_CPMM_POOL_FEE_ACC,
    CREATE_CPMM_POOL_PROGRAM,
    DEV_CREATE_CPMM_POOL_PROGRAM,
    DEVNET_PROGRAM_ID,
    Raydium
} from "@raydium-io/raydium-sdk-v2"
import { BN } from "bn.js";
import BigNumber from "bignumber.js";

const VALID_CPMM_PROGRAM_ID = new Set([CREATE_CPMM_POOL_PROGRAM.toBase58(), DEV_CREATE_CPMM_POOL_PROGRAM.toBase58()])

export const isValidCpmm = (id) => VALID_CPMM_PROGRAM_ID.has(id)

const VALID_AMM_PROGRAM_ID = new Set([
    AMM_V4.toBase58(),
    AMM_STABLE.toBase58(),
    DEVNET_PROGRAM_ID.AMM_V4.toBase58(),
    DEVNET_PROGRAM_ID.AMM_STABLE.toBase58(),
])

export const isValidAmm = (id) => VALID_AMM_PROGRAM_ID.has(id)

let raydium = undefined;
export const initSdk = async (connection, owner, loadToken = undefined) => {
    if (!raydium) {
        raydium = await Raydium.load({
            owner,
            connection,
            disableFeatureCheck: true,
            disableLoadToken: loadToken,
            blockhashCommitment: "finalized"
        });
        return raydium
    }

    raydium = raydium.setConnection(connection)
    raydium = raydium.setOwner(owner)
    return raydium
}

export const getSdk = () => {
    return raydium;
}

export const createCpmmPool = async (connection, baseToken, baseTokenAmount, quoteToken, quoteTokenAmount, ownerPubkey) => {
    const raydium = await initSdk(connection, ownerPubkey, true)
    // check token list here: https://api-v3.raydium.io/mint/list
    // token
    const mintA = await raydium.token.getTokenInfo(baseToken)
    // sol
    const mintB = await raydium.token.getTokenInfo(quoteToken)

    const feeConfigs = await raydium.api.getCpmmConfigs()

    // if (raydium.cluster === 'devnet') {
    //   feeConfigs.forEach((config) => {
    //     config.id = getCpmmPdaAmmConfigId(DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM, config.index).publicKey.toBase58()
    //   })
    // }

    const { transaction, signers, extInfo } = await raydium.cpmm.createPool({
        // poolId: // your custom publicKey, default sdk will automatically calculate pda pool id
        programId: CREATE_CPMM_POOL_PROGRAM, // devnet: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM
        poolFeeAccount: CREATE_CPMM_POOL_FEE_ACC, // devnet:  DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC
        mintA,
        mintB,
        mintAAmount: new BN(new BigNumber(baseTokenAmount.toString() + 'e+' + mintA.decimals.toString()).toFixed(0)),
        mintBAmount: new BN(new BigNumber(quoteTokenAmount.toString() + 'e+' + mintB.decimals.toString()).toFixed(0)),
        startTime: new BN(0),
        feeConfig: feeConfigs[0],
        associatedOnly: false,
        ownerInfo: {
            useSOLBalance: true,
        },
        txVersion: TxVersion.V0,
    })

    if (signers && signers.length > 0) {
        transaction.sign(signers)
    }

    return { transaction, poolInfo: extInfo.address };
}