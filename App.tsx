
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

type SortDirection = 'asc' | 'desc' | null;

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
    const [sortDirection, setSortDirection] = useState<SortDirection>(null);

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
            setStakingData(prev => ({ ...prev, ...newStakingData }));
            localStorage.setItem('polygon_staking_stats', JSON.stringify({ ...stakingData, ...newStakingData }));
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

    const handleSortToggle = () => {
        if (sortDirection === null) setSortDirection('desc');
        else if (sortDirection === 'desc') setSortDirection('asc');
        else setSortDirection(null);
    };

    const displayAddresses = useMemo(() => {
        let result = addresses.filter(a => 
            (a.remark || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
            (a.aAddress || "").toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (sortDirection) {
            result.sort((a, b) => {
                const valA = parseFloat(stakingData[a.aAddress]?.derivedLgns || '0');
                const valB = parseFloat(stakingData[b.aAddress]?.derivedLgns || '0');
                return sortDirection === 'asc' ? valA - valB : valB - valA;
            });
        }

        return result;
    }, [addresses, searchTerm, stakingData, sortDirection]);

    const globalStats = useMemo(() => {
        let totals = { val: 0, turb: 0, spid: 0, mint: 0, bond: 0, s600: 0, dlgns: 0, dslgns: 0 };
        displayAddresses.forEach(addr => {
            const data = stakingData[addr.aAddress];
            if (data) {
                totals.val += parseFloat(data.totalStaking) || 0;
                totals.turb += parseFloat(data.turbineBalance) || 0;
                totals.spid += parseFloat(data.spiderWebReward) || 0;
                totals.mint += parseFloat(data.mintStaking) || 0;
                totals.bond += parseFloat(data.bondStaking) || 0;
                totals.s600 += parseFloat(data.staking600Principal) || 0;
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
                <MiniBar label="TOTAL STAKED" value={globalStats.val} color="indigo" />
                <MiniBar label="MINT POOL" value={globalStats.mint} color="blue" />
                <MiniBar label="BOND ASSETS" value={globalStats.bond} color="purple" />
                <MiniBar label="600D POOL" value={globalStats.s600} color="indigo" />
                <MiniBar label="TURBINE" value={globalStats.turb} color="emerald" />
                <MiniBar label="SPIDER" value={globalStats.spid} color="amber" />
                <MiniBar label="LGNS" value={globalStats.dlgns} color="pink" />
                <MiniBar label="SLGNS" value={globalStats.dslgns} color="cyan" />
            </div>

            {/* Table Container */}
            <div className="bg-slate-900/80 backdrop-blur-2xl border border-white/5 rounded-[2rem] shadow-3xl overflow-hidden">
                <div className="p-5 border-b border-white/5 flex items-center justify-between">
                    <div className="relative w-[350px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                        <input 
                            type="text" 
                            placeholder="Quick search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-black/40 border border-white/5 text-slate-100 rounded-xl pl-11 pr-4 py-3 w-full outline-none focus:border-indigo-500/20 text-sm"
                        />
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
                            <tr className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] bg-white/[0.01]">
                                <th className="px-8 py-6 w-[18%]">Wallet Identity</th>
                                <th className="px-4 py-6 w-[18%]">Staking Breakdown</th>
                                <th className="px-4 py-6 w-[18%] text-center">总质押合计</th>
                                <th className="px-4 py-6 w-[15%] text-right">Yield Portfolio</th>
                                <th 
                                    className="px-4 py-6 w-[18%] cursor-pointer group/header select-none hover:bg-white/[0.02] transition-colors"
                                    onClick={handleSortToggle}
                                >
                                    <div className="flex items-center gap-2">
                                        Governance Assets
                                        <div className={`p-1 rounded bg-slate-800 transition-all ${sortDirection ? 'text-indigo-400' : 'text-slate-600'}`}>
                                            {sortDirection === 'desc' ? <ArrowDown className="w-3 h-3" /> : sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                                        </div>
                                    </div>
                                </th>
                                <th className="px-8 py-6 w-[13%] text-center">Pulse</th>
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

function MiniBar({ label, value, color }: { label: string, value: number, color: string }) {
    const colorMap: Record<string, string> = {
        indigo: 'border-indigo-500/30 text-indigo-400 bg-indigo-500/5',
        blue: 'border-blue-500/30 text-blue-400 bg-blue-500/5',
        purple: 'border-purple-500/30 text-purple-400 bg-purple-500/5',
        emerald: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5',
        amber: 'border-amber-500/30 text-amber-400 bg-amber-500/5',
        pink: 'border-pink-500/30 text-pink-400 bg-pink-500/5',
        cyan: 'border-cyan-500/30 text-cyan-400 bg-cyan-500/5',
    };

    return (
        <div className={`flex flex-col px-5 py-3 rounded-2xl border ${colorMap[color]} backdrop-blur-sm min-w-[140px]`}>
            <span className="text-[8px] font-black tracking-widest uppercase opacity-60 mb-1">{label}</span>
            <span className="text-lg font-black tracking-tighter">{value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
        </div>
    );
}

function formatNum(val: string, minDec = 2, maxDec = 2) {
    const n = parseFloat(val);
    if (isNaN(n) || n === 0) return '0.00';
    return n.toLocaleString(undefined, { minimumFractionDigits: minDec, maximumFractionDigits: maxDec });
}
