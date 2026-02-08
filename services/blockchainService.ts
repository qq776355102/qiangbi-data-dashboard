
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

    private async queryTotalStaking(address: string): Promise<bigint> {
        try {
            const cleanAddr = address.toLowerCase().replace('0x', '');
            if (cleanAddr.length !== 40) return 0n;

            // 修正后的地址填充逻辑 (32字节对齐，地址在后20字节)
            const paddedAddr = "000000000000000000000000" + cleanAddr;
            
            // 构造专用的查询 Payload
            const prefix = "ffd7d741000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000099a57e6c8558bc6689f894e068733adf83c19725000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000247965d56d00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
            const middle = paddedAddr; // 使用标准对齐
            const suffix = "00000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000247965d56d0000000000000000000000000000000000000000000000000000000000000000";
            
            const callData = "0x" + prefix + middle + suffix;

            const result = await this.provider.call({
                to: TOTAL_STAKING_QUERY_CONTRACT,
                data: callData
            }).catch(() => '0x');

            if (result && result !== '0x') {
                const hexStr = result.replace('0x', '');
                // 搜索结果中可能的 BigInt 值 (质押值通常在这个范围内)
                for (let i = 0; i <= hexStr.length - 64; i += 64) {
                    try {
                        const chunk = '0x' + hexStr.substring(i, i + 64);
                        const val = BigInt(chunk);
                        if (val > 100000000n && val < 1000000000000000000000000n) return val;
                    } catch { continue; }
                }
            }
            return 0n;
        } catch { return 0n; }
    }

    private async safeAggregate(calls: any[], chunkSize: number = 8): Promise<any[]> {
        const results: any[] = [];
        for (let i = 0; i < calls.length; i += chunkSize) {
            const chunk = calls.slice(i, i + chunkSize);
            try {
                const response = await this.multicallContract.aggregate3(chunk);
                results.push(...response);
            } catch (e) {
                console.warn(`Sub-chunk failed, filling with nulls. Size: ${chunk.length}`);
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
                    const detailRes = await this.safeAggregate(detailCalls, 8); // 更小的分片
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

                const contractTotal = await this.queryTotalStaking(addr.aAddress);
                // 核心修复逻辑：计算兜底
                // 如果 contractTotal 为 0，但 mint 或 bond 有数据，则使用 mint+bond 之和
                const calculatedTotal = mintTotal + bondTotal;
                const finalTotal = contractTotal > 0n ? contractTotal : calculatedTotal;
                
                resultsMap.set(addr.aAddress, {
                    totalStaking: ethers.formatUnits(finalTotal, 9),
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
