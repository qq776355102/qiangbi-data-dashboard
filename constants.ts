
import { TokenConfig } from './types.ts';

export const DEFAULT_RPC = "https://polygon-bor-rpc.publicnode.com";
export const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";

export const MINT_STAKE_CONTRACTS = [
    '0x14fcA7bfa779A4172c9b2DE61fd352C005442520',
    '0x23E2B07d85a8dbc307742C72aadbbdde4E5e2EFB',
    '0xDa13C7553A654601667adf9a1A16248bAB584F13',
    '0x65Ed60E414CEcE532d8afF90c89dA369E44CF883',
    '0x25a4b842cB200E9148FF5a11BAbF80488c8d8b07'
];

export const BOND_CONTRACTS = [
    "0x6c0ac888b075c6b5141cbc1da6170b6686afd07d",
];

// 600-day Staking Contract
export const STAKING_600_CONTRACT = "0x8ca97f41d2c81af050656e8ad0cf543820a24504";

export const TURBINE_CONTRACT = "0x07Ff4e06865de4934409Aa6eCea503b08Cc1C78d";
export const SPIDER_WEB_CONTRACT = "0x806FDAb92B0Fc7fBE4bbBE5117A54cAa9283d5a4";
export const TOTAL_STAKING_QUERY_CONTRACT = "0xdbbfa3cb3b087b64f4ef5e3d20dda2488aa244e6";

export const TOKEN_LGNS: TokenConfig = {
    address: "0xeb51d9a39ad5eef215dc0bf39a8821ff804a0f01",
    symbol: "LGNS",
    decimals: 9
};

export const TOKEN_SLGNS: TokenConfig = {
    address: "0x99a57e6c8558bc6689f894e068733adf83c19725",
    symbol: "slgns",
    decimals: 9
};

export const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)"
];

export const STAKE_ABI = [
    "function getUserStakesCount(address user) view returns (uint256)",
    "function stakes(address user, uint256 index) view returns (uint256 principal, uint256 gons, uint256 startBlock, uint256 expiry, uint256 warmup, uint256 lastBlock, uint256 vesting, bool exists)"
];

// 600D contract specific ABI (returns more fields, principal is first)
export const STAKE_600_ABI = [
    "function getUserStakesCount(address user) view returns (uint256)",
    "function stakes(address user, uint256 index) view returns (uint256 principal, uint256 gons, uint256 startEpoch, uint256 expiry, uint256 warmup, uint256 lastBlock, uint256 vesting, bool exists, uint256 extraIndex, uint256 creditExtra, uint256 claimedExtra)"
];

export const BOND_ABI = [
    "function getBondInfoDataLength(address user) view returns (uint256)",
    "function bondInfoData(address user, uint256 index) view returns (uint256 id, address owner, uint256 payout, uint256 pricePaid, uint256 vesting, uint256 lastBlock)"
];

export const TURBINE_ABI = [
    "function getTurbineBal(address _receiver) view returns (uint256)"
];

export const SPIDER_WEB_ABI = [
    "function claimable(address) view returns (uint256)"
];

export const MULTICALL3_ABI = [
    "function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[] returnData)"
];

export const TOTAL_STAKE_MULTICALL_ABI = [
    "function multiCall(tuple(bool delegateCall, bool revertOnError, uint256 gasLimit, address target, uint256 value, bytes data)[] _txs) payable returns (bool[] _successes, bytes[] _results)"
];
