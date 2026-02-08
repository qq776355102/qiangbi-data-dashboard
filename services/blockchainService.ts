
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
        this.provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
            staticNetwork: true
        });
        this.multicallContract = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, this.provider);
    }

    private encodeCall(contractInterface: ethers.Interface, fnName: string, args: any[]): string {
        return contractInterface.encodeFunctionData(fnName, args);
    }

    private decodeResult(contractInterface: ethers.Interface, fnName: string, data: string): any {
        try {
            if (!data || data === '0x') return null;
            return contractInterface.decodeFunctionResult(fnName, data);
        } catch (e) {
            return null;
        }
    }

    /**
     * 完全遵循用户提供的 queryUserTotalStaking 脚本逻辑
     */
    private async queryTotalStaking(address: string): Promise<bigint> {
        try {
            const userAddress_outwith0x = address.slice(2).toLowerCase();
            
            // 1:1 复制用户提供的 callData 模板
            const callData = `0xffd7d741000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000099a57e6c8558bc6689f894e068733adf83c19725000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000247965d56d0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000309ca717d6989676194b88fd06029a88ceefee6000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000645ac983f400000000000000000000000099a57e6c8558bc6689f894e068733adf83c197250000000000000000000000001964ca90474b11ffd08af387b110ba6c96251bfc000000000000000000000000${userAddress_outwith0x}00000000000000000000000000000000000000000000000000000000`;

            const result = await this.provider.call({
                to: TOTAL_STAKING_QUERY_CONTRACT,
                data: callData
            }).catch(async () => {
                return await this.provider.send('eth_call', [{
                    to: TOTAL_STAKING_QUERY_CONTRACT,
                    data: callData
                }, 'latest']);
            });

            if (result && result !== '0x') {
                return this.parseTotalStakingFromRawData(result);
            }
            return 0n;
        } catch (error) {
            console.error("queryTotalStaking failed:", error);
            return 0n;
        }
    }

    private parseTotalStakingFromRawData(rawData: string): bigint {
        try {
            if (!rawData || rawData === '0x' || rawData.length < 10) return 0n;
            const multicallInterface = new ethers.Interface(TOTAL_STAKE_MULTICALL_ABI);
            try {
                const decoded = multicallInterface.decodeFunctionResult('multiCall', rawData);
                const successes = decoded[0]; 
                const results = decoded[1];
                
                // 索引 1 返回的是总质押量 (uint256)
                if (results.length > 1 && successes[1] && results[1] !== '0x' && results[1].length === 66) {
                    return BigInt(results[1]);
                }
                
                // 备选
                for (let i = 0; i < results.length; i++) {
                    if (successes[i] && results[i] && results[i].length === 66) {
                        const val = BigInt(results[i]);
                        if (val > 1000n) return val;
                    }
                }
            } catch {
                const hexStr = rawData.replace('0x', '');
                if (hexStr.length >= 64) {
                    const val = BigInt('0x' + hexStr.substring(hexStr.length - 64));
                    if (val > 0n && val < 1000000000000000000000000n) return val;
                }
            }
        } catch {}
        return 0n;
    }

    private async safeAggregate(calls: any[], chunkSize: number = 8): Promise<any[]> {
        const results: any[] = [];
        for (let i = 0; i < calls.length; i += chunkSize) {
            const chunk = calls.slice(i, i + chunkSize);
            try {
                const response = await this.multicallContract.aggregate3(chunk);
                results.push(...response);
            } catch (e) {
                results.push(...chunk.map(() => ({ success: false, returnData: '0x' })));
            }
        }
        return results;
    }

    async batchQuery(addresses: AddressEntry[], batchSize: number = 2): Promise<Map<string, StakingData>> {
        const resultsMap = new Map<string, StakingData>();
        const erc20Int = new ethers.Interface(ERC20_ABI);
        const stakeInt = new ethers.Interface(STAKE_ABI);
        const bondInt = new ethers.Interface(BOND_ABI);
        const turbineInt = new ethers.Interface(TURBINE_ABI);
        const spiderInt = new ethers.Interface(SPIDER_WEB_ABI);

        for (let i = 0; i < addresses.length; i += batchSize) {
            const chunk = addresses.slice(i, i + batchSize);
            const summaryCalls: any[] = [];

            chunk.forEach(addr => {
                summaryCalls.push({ target: TURBINE_CONTRACT, allowFailure: true, callData: this.encodeCall(turbineInt, 'getTurbineBal', [addr.aAddress]) });
                summaryCalls.push({ target: SPIDER_WEB_CONTRACT, allowFailure: true, callData: this.encodeCall(spiderInt, 'claimable', [addr.aAddress]) });
                summaryCalls.push({ target: TOKEN_LGNS.address, allowFailure: true, callData: this.encodeCall(erc20Int, 'balanceOf', [addr.derivedAddress]) });
                summaryCalls.push({ target: TOKEN_SLGNS.address, allowFailure: true, callData: this.encodeCall(erc20Int, 'balanceOf', [addr.derivedAddress]) });
                MINT_STAKE_CONTRACTS.forEach(c => summaryCalls.push({ target: c, allowFailure: true, callData: this.encodeCall(stakeInt, 'getUserStakesCount', [addr.aAddress]) }));
                BOND_CONTRACTS.forEach(c => summaryCalls.push({ target: c, allowFailure: true, callData: this.encodeCall(bondInt, 'getBondInfoDataLength', [addr.aAddress]) }));
            });

            const summaryResponse = await this.safeAggregate(summaryCalls, 10);

            let callIdx = 0;
            for (const addr of chunk) {
                const turbineBal = (summaryResponse[callIdx++]?.success) ? (this.decodeResult(turbineInt, 'getTurbineBal', summaryResponse[callIdx-1].returnData)?.[0] || 0n) : 0n;
                const spiderReward = (summaryResponse[callIdx++]?.success) ? (this.decodeResult(spiderInt, 'claimable', summaryResponse[callIdx-1].returnData)?.[0] || 0n) : 0n;
                const lgnsBal = (summaryResponse[callIdx++]?.success) ? (this.decodeResult(erc20Int, 'balanceOf', summaryResponse[callIdx-1].returnData)?.[0] || 0n) : 0n;
                const slgnsBal = (summaryResponse[callIdx++]?.success) ? (this.decodeResult(erc20Int, 'balanceOf', summaryResponse[callIdx-1].returnData)?.[0] || 0n) : 0n;
                
                const mintCounts = MINT_STAKE_CONTRACTS.map(() => (summaryResponse[callIdx++]?.success) ? Number(this.decodeResult(stakeInt, 'getUserStakesCount', summaryResponse[callIdx-1].returnData)?.[0] || 0) : 0);
                const bondCounts = BOND_CONTRACTS.map(() => (summaryResponse[callIdx++]?.success) ? Number(this.decodeResult(bondInt, 'getBondInfoDataLength', summaryResponse[callIdx-1].returnData)?.[0] || 0) : 0);
                
                let mintTotal = 0n, bondTotal = 0n;
                const detailCalls: any[] = [];
                MINT_STAKE_CONTRACTS.forEach((c, ci) => { 
                    for(let j=0; j < mintCounts[ci]; j++) {
                        detailCalls.push({ target: c, allowFailure: true, callData: this.encodeCall(stakeInt, 'stakes', [addr.aAddress, j]) });
                    }
                });
                BOND_CONTRACTS.forEach((c, ci) => { 
                    for(let j=0; j < bondCounts[ci]; j++) {
                        detailCalls.push({ target: c, allowFailure: true, callData: this.encodeCall(bondInt, 'bondInfoData', [addr.aAddress, j]) });
                    }
                });

                if (detailCalls.length > 0) {
                    const detailRes = await this.safeAggregate(detailCalls, 8);
                    let di = 0;
                    mintCounts.forEach(count => { 
                        for(let j=0; j < count; j++) {
                            const res = detailRes[di++];
                            if(res?.success) mintTotal += BigInt(this.decodeResult(stakeInt, 'stakes', res.returnData)?.principal || 0n);
                        }
                    });
                    bondCounts.forEach(count => { 
                        for(let j=0; j < count; j++) {
                            const res = detailRes[di++];
                            if(res?.success) bondTotal += BigInt(this.decodeResult(bondInt, 'bondInfoData', res.returnData)?.payout || 0n);
                        }
                    });
                }

                // 核心：总质押合计直接取专用脚本结果，不再手动累加 Mint + Bond
                const contractTotal = await this.queryTotalStaking(addr.aAddress);
                
                resultsMap.set(addr.aAddress, {
                    totalStaking: ethers.formatUnits(contractTotal, 9),
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
