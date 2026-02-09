
import { ethers } from 'ethers';
import { 
    MULTICALL3_ADDRESS, 
    MULTICALL3_ABI, 
    ERC20_ABI, 
    STAKE_ABI, 
    STAKE_600_ABI,
    BOND_ABI, 
    TURBINE_ABI, 
    SPIDER_WEB_ABI,
    TOTAL_STAKE_MULTICALL_ABI,
    MINT_STAKE_CONTRACTS,
    BOND_CONTRACTS,
    STAKING_600_CONTRACT,
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
     * Correct implementation of the total staking query.
     * This matches the user's Node.js snippet exactly, using a custom hex payload
     * and a specific parsing strategy for the aggregator contract.
     */
    private async queryUserTotalStaking(userAddress: string): Promise<bigint> {
        try {
            const user_hex = userAddress.toLowerCase().replace('0x', '');
            
            // Exact hex template from the user's Node.js snippet
            const prefix = "0xffd7d741000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000099a57e6c8558bc6689f894e068733adf83c19725000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000247965d56d0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000309ca717d6989676194b88fd06029a88ceefee6000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000645ac983f400000000000000000000000099a57e6c8558bc6689f894e068733adf83c197250000000000000000000000001964ca90474b11ffd08af387b110ba6c96251bfc000000000000000000000000";
            const suffix = "00000000000000000000000000000000000000000000000000000000";
            const callData = prefix + user_hex + suffix;

            const result = await this.provider.call({
                to: TOTAL_STAKING_QUERY_CONTRACT,
                data: callData
            });

            if (result && result !== '0x') {
                const multicallInterface = new ethers.Interface(TOTAL_STAKE_MULTICALL_ABI);
                try {
                    const decoded = multicallInterface.decodeFunctionResult('multiCall', result);
                    const successes = decoded[0];
                    const results = decoded[1];

                    // Priority 1: From the second call (i === 1) as per Node.js snippet
                    if (results.length > 1 && successes[1] && results[1] !== '0x' && results[1].length === 66) {
                        return BigInt(results[1]);
                    }

                    // Priority 2: Iterate through all results to find a valid uint256
                    for (let i = 0; i < results.length; i++) {
                        if (successes[i] && results[i]?.length === 66) {
                            const val = BigInt(results[i]);
                            if (val > 1n) return val;
                        }
                    }
                } catch (e) {
                    // Fallback: Last 32 bytes of raw hex string
                    const hex = result.replace('0x', '');
                    if (hex.length >= 64) {
                        const last64 = hex.substring(hex.length - 64);
                        const val = BigInt('0x' + last64);
                        if (val > 0n && val < 1000000000000000n) return val;
                    }
                }
            }
            return 0n;
        } catch (error) {
            console.error(`Total staking query failed for ${userAddress}:`, error);
            return 0n;
        }
    }

    private async safeAggregate(calls: any[], chunkSize: number = 50): Promise<any[]> {
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

    async batchQuery(addresses: AddressEntry[], batchSize: number = 20): Promise<Map<string, StakingData>> {
        const resultsMap = new Map<string, StakingData>();
        const erc20Int = new ethers.Interface(ERC20_ABI);
        const stakeInt = new ethers.Interface(STAKE_ABI);
        const stake600Int = new ethers.Interface(STAKE_600_ABI);
        const bondInt = new ethers.Interface(BOND_ABI);
        const turbineInt = new ethers.Interface(TURBINE_ABI);
        const spiderInt = new ethers.Interface(SPIDER_WEB_ABI);

        const chunks: AddressEntry[][] = [];
        for (let i = 0; i < addresses.length; i += batchSize) {
            chunks.push(addresses.slice(i, i + batchSize));
        }

        for (const chunk of chunks) {
            // First, query the total staking for each address separately (non-multicall3)
            const totalStakingPromises = chunk.map(addr => this.queryUserTotalStaking(addr.aAddress));
            const totalAggResults = await Promise.all(totalStakingPromises);

            // Then, build multicall3 for all other parameters
            const summaryCalls: any[] = [];
            chunk.forEach(addr => {
                summaryCalls.push({ target: TURBINE_CONTRACT, allowFailure: true, callData: this.encodeCall(turbineInt, 'getTurbineBal', [addr.aAddress]) });
                summaryCalls.push({ target: SPIDER_WEB_CONTRACT, allowFailure: true, callData: this.encodeCall(spiderInt, 'claimable', [addr.aAddress]) });
                summaryCalls.push({ target: TOKEN_LGNS.address, allowFailure: true, callData: this.encodeCall(erc20Int, 'balanceOf', [addr.derivedAddress]) });
                summaryCalls.push({ target: TOKEN_SLGNS.address, allowFailure: true, callData: this.encodeCall(erc20Int, 'balanceOf', [addr.derivedAddress]) });
                MINT_STAKE_CONTRACTS.forEach(c => summaryCalls.push({ target: c, allowFailure: true, callData: this.encodeCall(stakeInt, 'getUserStakesCount', [addr.aAddress]) }));
                BOND_CONTRACTS.forEach(c => summaryCalls.push({ target: c, allowFailure: true, callData: this.encodeCall(bondInt, 'getBondInfoDataLength', [addr.aAddress]) }));
                summaryCalls.push({ target: STAKING_600_CONTRACT, allowFailure: true, callData: this.encodeCall(stake600Int, 'getUserStakesCount', [addr.aAddress]) });
            });

            const summaryRes = await this.safeAggregate(summaryCalls, 100);

            let callIdx = 0;
            const detailJobs: Promise<void>[] = [];

            chunk.forEach((addr, addrIdx) => {
                const turb = (summaryRes[callIdx++]?.success) ? (this.decodeResult(turbineInt, 'getTurbineBal', summaryRes[callIdx-1].returnData)?.[0] || 0n) : 0n;
                const spid = (summaryRes[callIdx++]?.success) ? (this.decodeResult(spiderInt, 'claimable', summaryRes[callIdx-1].returnData)?.[0] || 0n) : 0n;
                const lgns = (summaryRes[callIdx++]?.success) ? (this.decodeResult(erc20Int, 'balanceOf', summaryRes[callIdx-1].returnData)?.[0] || 0n) : 0n;
                const slgns = (summaryRes[callIdx++]?.success) ? (this.decodeResult(erc20Int, 'balanceOf', summaryRes[callIdx-1].returnData)?.[0] || 0n) : 0n;
                
                const mintCounts = MINT_STAKE_CONTRACTS.map(() => (summaryRes[callIdx++]?.success) ? Number(this.decodeResult(stakeInt, 'getUserStakesCount', summaryRes[callIdx-1].returnData)?.[0] || 0) : 0);
                const bondCounts = BOND_CONTRACTS.map(() => (summaryRes[callIdx++]?.success) ? Number(this.decodeResult(bondInt, 'getBondInfoDataLength', summaryRes[callIdx-1].returnData)?.[0] || 0) : 0);
                const count600D = (summaryRes[callIdx++]?.success) ? Number(this.decodeResult(stake600Int, 'getUserStakesCount', summaryRes[callIdx-1].returnData)?.[0] || 0) : 0;
                
                detailJobs.push((async () => {
                    let mintT = 0n, bondT = 0n, total600T = 0n;
                    const dCalls: any[] = [];
                    MINT_STAKE_CONTRACTS.forEach((c, ci) => { for(let j=0; j<mintCounts[ci]; j++) dCalls.push({ target: c, allowFailure: true, callData: this.encodeCall(stakeInt, 'stakes', [addr.aAddress, j]) }); });
                    BOND_CONTRACTS.forEach((c, ci) => { for(let j=0; j<bondCounts[ci]; j++) dCalls.push({ target: c, allowFailure: true, callData: this.encodeCall(bondInt, 'bondInfoData', [addr.aAddress, j]) }); });
                    for(let j=0; j<count600D; j++) dCalls.push({ target: STAKING_600_CONTRACT, allowFailure: true, callData: this.encodeCall(stake600Int, 'stakes', [addr.aAddress, j]) });

                    if (dCalls.length > 0) {
                        const dRes = await this.safeAggregate(dCalls, 150);
                        let di = 0;
                        mintCounts.forEach(cnt => { for(let j=0; j<cnt; j++) { const r = dRes[di++]; if(r?.success) mintT += BigInt(this.decodeResult(stakeInt, 'stakes', r.returnData)?.principal || 0n); } });
                        bondCounts.forEach(cnt => { for(let j=0; j<cnt; j++) { const r = dRes[di++]; if(r?.success) bondT += BigInt(this.decodeResult(bondInt, 'bondInfoData', r.returnData)?.payout || 0n); } });
                        for(let j=0; j<count600D; j++) { const r = dRes[di++]; if(r?.success) total600T += BigInt(this.decodeResult(stake600Int, 'stakes', r.returnData)?.principal || 0n); }
                    }

                    // Use the result from queryUserTotalStaking for the Aggregated Total field
                    const aggVal = totalAggResults[addrIdx];

                    resultsMap.set(addr.aAddress, {
                        totalStaking: ethers.formatUnits(aggVal, 9),
                        mintStaking: ethers.formatUnits(mintT, 9),
                        bondStaking: ethers.formatUnits(bondT, 9),
                        staking600Principal: ethers.formatUnits(total600T, 9),
                        spiderWebReward: ethers.formatUnits(spid, 9),
                        turbineBalance: ethers.formatUnits(turb, 9),
                        derivedLgns: ethers.formatUnits(lgns, TOKEN_LGNS.decimals),
                        derivedSlgns: ethers.formatUnits(slgns, TOKEN_SLGNS.decimals),
                        lastUpdated: Date.now()
                    });
                })());
            });
            await Promise.all(detailJobs);
        }
        return resultsMap;
    }
}
