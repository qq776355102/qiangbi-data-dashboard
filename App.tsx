
import { 
    Search, 
    RefreshCcw, 
    Upload, 
    Edit2, 
    Copy, 
    Check, 
    Zap, 
    Server,
    Activity,
    TrendingUp,
    ArrowUpRight,
    Wallet,
    Info,
    Coins,
    Layers,
    FileJson,
    ArrowUpDown,
    ArrowUp,
    ArrowDown
} from 'lucide-react';
import React, { useState, useEffect, useMemo } from 'react';
import { AddressEntry, StakingData } from './types.ts';
import { DEFAULT_RPC } from './constants.ts';
import { BlockchainService } from './services/blockchainService.ts';

const INITIAL_ADDRESSES: AddressEntry[] = [
    {
      aAddress: "0xC37E77d615f76Ec8e45C36958a0737883473AD95",
      log: "5月20号",
      remark: "Demo Account",
      derivedAddress: "0x78D610443156584b7aacDE6102B5AEABE2C51F85",
      split: "5-5开"
    }
];

type SortKey = 'total' | 'mint' | 'bond' | 'staking600' | 'staking360' | 'turb' | 'spid' | 'governance' | null;
type SortDirection = 'asc' | 'desc';

export default function App() {
    const [addresses, setAddresses] = useState<AddressEntry[]>([]);
    const [stakingData, setStakingData] = useState<Record<string, StakingData>>({});
    const [rpcUrl, setRpcUrl] = useState(DEFAULT_RPC);
    const [batchSize, setBatchSize] = useState(20); 
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [editingRemark, setEditingRemark] = useState<{ address: string, value: string } | null>(null);
    const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
    const [rpcStatus, setRpcStatus] = useState<'idle' | 'ok' | 'error'>('idle');
    const [sortKey, setSortKey] = useState<SortKey>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    useEffect(() => {
        const saved = localStorage.getItem('polygon_addresses');
        if (saved) {
            setAddresses(JSON.parse(saved));
        } else {
            setAddresses(INITIAL_ADDRESSES);
            saveAddresses(INITIAL_ADDRESSES);
        }
        const savedStats = localStorage.getItem('polygon_staking_stats');
        if (savedStats) setStakingData(JSON.parse(savedStats));
    }, []);

    const saveAddresses = (newAddresses: AddressEntry[]) => {
        setAddresses(newAddresses);
        localStorage.setItem('polygon_addresses', JSON.stringify(newAddresses));
    };

    const handleUpdateRemark = (address: string, newValue: string) => {
        const updated = addresses.map(item => 
            item.aAddress.toLowerCase() === address.toLowerCase() ? { ...item, remark: newValue } : item
        );
        saveAddresses(updated);
        setEditingRemark(null);
    };

    const handleRefresh = async () => {
        if (addresses.length === 0) return;
        setLoading(true);
        setRpcStatus('idle');
        try {
            const service = new BlockchainService(rpcUrl);
            const results = await service.batchQuery(addresses, batchSize);
            const newStakingData = Object.fromEntries(results);
            
            setStakingData(prev => {
                const updated = { ...prev, ...newStakingData };
                localStorage.setItem('polygon_staking_stats', JSON.stringify(updated));
                return updated;
            });
            
            setRpcStatus('ok');
        } catch (error) {
            console.error("Refresh error:", error);
            setRpcStatus('error');
        } finally {
            setLoading(false);
        }
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                let importedItems = Array.isArray(json) ? json : json.items || [];
                if (importedItems.length > 0) saveAddresses(importedItems);
            } catch (err) { alert("Invalid JSON"); }
        };
        reader.readAsText(file);
    };

    const handleExport = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(addresses, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", "polygon_addresses.json");
        downloadAnchor.click();
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedAddress(text);
        setTimeout(() => setCopiedAddress(null), 2000);
    };

    const handleSort = (key: SortKey) => {
        if (sortKey !== key) {
            setSortKey(key);
            setSortDirection('desc');
        } else {
            if (sortDirection === 'desc') {
                setSortDirection('asc');
            } else {
                setSortKey(null);
            }
        }
    };

    const displayAddresses = useMemo(() => {
        let result = addresses.filter(a => 
            (a.remark || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
            (a.aAddress || "").toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (sortKey && sortDirection) {
            result.sort((a, b) => {
                const dataA = stakingData[a.aAddress];
                const dataB = stakingData[b.aAddress];

                let valA = 0;
                let valB = 0;

                switch (sortKey) {
                    case 'total':
                        valA = parseFloat(dataA?.totalStaking || '0');
                        valB = parseFloat(dataB?.totalStaking || '0');
                        break;
                    case 'mint':
                        valA = parseFloat(dataA?.mintStaking || '0');
                        valB = parseFloat(dataB?.mintStaking || '0');
                        break;
                    case 'bond':
                        valA = parseFloat(dataA?.bondStaking || '0');
                        valB = parseFloat(dataB?.bondStaking || '0');
                        break;
                    case 'staking600':
                        valA = parseFloat(dataA?.staking600Principal || '0');
                        valB = parseFloat(dataB?.staking600Principal || '0');
                        break;
                    case 'staking360':
                        valA = parseFloat(dataA?.staking360Principal || '0');
                        valB = parseFloat(dataB?.staking360Principal || '0');
                        break;
                    case 'turb':
                        valA = parseFloat(dataA?.turbineBalance || '0');
                        valB = parseFloat(dataB?.turbineBalance || '0');
                        break;
                    case 'spid':
                        valA = parseFloat(dataA?.spiderWebReward || '0');
                        valB = parseFloat(dataB?.spiderWebReward || '0');
                        break;
                    case 'governance':
                        valA = parseFloat(dataA?.derivedLgns || '0') + parseFloat(dataA?.derivedSlgns || '0');
                        valB = parseFloat(dataB?.derivedLgns || '0') + parseFloat(dataB?.derivedSlgns || '0');
                        break;
                }

                return sortDirection === 'asc' ? valA - valB : valB - valA;
            });
        }

        return result;
    }, [addresses, searchTerm, stakingData, sortKey, sortDirection]);

    const globalStats = useMemo(() => {
        let totals = { val: 0, turb: 0, spid: 0, dao: 0, mint: 0, bond: 0, s600: 0, s360: 0, dlgns: 0, dslgns: 0 };
        displayAddresses.forEach(addr => {
            const data = stakingData[addr.aAddress];
            if (data) {
                totals.val += parseFloat(data.totalStaking) || 0;
                totals.turb += parseFloat(data.turbineBalance) || 0;
                totals.spid += parseFloat(data.spiderWebReward) || 0;
                totals.dao += parseFloat(data.daoClaimable) || 0;
                totals.mint += parseFloat(data.mintStaking) || 0;
                totals.bond += parseFloat(data.bondStaking) || 0;
                totals.s600 += parseFloat(data.staking600Principal) || 0;
                totals.s360 += parseFloat(data.staking360Principal) || 0;
                totals.dlgns += parseFloat(data.derivedLgns) || 0;
                totals.dslgns += parseFloat(data.derivedSlgns) || 0;
            }
        });
        return totals;
    }, [stakingData, displayAddresses]);

    return (
        <div className="max-w-[1600px] mx-auto px-4 py-6 pb-12">
            {/* Header Area */}
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-500/30">
                        <Zap className="text-white w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-white tracking-tighter italic">
                            Polygon <span className="text-indigo-400">Dash</span>
                        </h1>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 w-full lg:w-auto">
                    <div className="bg-slate-800/60 p-2.5 rounded-xl border border-white/5 flex items-center gap-3">
                        <Server className={`w-4 h-4 ${rpcStatus === 'error' ? 'text-red-500' : 'text-emerald-500'}`} />
                        <select 
                            value={batchSize}
                            onChange={(e) => setBatchSize(Number(e.target.value))}
                            className="bg-transparent text-indigo-400 text-[10px] font-black outline-none cursor-pointer tracking-widest uppercase"
                        >
                            <option value={5}>Stable (5)</option>
                            <option value={10}>Normal (10)</option>
                            <option value={20}>Fast (20)</option>
                            <option value={30}>Turbo (30)</option>
                            <option value={40}>Pro (40)</option>
                            <option value={50}>Ultra (50)</option>
                        </select>
                    </div>
                    <input 
                        type="text" 
                        value={rpcUrl}
                        onChange={(e) => setRpcUrl(e.target.value)}
                        className="bg-slate-800/40 border border-white/5 text-slate-300 rounded-xl px-4 py-2.5 text-xs flex-1 lg:w-[280px] outline-none font-mono focus:border-indigo-500/30 transition-all"
                        placeholder="RPC Node"
                    />
                    <button 
                        onClick={handleRefresh}
                        disabled={loading || addresses.length === 0}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs transition-all ${
                            loading ? 'bg-slate-700 text-slate-400' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                        }`}
                    >
                        <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        {loading ? 'SYNCING...' : 'REFRESH'}
                    </button>
                </div>
            </header>

            {/* Global Quick Stats */}
            <div className="flex flex-wrap gap-4 mb-10">
                <MiniBar label="TOTAL STAKED" value={globalStats.val} color="indigo" onClick={() => handleSort('total')} active={sortKey === 'total'} sortDir={sortKey === 'total' ? sortDirection : undefined} />
                <MiniBar label="MINT POOL" value={globalStats.mint} color="blue" onClick={() => handleSort('mint')} active={sortKey === 'mint'} sortDir={sortKey === 'mint' ? sortDirection : undefined} />
                <MiniBar label="BOND ASSETS" value={globalStats.bond} color="purple" onClick={() => handleSort('bond')} active={sortKey === 'bond'} sortDir={sortKey === 'bond' ? sortDirection : undefined} />
                <MiniBar label="600D POOL" value={globalStats.s600} color="indigo" onClick={() => handleSort('staking600')} active={sortKey === 'staking600'} sortDir={sortKey === 'staking600' ? sortDirection : undefined} />
                <MiniBar label="360D POOL" value={globalStats.s360} color="sky" onClick={() => handleSort('staking360')} active={sortKey === 'staking360'} sortDir={sortKey === 'staking360' ? sortDirection : undefined} />
                <MiniBar label="TURBINE" value={globalStats.turb} color="emerald" onClick={() => handleSort('turb')} active={sortKey === 'turb'} sortDir={sortKey === 'turb' ? sortDirection : undefined} />
                <MiniBar label="SPIDER" value={globalStats.spid} color="amber" onClick={() => handleSort('spid')} active={sortKey === 'spid'} sortDir={sortKey === 'spid' ? sortDirection : undefined} />
                <MiniBar label="DAO CLAIM" value={globalStats.dao} color="rose" />
                <MiniBar label="LGNS" value={globalStats.dlgns} color="pink" onClick={() => handleSort('governance')} active={sortKey === 'governance'} sortDir={sortKey === 'governance' ? sortDirection : undefined} />
                <MiniBar label="SLGNS" value={globalStats.dslgns} color="cyan" onClick={() => handleSort('governance')} active={sortKey === 'governance'} sortDir={sortKey === 'governance' ? sortDirection : undefined} />
            </div>

            {/* Table Container */}
            <div className="bg-slate-900/80 backdrop-blur-2xl border border-white/5 rounded-[2rem] shadow-3xl overflow-hidden">
                <div className="p-5 border-b border-white/5 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="relative w-[300px]">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                            <input 
                                type="text" 
                                placeholder="Quick search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-black/40 border border-white/5 text-slate-100 rounded-xl pl-11 pr-4 py-3 w-full outline-none focus:border-indigo-500/20 text-sm"
                            />
                        </div>
                        {sortKey && (
                            <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-3 py-2 rounded-xl text-xs text-indigo-300 font-bold">
                                <span>排序: <span className="uppercase text-white">{
                                    sortKey === 'total' ? '总质押合计' :
                                    sortKey === 'mint' ? 'Mint质押' :
                                    sortKey === 'bond' ? 'Bond质押' :
                                    sortKey === 'staking600' ? '600天质押' :
                                    sortKey === 'staking360' ? '360天质押' :
                                    sortKey === 'turb' ? 'TURB' :
                                    sortKey === 'spid' ? 'SPID' : '治理资产'
                                }</span> ({sortDirection === 'desc' ? '高→低' : '低→高'})</span>
                                <button onClick={() => setSortKey(null)} className="hover:text-white text-slate-400 font-black ml-1 bg-slate-800 rounded-md px-1.5 py-0.5 text-[10px]">✕ 清除</button>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => document.getElementById('import-file')?.click()} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors border border-white/5">
                            <Upload className="w-4 h-4 text-slate-400" />
                            <input id="import-file" type="file" className="hidden" onChange={handleImport} />
                        </button>
                        <button onClick={handleExport} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors border border-white/5">
                            <FileJson className="w-4 h-4 text-slate-400" />
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse table-fixed">
                        <thead>
                            <tr className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] bg-white/[0.01]">
                                <th className="px-8 py-6 w-[16%]">Wallet Identity</th>
                                <th className="px-4 py-6 w-[22%] select-none">
                                    <div className="flex flex-col gap-1.5">
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Staking Breakdown</span>
                                        <div className="flex items-center gap-1 flex-wrap">
                                            <button 
                                                onClick={() => handleSort('mint')}
                                                className={`text-[7px] font-black px-1.5 py-0.5 rounded border transition-all flex items-center gap-0.5 cursor-pointer ${
                                                    sortKey === 'mint' 
                                                        ? 'bg-blue-500/30 text-blue-300 border-blue-400 shadow-sm' 
                                                        : 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20'
                                                }`}
                                            >
                                                MINT
                                                {sortKey === 'mint' && (sortDirection === 'desc' ? <ArrowDown className="w-2 h-2" /> : <ArrowUp className="w-2 h-2" />)}
                                            </button>
                                            <button 
                                                onClick={() => handleSort('bond')}
                                                className={`text-[7px] font-black px-1.5 py-0.5 rounded border transition-all flex items-center gap-0.5 cursor-pointer ${
                                                    sortKey === 'bond' 
                                                        ? 'bg-purple-500/30 text-purple-300 border-purple-400 shadow-sm' 
                                                        : 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20'
                                                }`}
                                            >
                                                BOND
                                                {sortKey === 'bond' && (sortDirection === 'desc' ? <ArrowDown className="w-2 h-2" /> : <ArrowUp className="w-2 h-2" />)}
                                            </button>
                                            <button 
                                                onClick={() => handleSort('staking600')}
                                                className={`text-[7px] font-black px-1.5 py-0.5 rounded border transition-all flex items-center gap-0.5 cursor-pointer ${
                                                    sortKey === 'staking600' 
                                                        ? 'bg-indigo-500/30 text-indigo-300 border-indigo-400 shadow-sm' 
                                                        : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20'
                                                }`}
                                            >
                                                600D
                                                {sortKey === 'staking600' && (sortDirection === 'desc' ? <ArrowDown className="w-2 h-2" /> : <ArrowUp className="w-2 h-2" />)}
                                            </button>
                                            <button 
                                                onClick={() => handleSort('staking360')}
                                                className={`text-[7px] font-black px-1.5 py-0.5 rounded border transition-all flex items-center gap-0.5 cursor-pointer ${
                                                    sortKey === 'staking360' 
                                                        ? 'bg-sky-500/30 text-sky-300 border-sky-400 shadow-sm' 
                                                        : 'bg-sky-500/10 text-sky-400 border-sky-500/20 hover:bg-sky-500/20'
                                                }`}
                                            >
                                                360D
                                                {sortKey === 'staking360' && (sortDirection === 'desc' ? <ArrowDown className="w-2 h-2" /> : <ArrowUp className="w-2 h-2" />)}
                                            </button>
                                        </div>
                                    </div>
                                </th>
                                <th 
                                    className="px-4 py-6 w-[16%] text-center cursor-pointer group/header select-none hover:bg-white/[0.02] transition-colors"
                                    onClick={() => handleSort('total')}
                                >
                                    <div className="flex items-center justify-center gap-1.5">
                                        <span>总质押合计</span>
                                        <div className={`p-1 rounded bg-slate-800 transition-all ${sortKey === 'total' ? 'text-indigo-400' : 'text-slate-600'}`}>
                                            {sortKey === 'total' ? (sortDirection === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                                        </div>
                                    </div>
                                </th>
                                <th className="px-4 py-6 w-[13%] text-right select-none">
                                    <div className="flex flex-col items-end gap-1.5">
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Yield Portfolio</span>
                                        <div className="flex items-center justify-end gap-1 flex-wrap">
                                            <button 
                                                onClick={() => handleSort('turb')}
                                                className={`text-[7px] font-black px-1.5 py-0.5 rounded border transition-all flex items-center gap-0.5 cursor-pointer ${
                                                    sortKey === 'turb' 
                                                        ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400 shadow-sm' 
                                                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                                }`}
                                            >
                                                TURB
                                                {sortKey === 'turb' && (sortDirection === 'desc' ? <ArrowDown className="w-2 h-2" /> : <ArrowUp className="w-2 h-2" />)}
                                            </button>
                                            <button 
                                                onClick={() => handleSort('spid')}
                                                className={`text-[7px] font-black px-1.5 py-0.5 rounded border transition-all flex items-center gap-0.5 cursor-pointer ${
                                                    sortKey === 'spid' 
                                                        ? 'bg-amber-500/30 text-amber-300 border-amber-400 shadow-sm' 
                                                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                                                }`}
                                            >
                                                SPID
                                                {sortKey === 'spid' && (sortDirection === 'desc' ? <ArrowDown className="w-2 h-2" /> : <ArrowUp className="w-2 h-2" />)}
                                            </button>
                                        </div>
                                    </div>
                                </th>
                                <th className="px-4 py-6 w-[11%] text-right">DAO Claimable</th>
                                <th 
                                    className="px-4 py-6 w-[14%] cursor-pointer group/header select-none hover:bg-white/[0.02] transition-colors"
                                    onClick={() => handleSort('governance')}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span>Governance Assets</span>
                                        <div className={`p-1 rounded bg-slate-800 transition-all ${sortKey === 'governance' ? 'text-indigo-400' : 'text-slate-600'}`}>
                                            {sortKey === 'governance' ? (sortDirection === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                                        </div>
                                    </div>
                                </th>
                                <th className="px-8 py-6 w-[8%] text-center">Pulse</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.02]">
                            {displayAddresses.map((addr) => {
                                const data = stakingData[addr.aAddress];
                                return (
                                    <tr key={addr.aAddress} className="group hover:bg-indigo-500/[0.02] transition-colors border-b border-white/[0.01]">
                                        {/* Wallet Identity */}
                                        <td className="px-8 py-8">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center gap-2">
                                                    {editingRemark?.address === addr.aAddress ? (
                                                        <input autoFocus className="bg-black border border-indigo-500/50 rounded-lg px-3 py-1 text-white outline-none w-full text-lg font-black" value={editingRemark.value} onChange={(e) => setEditingRemark({ ...editingRemark, value: e.target.value })} onBlur={() => handleUpdateRemark(addr.aAddress, editingRemark.value)} />
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-black text-xl text-slate-100 tracking-tighter group-hover:text-indigo-400 transition-colors">{addr.remark || 'N/A'}</span>
                                                            <button onClick={() => setEditingRemark({ address: addr.aAddress, value: addr.remark })} className="opacity-0 group-hover:opacity-100 p-1 bg-slate-800 rounded-md text-slate-500 hover:text-white transition-all"><Edit2 className="w-2.5 h-2.5" /></button>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5 opacity-50 group-hover:opacity-100 transition-opacity">
                                                    <span className="text-[9px] font-mono text-slate-400 tracking-tight">{addr.aAddress.slice(0, 8)}...{addr.aAddress.slice(-6)}</span>
                                                    <button onClick={() => copyToClipboard(addr.aAddress)} className="hover:text-indigo-400">
                                                        {copiedAddress === addr.aAddress ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                                    </button>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Staking Breakdown */}
                                        <td className="px-4 py-8">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-10 text-[7px] font-black bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20 text-center">MINT</div>
                                                    <span className="font-black text-white text-base">{formatNum(data?.mintStaking || '0')}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-10 text-[7px] font-black bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/20 text-center">BOND</div>
                                                    <span className="font-black text-white text-base">{formatNum(data?.bondStaking || '0')}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-10 text-[7px] font-black bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/30 text-center">600D</div>
                                                    <span className="font-black text-white text-base">{formatNum(data?.staking600Principal || '0')}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-10 text-[7px] font-black bg-sky-500/10 text-sky-400 px-1.5 py-0.5 rounded border border-sky-500/20 text-center">360D</div>
                                                    <span className="font-black text-white text-base">{formatNum(data?.staking360Principal || '0')}</span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* 总质押合计 */}
                                        <td className="px-4 py-8">
                                            <div className="flex flex-col items-center">
                                                <div className="bg-black rounded-3xl px-8 py-4 border border-white/5 shadow-inner group-hover:border-indigo-500/30 transition-all min-w-[140px] text-center">
                                                    <span className="text-2xl font-black text-white tracking-tighter italic">
                                                        {formatNum(data?.totalStaking || '0', 2, 2)}
                                                    </span>
                                                </div>
                                                <span className="text-[7px] text-slate-600 font-black mt-2 tracking-[0.2em] uppercase">AGGREGATED TOTAL</span>
                                            </div>
                                        </td>

                                        {/* Yield Portfolio */}
                                        <td className="px-4 py-8">
                                            <div className="flex flex-col items-end gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-emerald-400 text-sm">{formatNum(data?.turbineBalance || '0')}</span>
                                                    <span className="text-[7px] font-black bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded border border-emerald-500/10">TURB</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-amber-500 text-sm">{formatNum(data?.spiderWebReward || '0')}</span>
                                                    <span className="text-[7px] font-black bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/10">SPID</span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* DAO Claimable */}
                                        <td className="px-4 py-8">
                                            <div className="flex flex-col items-end gap-1">
                                                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2 text-right group-hover:bg-rose-500/20 transition-all">
                                                    <span className="text-rose-400 font-black text-sm block tracking-tighter">
                                                        {formatNum(data?.daoClaimable || '0')}
                                                    </span>
                                                    <span className="text-[6px] text-rose-500/60 font-black uppercase tracking-widest">DAO LGNS</span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Governance Assets */}
                                        <td className="px-4 py-8">
                                            <div className="flex flex-col gap-2 w-full max-w-[140px]">
                                                <div className="flex justify-between items-center px-3 py-2.5 bg-black/60 rounded-xl border border-white/5">
                                                    <span className="text-[8px] text-slate-500 font-black">LGNS</span>
                                                    <span className="text-pink-400 font-black text-xs">{formatNum(data?.derivedLgns || '0')}</span>
                                                </div>
                                                <div className="flex justify-between items-center px-3 py-2.5 bg-black/60 rounded-xl border border-white/5">
                                                    <span className="text-[8px] text-slate-500 font-black italic">SLGNS</span>
                                                    <span className="text-cyan-400 font-black text-xs">{formatNum(data?.derivedSlgns || '0')}</span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Pulse */}
                                        <td className="px-8 py-8 text-center">
                                            <div className="inline-block px-3 py-1.5 bg-black/40 rounded-lg border border-white/5 text-slate-600 font-black text-[8px] tracking-widest group-hover:text-indigo-400 transition-all">
                                                {addr.log}
                                            </div>
                                            {data?.lastUpdated && (
                                                <div className="text-[7px] text-slate-700 mt-2 font-mono">
                                                    {new Date(data.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function MiniBar({ 
    label, 
    value, 
    color, 
    onClick, 
    active, 
    sortDir 
}: { 
    label: string, 
    value: number, 
    color: string, 
    onClick?: () => void, 
    active?: boolean, 
    sortDir?: SortDirection 
}) {
    const colorMap: Record<string, string> = {
        indigo: 'border-indigo-500/30 text-indigo-400 bg-indigo-500/5',
        blue: 'border-blue-500/30 text-blue-400 bg-blue-500/5',
        purple: 'border-purple-500/30 text-purple-400 bg-purple-500/5',
        emerald: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5',
        amber: 'border-amber-500/30 text-amber-400 bg-amber-500/5',
        rose: 'border-rose-500/30 text-rose-400 bg-rose-500/5',
        pink: 'border-pink-500/30 text-pink-400 bg-pink-500/5',
        cyan: 'border-cyan-500/30 text-cyan-400 bg-cyan-500/5',
        sky: 'border-sky-500/30 text-sky-400 bg-sky-500/5',
    };

    return (
        <div 
            onClick={onClick}
            className={`flex flex-col px-5 py-3 rounded-2xl border ${colorMap[color]} backdrop-blur-sm min-w-[140px] ${
                onClick ? 'cursor-pointer hover:opacity-80 transition-all select-none' : ''
            } ${active ? 'ring-2 ring-indigo-500/50 bg-indigo-500/20' : ''}`}
        >
            <div className="flex items-center justify-between mb-1">
                <span className="text-[8px] font-black tracking-widest uppercase opacity-60">{label}</span>
                {active && sortDir && (
                    <span className="text-[10px] text-indigo-400 font-black">
                        {sortDir === 'desc' ? '↓' : '↑'}
                    </span>
                )}
            </div>
            <span className="text-lg font-black tracking-tighter">{value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
        </div>
    );
}

function formatNum(val: string, minDec = 2, maxDec = 2) {
    const n = parseFloat(val);
    if (isNaN(n) || n === 0) return '0.00';
    return n.toLocaleString(undefined, { minimumFractionDigits: minDec, maximumFractionDigits: maxDec });
}
