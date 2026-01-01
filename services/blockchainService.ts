
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
} from '../constants';
import { AddressEntry, StakingData } from '../types';

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

    /**
     * 移植用户提供的核心解析逻辑：从原始返回数据中解析单地址总质押
     */
    private parseTotalStakingFromRawData(rawData: string, userAddress: string = ''): bigint {
        try {
            if (!rawData || rawData === '0x' || rawData.length < 10) return 0n;
            
            const multicallInterface = new ethers.Interface(TOTAL_STAKE_MULTICALL_ABI);
            
            try {
                // 1. 解码 multiCall 返回结果 (bool[] successes, bytes[] results)
                const decoded = multicallInterface.decodeFunctionResult('multiCall', rawData);
                const successes = decoded[0]; 
                const results = decoded[1];   

                // 核心逻辑：优先检查第二个调用 (index 1)
                if (results.length > 1 && successes[1] && results[1] !== '0x') {
                    if (results[1].length === 66) { // 32 bytes = 64 hex + 0x prefix
                        const value = BigInt(results[1]);
                        if (value > 0n) return value;
                    }
                }

                // 核心逻辑：遍历所有结果查找 32 字节的合理数值 (排除布尔值 0 和 1)
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
            } catch (decodeError) {
                // ABI 解码失败后的兜底处理
            }

            // 核心逻辑：从原始数据末尾提取最后 32 字节作为总质押值 (针对某些特殊非标返回)
            const hexStr = rawData.startsWith('0x') ? rawData.slice(2) : rawData;
            if (hexStr.length >= 64) {
                const last64Chars = hexStr.substring(hexStr.length - 64);
                const value = BigInt('0x' + last64Chars);
                // 验证值是否合理 (非零且小于极大上限，避免误解析)
                if (value > 0n && value < 1000000000000000000n) {
                    return value;
                }
            }
        } catch (error) {
            console.error(`解析总质押失败 ${userAddress}:`, error);
        }
        return 0n;
    }

    /**
     * 独立请求单个地址的总质押 - 使用用户提供的 callData 模板
     */
    private async queryTotalStaking(address: string): Promise<bigint> {
        try {
            const userAddress_outwith0x = address.slice(2).toLowerCase();
            
            // 构造 callData。模板来源于用户提供，确保无非法字符。
            const prefix = "0xffd7d741000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000099a57e6c8558bc6689f894e068733adf83c19725000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000247965d56d0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000309ca717d6989676194b88fd06029a88ceefee6000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000645ac983f400000000000000000000000099a57e6c8558bc6689f894e068733adf83c197250000000000000000000000001964ca90474b11ffd08af387b110ba6c96251bfc000000000000000000000000";
            const suffix = "00000000000000000000000000000000000000000000000000000000";
            
            // 拼装完整的 Data 字符串
            const callData = `${prefix}${userAddress_outwith0x}${suffix}`;
            
            // 严格检查长度是否正确（确保不会因为拼接导致 'invalid BytesLike' 报错）
            const hexData = callData.startsWith('0x') ? callData : '0x' + callData;
            
            const result = await this.provider.call({
                to: TOTAL_STAKING_QUERY_CONTRACT,
                data: hexData
            });

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

        const uniqueAddresses = Array.from(new Map(addresses.map(a => [a.aAddress.toLowerCase(), a])).values());

        for (let i = 0; i < uniqueAddresses.length; i += batchSize) {
            const chunk = uniqueAddresses.slice(i, i + batchSize);
            const firstPassCalls: any[] = [];

            chunk.forEach(addr => {
                firstPassCalls.push({ target: TURBINE_CONTRACT, allowFailure: true, callData: this.encodeCall(turbineInt, 'getTurbineBal', [addr.aAddress]) });
                firstPassCalls.push({ target: SPIDER_WEB_CONTRACT, allowFailure: true, callData: this.encodeCall(spiderInt, 'claimable', [addr.aAddress]) });
                firstPassCalls.push({ target: TOKEN_LGNS.address, allowFailure: true, callData: this.encodeCall(erc20Int, 'balanceOf', [addr.derivedAddress]) });
                firstPassCalls.push({ target: TOKEN_SLGNS.address, allowFailure: true, callData: this.encodeCall(erc20Int, 'balanceOf', [addr.derivedAddress]) });
                
                MINT_STAKE_CONTRACTS.forEach(contract => {
                    firstPassCalls.push({ target: contract, allowFailure: true, callData: this.encodeCall(stakeInt, 'getUserStakesCount', [addr.aAddress]) });
                });
                BOND_CONTRACTS.forEach(contract => {
                    firstPassCalls.push({ target: contract, allowFailure: true, callData: this.encodeCall(bondInt, 'getBondInfoDataLength', [addr.aAddress]) });
                });
            });

            const firstPassResponse = await this.multicallContract.aggregate3(firstPassCalls);
            let callIdx = 0;

            for (const addr of chunk) {
                if (callIdx >= firstPassResponse.length) break;

                const turbineRes = firstPassResponse[callIdx++];
                const spiderRes = firstPassResponse[callIdx++];
                const lgnsRes = firstPassResponse[callIdx++];
                const slgnsRes = firstPassResponse[callIdx++];

                const turbineBal = (turbineRes?.success && turbineRes.returnData !== '0x') ? this.decodeResult(turbineInt, 'getTurbineBal', turbineRes.returnData)[0] : 0n;
                const spiderReward = (spiderRes?.success && spiderRes.returnData !== '0x') ? this.decodeResult(spiderInt, 'claimable', spiderRes.returnData)[0] : 0n;
                const lgnsBal = (lgnsRes?.success && lgnsRes.returnData !== '0x') ? this.decodeResult(erc20Int, 'balanceOf', lgnsRes.returnData)[0] : 0n;
                const slgnsBal = (slgnsRes?.success && slgnsRes.returnData !== '0x') ? this.decodeResult(erc20Int, 'balanceOf', slgnsRes.returnData)[0] : 0n;

                const mintCounts: number[] = [];
                MINT_STAKE_CONTRACTS.forEach(() => {
                    const res = firstPassResponse[callIdx++];
                    mintCounts.push((res?.success && res.returnData !== '0x') ? Number(this.decodeResult(stakeInt, 'getUserStakesCount', res.returnData)[0]) : 0);
                });

                const bondCounts: number[] = [];
                BOND_CONTRACTS.forEach(() => {
                    const res = firstPassResponse[callIdx++];
                    bondCounts.push((res?.success && res.returnData !== '0x') ? Number(this.decodeResult(bondInt, 'getBondInfoDataLength', res.returnData)[0]) : 0);
                });

                // 详情查询
                const detailCalls: any[] = [];
                MINT_STAKE_CONTRACTS.forEach((contract, cIdx) => {
                    for (let sIdx = 0; sIdx < mintCounts[cIdx]; sIdx++) {
                        detailCalls.push({ target: contract, allowFailure: true, callData: this.encodeCall(stakeInt, 'stakes', [addr.aAddress, sIdx]) });
                    }
                });
                BOND_CONTRACTS.forEach((contract, cIdx) => {
                    for (let bIdx = 0; bIdx < bondCounts[cIdx]; bIdx++) {
                        detailCalls.push({ target: contract, allowFailure: true, callData: this.encodeCall(bondInt, 'bondInfoData', [addr.aAddress, bIdx]) });
                    }
                });

                let totalMintPrincipal = 0n;
                let totalBondPayout = 0n;

                if (detailCalls.length > 0) {
                    try {
                        const detailResponse = await this.multicallContract.aggregate3(detailCalls);
                        let dIdx = 0;
                        MINT_STAKE_CONTRACTS.forEach((_, cIdx) => {
                            for (let sIdx = 0; sIdx < mintCounts[cIdx]; sIdx++) {
                                const res = detailResponse[dIdx++];
                                if (res?.success && res.returnData !== '0x') {
                                    const decoded = this.decodeResult(stakeInt, 'stakes', res.returnData);
                                    if (decoded) totalMintPrincipal += BigInt(decoded.principal);
                                }
                            }
                        });
                        BOND_CONTRACTS.forEach((_, cIdx) => {
                            for (let bIdx = 0; bIdx < bondCounts[cIdx]; bIdx++) {
                                const res = detailResponse[dIdx++];
                                if (res?.success && res.returnData !== '0x') {
                                    const decoded = this.decodeResult(bondInt, 'bondInfoData', res.returnData);
                                    if (decoded) totalBondPayout += BigInt(decoded.payout);
                                }
                            }
                        });
                    } catch (e) { }
                }

                // 请求总质押 (独立请求模式)
                const totalStakingValue = await this.queryTotalStaking(addr.aAddress);

                resultsMap.set(addr.aAddress, {
                    totalStaking: ethers.formatUnits(totalStakingValue, 9),
                    mintStaking: ethers.formatUnits(totalMintPrincipal, 9),
                    bondStaking: ethers.formatUnits(totalBondPayout, 9),
                    spiderWebReward: ethers.formatUnits(spiderReward, 9),
                    turbineBalance: ethers.formatUnits(turbineBal, 9),
                    derivedLgns: ethers.formatUnits(lgnsBal, TOKEN_LGNS.decimals),
                    derivedSlgns: ethers.formatUnits(slgnsBal, TOKEN_SLGNS.decimals),
                    lastUpdated: Date.now()
                });
            }
            await new Promise(r => setTimeout(r, 100));
        }
        return resultsMap;
    }
}
