
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
    STAKING_360_CONTRACT,
    TURBINE_CONTRACT,
    SPIDER_WEB_CONTRACT,
    DAO_CLAIMABLE_CONTRACT,
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
            let retries = 3;
            let success = false;
            while (retries > 0 && !success) {
                try {
                    const response = await this.multicallContract.aggregate3(chunk);
                    results.push(...response);
                    success = true;
                } catch (e) {
                    retries--;
                    if (retries === 0) {
                        console.error("Multicall failed after retries:", e);
                        results.push(...chunk.map(() => ({ success: false, returnData: '0x' })));
                    } else {
                        await new Promise(r => setTimeout(r, 1000)); // Wait 1s before retry
                    }
                }
            }
        }
        return results;
    }

    async batchQuery(addresses: AddressEntry[], batchSize: number = 10): Promise<Map<string, StakingData>> {
        const resultsMap = new Map<string, StakingData>();
        
        const erc20Int = new ethers.Interface(ERC20_ABI);
        const turbineInt = new ethers.Interface(TURBINE_ABI);
        const spiderInt = new ethers.Interface(SPIDER_WEB_ABI);

        // Process in chunks to avoid overwhelming RPC
        for (let i = 0; i < addresses.length; i += batchSize) {
            const chunk = addresses.slice(i, i + batchSize);
            
            // Phase 1: Batch "Simple" queries across all users in the chunk
            const simpleCalls: any[] = [];
            chunk.forEach(addr => {
                simpleCalls.push({ target: TURBINE_CONTRACT, allowFailure: true, callData: this.encodeCall(turbineInt, 'getTurbineBal', [addr.aAddress]) });
                simpleCalls.push({ target: SPIDER_WEB_CONTRACT, allowFailure: true, callData: this.encodeCall(spiderInt, 'claimable', [addr.aAddress]) });
                simpleCalls.push({ target: DAO_CLAIMABLE_CONTRACT, allowFailure: true, callData: this.encodeCall(spiderInt, 'claimable', [addr.aAddress]) });
                simpleCalls.push({ target: TOKEN_LGNS.address, allowFailure: true, callData: this.encodeCall(erc20Int, 'balanceOf', [addr.derivedAddress]) });
                simpleCalls.push({ target: TOKEN_SLGNS.address, allowFailure: true, callData: this.encodeCall(erc20Int, 'balanceOf', [addr.derivedAddress]) });
            });

            const simpleRes = await this.safeAggregate(simpleCalls, 100);

            // Phase 2: Parallel "Complex" queries per user (MINT, BOND, 600D, Total Staking)
            const complexPromises = chunk.map(async (addr, idx) => {
                try {
                    // Extract simple results for this user
                    const baseIdx = idx * 5;
                    const turb = (simpleRes[baseIdx]?.success) ? (this.decodeResult(turbineInt, 'getTurbineBal', simpleRes[baseIdx].returnData)?.[0] || 0n) : 0n;
                    const spid = (simpleRes[baseIdx + 1]?.success) ? (this.decodeResult(spiderInt, 'claimable', simpleRes[baseIdx + 1].returnData)?.[0] || 0n) : 0n;
                    const daoC = (simpleRes[baseIdx + 2]?.success) ? (this.decodeResult(spiderInt, 'claimable', simpleRes[baseIdx + 2].returnData)?.[0] || 0n) : 0n;
                    const lgns = (simpleRes[baseIdx + 3]?.success) ? (this.decodeResult(erc20Int, 'balanceOf', simpleRes[baseIdx + 3].returnData)?.[0] || 0n) : 0n;
                    const slgns = (simpleRes[baseIdx + 4]?.success) ? (this.decodeResult(erc20Int, 'balanceOf', simpleRes[baseIdx + 4].returnData)?.[0] || 0n) : 0n;

                    // Query complex staking data
                    const complexData = await this.queryComplexStaking(addr);

                    resultsMap.set(addr.aAddress, {
                        totalStaking: complexData.totalStaking || '0',
                        mintStaking: complexData.mintStaking || '0',
                        bondStaking: complexData.bondStaking || '0',
                        staking600Principal: complexData.staking600Principal || '0',
                        staking360Principal: complexData.staking360Principal || '0',
                        spiderWebReward: ethers.formatUnits(spid, 9),
                        turbineBalance: ethers.formatUnits(turb, 9),
                        daoClaimable: ethers.formatUnits(daoC, 9),
                        derivedLgns: ethers.formatUnits(lgns, TOKEN_LGNS.decimals),
                        derivedSlgns: ethers.formatUnits(slgns, TOKEN_SLGNS.decimals),
                        lastUpdated: Date.now()
                    });
                } catch (error) {
                    console.error(`Failed to query complex data for ${addr.aAddress}:`, error);
                }
            });

            await Promise.all(complexPromises);
            
            // Small delay between chunks
            if (i + batchSize < addresses.length) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }
        
        return resultsMap;
    }

    private async queryComplexStaking(addr: AddressEntry): Promise<Partial<StakingData>> {
        const stakeInt = new ethers.Interface(STAKE_ABI);
        const stake600Int = new ethers.Interface(STAKE_600_ABI);
        const bondInt = new ethers.Interface(BOND_ABI);

        // 1. Total Staking (Custom Call)
        const totalStakingPromise = this.queryUserTotalStaking(addr.aAddress);

        // 2. Staking Summary (MINT Balances, BOND Counts, 600D Count)
        const summaryCalls: any[] = [];
        MINT_STAKE_CONTRACTS.forEach(c => {
            summaryCalls.push({ target: c, allowFailure: true, callData: this.encodeCall(stakeInt, 'getDepositorBalance', [addr.aAddress]) });
        });
        BOND_CONTRACTS.forEach(c => {
            summaryCalls.push({ target: c, allowFailure: true, callData: this.encodeCall(bondInt, 'getBondInfoDataLength', [addr.aAddress]) });
        });
        summaryCalls.push({ target: STAKING_600_CONTRACT, allowFailure: true, callData: this.encodeCall(stake600Int, 'getUserStakesCount', [addr.aAddress]) });
        summaryCalls.push({ target: STAKING_360_CONTRACT, allowFailure: true, callData: this.encodeCall(stake600Int, 'getUserStakesCount', [addr.aAddress]) });

        const [totalStaking, summaryRes] = await Promise.all([
            totalStakingPromise,
            this.safeAggregate(summaryCalls, 50)
        ]);

        let callIdx = 0;
        let mintT = 0n;
        MINT_STAKE_CONTRACTS.forEach(() => {
            const res = summaryRes[callIdx++];
            if (res?.success) {
                mintT += BigInt(this.decodeResult(stakeInt, 'getDepositorBalance', res.returnData)?.[0] || 0n);
            }
        });

        const bondCounts = BOND_CONTRACTS.map(() => (summaryRes[callIdx++]?.success) ? Number(this.decodeResult(bondInt, 'getBondInfoDataLength', summaryRes[callIdx-1].returnData)?.[0] || 0) : 0);
        const count600D = (summaryRes[callIdx++]?.success) ? Number(this.decodeResult(stake600Int, 'getUserStakesCount', summaryRes[callIdx-1].returnData)?.[0] || 0) : 0;
        const count360D = (summaryRes[callIdx++]?.success) ? Number(this.decodeResult(stake600Int, 'getUserStakesCount', summaryRes[callIdx-1].returnData)?.[0] || 0) : 0;

        // 3. Staking Details (600D, 360D, and Bonds)
        let bondT = 0n, total600T = 0n, total360T = 0n;
        const detailCalls: any[] = [];
        for (let j = 0; j < count600D; j++) {
            detailCalls.push({ target: STAKING_600_CONTRACT, allowFailure: true, callData: this.encodeCall(stake600Int, 'stakes', [addr.aAddress, j]) });
        }
        for (let j = 0; j < count360D; j++) {
            detailCalls.push({ target: STAKING_360_CONTRACT, allowFailure: true, callData: this.encodeCall(stake600Int, 'stakes', [addr.aAddress, j]) });
        }
        BOND_CONTRACTS.forEach((c, ci) => {
            for (let j = 0; j < bondCounts[ci]; j++) {
                detailCalls.push({ target: c, allowFailure: true, callData: this.encodeCall(bondInt, 'bondInfoData', [addr.aAddress, j]) });
            }
        });

        if (detailCalls.length > 0) {
            const detailRes = await this.safeAggregate(detailCalls, 50);
            let di = 0;
            for (let j = 0; j < count600D; j++) {
                const r = detailRes[di++];
                if (r?.success) total600T += BigInt(this.decodeResult(stake600Int, 'stakes', r.returnData)?.principal || 0n);
            }
            for (let j = 0; j < count360D; j++) {
                const r = detailRes[di++];
                if (r?.success) total360T += BigInt(this.decodeResult(stake600Int, 'stakes', r.returnData)?.principal || 0n);
            }
            bondCounts.forEach(cnt => {
                for (let j = 0; j < cnt; j++) {
                    const r = detailRes[di++];
                    if (r?.success) bondT += BigInt(this.decodeResult(bondInt, 'bondInfoData', r.returnData)?.payout || 0n);
                }
            });
        }

        return {
            totalStaking: ethers.formatUnits(totalStaking, 9),
            mintStaking: ethers.formatUnits(mintT, 9),
            bondStaking: ethers.formatUnits(bondT, 9),
            staking600Principal: ethers.formatUnits(total600T, 9),
            staking360Principal: ethers.formatUnits(total360T, 9)
        };
    }
}
