
import { ethers } from 'ethers';
import { 
    MULTICALL3_ADDRESS, 
    MULTICALL3_ABI, 
    ERC20_ABI, 
    STAKE_ABI, 
    BOND_ABI, 
    TURBINE_ABI, 
    SPIDER_WEB_ABI,
    TOTAL_STAKE_MULTICALL_ABI,
    MINT_STAKE_CONTRACTS,
    BOND_CONTRACTS,
    TURBINE_CONTRACT,
    SPIDER_WEB_CONTRACT,
    TOTAL_STAKING_QUERY_CONTRACT,
    TOKEN_LGNS,
    TOKEN_SLGNS
} from '../constants.ts';
import { AddressEntry, StakingData } from '../types.ts';

export class BlockchainService {
    private provider: ethers.JsonRpcProvider;
    private multicallContract: ethers.Contract;

    constructor(rpcUrl: string) {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.multicallContract = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, this.provider);
    }

    private encodeCall(contractInterface: ethers.Interface, fnName: string, args: any[]): string {
        return contractInterface.encodeFunctionData(fnName, args);
    }

    private decodeResult(contractInterface: ethers.Interface, fnName: string, data: string): any {
        try {
            return contractInterface.decodeFunctionResult(fnName, data);
        } catch (e) {
            return null;
        }
    }

    private parseTotalStakingFromRawData(rawData: string, userAddress: string = ''): bigint {
        try {
            if (!rawData || rawData === '0x' || rawData.length < 10) return 0n;
            const multicallInterface = new ethers.Interface(TOTAL_STAKE_MULTICALL_ABI);
            try {
                const decoded = multicallInterface.decodeFunctionResult('multiCall', rawData);
                const successes = decoded[0]; 
                const results = decoded[1];   
                if (results.length > 1 && successes[1] && results[1] !== '0x') {
                    if (results[1].length === 66) {
                        const value = BigInt(results[1]);
                        if (value > 0n) return value;
                    }
                }
                for (let i = 0; i < results.length; i++) {
                    if (!successes[i]) continue;
                    const resBytes = results[i];
                    if (resBytes && resBytes !== '0x' && resBytes.length === 66) {
                        try {
                            const value = BigInt(resBytes);
                            if (value > 1n) return value;
                        } catch (e) { continue; }
                    }
                }
            } catch (decodeError) { }
            const hexStr = rawData.startsWith('0x') ? rawData.slice(2) : rawData;
            if (hexStr.length >= 64) {
                const last64Chars = hexStr.substring(hexStr.length - 64);
                const value = BigInt('0x' + last64Chars);
                if (value > 0n && value < 1000000000000000000n) {
                    return value;
                }
            }
        } catch (error) {
            console.error(`解析总质押失败 ${userAddress}:`, error);
        }
        return 0n;
    }

    private async queryTotalStaking(address: string): Promise<bigint> {
        try {
            const userAddress_outwith0x = address.slice(2).toLowerCase();
            const prefix = "0xffd7d7410000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000099a57e6c8558bc6689f894e068733adf83c19725000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000247965d56d0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000309ca717d6989676194b88fd06029a88ceefee6000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000645ac983f400000000000000000000000099a57e6c8558bc6689f894e068733adf83c197250000000000000000000000001964ca90474b11ffd08af387b110ba6c96251bfc000000000000000000000000";
            const suffix = "00000000000000000000000000000000000000000000000000000000";
            const callData = `${prefix}${userAddress_outwith0x}${suffix}`;
            const hexData = callData.startsWith('0x') ? callData : '0x' + callData;
            const result = await this.provider.call({ to: TOTAL_STAKING_QUERY_CONTRACT, data: hexData });
            return this.parseTotalStakingFromRawData(result, address);
        } catch (e: any) {
            console.error(`查询总质押失败 ${address}:`, e.message);
            return 0n;
        }
    }

    async batchQuery(addresses: AddressEntry[], batchSize: number = 10): Promise<Map<string, StakingData>> {
        const resultsMap = new Map<string, StakingData>();
        const erc20Int = new ethers.Interface(ERC20_ABI);
        const stakeInt = new ethers.Interface(STAKE_ABI);
        const bondInt = new ethers.Interface(BOND_ABI);
        const turbineInt = new ethers.Interface(TURBINE_ABI);
        const spiderInt = new ethers.Interface(SPIDER_WEB_ABI);

        for (let i = 0; i < addresses.length; i += batchSize) {
            const chunk = addresses.slice(i, i + batchSize);
            const firstPassCalls: any[] = [];
            chunk.forEach(addr => {
                firstPassCalls.push({ target: TURBINE_CONTRACT, allowFailure: true, callData: this.encodeCall(turbineInt, 'getTurbineBal', [addr.aAddress]) });
                firstPassCalls.push({ target: SPIDER_WEB_CONTRACT, allowFailure: true, callData: this.encodeCall(spiderInt, 'claimable', [addr.aAddress]) });
                firstPassCalls.push({ target: TOKEN_LGNS.address, allowFailure: true, callData: this.encodeCall(erc20Int, 'balanceOf', [addr.derivedAddress]) });
                firstPassCalls.push({ target: TOKEN_SLGNS.address, allowFailure: true, callData: this.encodeCall(erc20Int, 'balanceOf', [addr.derivedAddress]) });
                MINT_STAKE_CONTRACTS.forEach(c => firstPassCalls.push({ target: c, allowFailure: true, callData: this.encodeCall(stakeInt, 'getUserStakesCount', [addr.aAddress]) }));
                BOND_CONTRACTS.forEach(c => firstPassCalls.push({ target: c, allowFailure: true, callData: this.encodeCall(bondInt, 'getBondInfoDataLength', [addr.aAddress]) }));
            });
            const firstPassResponse = await this.multicallContract.aggregate3(firstPassCalls);
            let callIdx = 0;
            for (const addr of chunk) {
                const turbineBal = (firstPassResponse[callIdx++]?.success) ? this.decodeResult(turbineInt, 'getTurbineBal', firstPassResponse[callIdx-1].returnData)[0] : 0n;
                const spiderReward = (firstPassResponse[callIdx++]?.success) ? this.decodeResult(spiderInt, 'claimable', firstPassResponse[callIdx-1].returnData)[0] : 0n;
                const lgnsBal = (firstPassResponse[callIdx++]?.success) ? this.decodeResult(erc20Int, 'balanceOf', firstPassResponse[callIdx-1].returnData)[0] : 0n;
                const slgnsBal = (firstPassResponse[callIdx++]?.success) ? this.decodeResult(erc20Int, 'balanceOf', firstPassResponse[callIdx-1].returnData)[0] : 0n;
                const mintCounts = MINT_STAKE_CONTRACTS.map(() => (firstPassResponse[callIdx++]?.success) ? Number(this.decodeResult(stakeInt, 'getUserStakesCount', firstPassResponse[callIdx-1].returnData)[0]) : 0);
                const bondCounts = BOND_CONTRACTS.map(() => (firstPassResponse[callIdx++]?.success) ? Number(this.decodeResult(bondInt, 'getBondInfoDataLength', firstPassResponse[callIdx-1].returnData)[0]) : 0);
                
                const detailCalls: any[] = [];
                MINT_STAKE_CONTRACTS.forEach((c, ci) => { for(let j=0; j<mintCounts[ci]; j++) detailCalls.push({ target: c, allowFailure: true, callData: this.encodeCall(stakeInt, 'stakes', [addr.aAddress, j]) }); });
                BOND_CONTRACTS.forEach((c, ci) => { for(let j=0; j<bondCounts[ci]; j++) detailCalls.push({ target: c, allowFailure: true, callData: this.encodeCall(bondInt, 'bondInfoData', [addr.aAddress, j]) }); });
                
                let mintTotal = 0n, bondTotal = 0n;
                if (detailCalls.length > 0) {
                    const detailRes = await this.multicallContract.aggregate3(detailCalls);
                    let di = 0;
                    mintCounts.forEach(count => { for(let j=0; j<count; j++) if(detailRes[di++]?.success) mintTotal += BigInt(this.decodeResult(stakeInt, 'stakes', detailRes[di-1].returnData).principal); });
                    bondCounts.forEach(count => { for(let j=0; j<count; j++) if(detailRes[di++]?.success) bondTotal += BigInt(this.decodeResult(bondInt, 'bondInfoData', detailRes[di-1].returnData).payout); });
                }
                const totalStakingValue = await this.queryTotalStaking(addr.aAddress);
                resultsMap.set(addr.aAddress, {
                    totalStaking: ethers.formatUnits(totalStakingValue, 9),
                    mintStaking: ethers.formatUnits(mintTotal, 9),
                    bondStaking: ethers.formatUnits(bondTotal, 9),
                    spiderWebReward: ethers.formatUnits(spiderReward, 9),
                    turbineBalance: ethers.formatUnits(turbineBal, 9),
                    derivedLgns: ethers.formatUnits(lgnsBal, TOKEN_LGNS.decimals),
                    derivedSlgns: ethers.formatUnits(slgnsBal, TOKEN_SLGNS.decimals),
                    lastUpdated: Date.now()
                });
            }
        }
        return resultsMap;
    }
}
