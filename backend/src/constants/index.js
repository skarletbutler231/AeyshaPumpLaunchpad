exports.programID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
exports.pumpfunGlobalAccount = "4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf";
exports.pumpfunGlobalVolumeAccumulator = "Hq2wp8uJ9jCPsYgNHex8RtqdvMPfVGoYwjvF1ATiwn2Y";
exports.pumpfunFeeConfig = "8Wf5TiAheLUqBrKXeYg2JtAFFMWtKdG2BSFgqUcPVwTt";
exports.pumpfunFeeProgram = "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ";
exports.MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
exports.feeRecipient = "62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV";
exports.EVENT_AUTH = "Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1";
exports.RAYDIUM_VAULT_AUTHORITY_2 = "GpMZbSM2GgvTKHJirzeGfMFoaZ8UR2X7F4v8vHTvxFbL";
exports.pumpContractId = "72XQfsY7onzCHFnrxMiwZikBCfJV9ayBw8owAuQekVSY";
exports.BUNDLE_TX_LIMIT = 4;

exports.PAYMENT_OPTIONS = [
    {
        cash: 0,
        token: 0,
        walletLimit: 100
    },
    {
        cash: 0.5,
        token: 1,
        desc: "Launch & Bundle Max 10% Supply",
        walletLimit: 10
    },
    {
        cash: 2,
        token: 1,
        desc: "Launch & Bundle Unlimited Supply",
        walletLimit: 20
    },
    {
        cash: 3.5,
        token: 0,
        desc: "Launch & Bundle Unlimited Supply",
        walletLimit: 100
    },
]

exports.DEFAULT_WALLET_AMOUNT = 100

exports.REFERRAL_FEE = 10
exports.EXTRA_REFERRAL_FEE = 20
exports.REFERRAL_WHITELIST = ["2nhfUdu9dowaXM9eKjWV42JzewuLq2k34X5qoa9Pk5DJ"]