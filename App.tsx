
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    Search, 
    RefreshCcw, 
    Download, 
    Upload, 
    Edit2, 
    Save, 
    X, 
    Database, 
    Activity, 
    Wallet,
    Info,
    ListFilter,
    ArrowUpRight,
    TrendingUp,
    Coins,
    Layers,
    Copy,
    Check,
    Settings,
    FileJson
} from 'lucide-react';
import { AddressEntry, StakingData } from './types';
import { DEFAULT_RPC } from './constants';
import { BlockchainService } from './services/blockchainService';

const INITIAL_ADDRESSES: AddressEntry[] = [
    {
      aAddress: "0x80cB03984E41CBdaE772D7090f66fa699A3CDF3F",
      log: "5月20号",
      remark: "Demo Account",
      derivedAddress: "0x309ca717d6989676194b88fd06029a88ceefee60",
      split: "5-5开"
    }
];

export default function App() {
    const [addresses, setAddresses] = useState<AddressEntry[]>([]);
    const [stakingData, setStakingData] = useState<Record<string, StakingData>>({});
    const [rpcUrl, setRpcUrl] = useState(DEFAULT_RPC);
    const [batchSize, setBatchSize] = useState(10);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [editingRemark, setEditingRemark] = useState<{ address: string, value: string } | null>(null);
    const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

    useEffect(() => {
        const saved = localStorage.getItem('polygon_addresses');
        if (saved) {
            setAddresses(JSON.parse(saved));
        } else {
            setAddresses(INITIAL_ADDRESSES);
        }

        const savedStats = localStorage.getItem('polygon_staking_stats');
        if (savedStats) {
            setStakingData(JSON.parse(savedStats));
        }
    }, []);

    const saveAddresses = (newAddresses: AddressEntry[]) => {
        const uniqueMap = new Map();
        newAddresses.forEach(item => {
            if (item.aAddress) {
                const key = item.aAddress.toLowerCase().trim();
                if (!uniqueMap.has(key)) {
                    uniqueMap.set(key, item);
                }
            }
        });
        const finalAddresses = Array.from(uniqueMap.values());
        setAddresses(finalAddresses);
        localStorage.setItem('polygon_addresses', JSON.stringify(finalAddresses));
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
        try {
            const service = new BlockchainService(rpcUrl);
            const results = await service.batchQuery(addresses, batchSize);
            const newStakingData = Object.fromEntries(results);
            setStakingData(prev => ({ ...prev, ...newStakingData }));
            localStorage.setItem('polygon_staking_stats', JSON.stringify({ ...stakingData, ...newStakingData }));
        } catch (error: any) {
            console.error("Refresh error:", error);
            alert(`Refresh failed: ${error.message || "Unknown error"}. Try reducing batch size or checking RPC URL.`);
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
                let importedItems: AddressEntry[] = [];
                if (Array.isArray(json)) {
                    importedItems = json;
                } else if (json.items && Array.isArray(json.items)) {
                    importedItems = json.items;
                }
                
                if (importedItems.length > 0) {
                    saveAddresses(importedItems);
                    alert(`Successfully imported and deduplicated ${importedItems.length} addresses!`);
                }
            } catch (err) {
                alert("Invalid JSON data.");
            }
        };
        reader.readAsText(file);
    };

    const handleExport = () => {
        const exportData = {
            generatedAt: new Date().toISOString(),
            total: addresses.length,
            items: addresses
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `polygon_portfolio_${new Date().getTime()}.json`);
        downloadAnchor.click();
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedAddress(text);
        setTimeout(() => setCopiedAddress(null), 2000);
    };

    const filteredAddresses = useMemo(() => {
        return addresses.filter(a => 
            (a.remark || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
            (a.aAddress || "").toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [addresses, searchTerm]);

    const globalStats = useMemo(() => {
        let totals = { val: 0, turb: 0, spid: 0, mint: 0, bond: 0, dlgns: 0, dslgns: 0 };
        // CRITICAL CHANGE: Use filteredAddresses instead of addresses to reflect search results
        filteredAddresses.forEach(addr => {
            const data = stakingData[addr.aAddress];
            if (data) {
                totals.val += parseFloat(data.totalStaking) || 0;
                totals.turb += parseFloat(data.turbineBalance) || 0;
                totals.spid += parseFloat(data.spiderWebReward) || 0;
                totals.mint += parseFloat(data.mintStaking) || 0;
                totals.bond += parseFloat(data.bondStaking) || 0;
                totals.dlgns += parseFloat(data.derivedLgns) || 0;
                totals.dslgns += parseFloat(data.derivedSlgns) || 0;
            }
        });
        return totals;
    }, [stakingData, filteredAddresses]);

    return (
        <div className="max-w-[1680px] mx-auto px-6 py-8">
            <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-10">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-600 p-3 rounded-2xl shadow-xl shadow-indigo-600/20">
                        <Database className="text-white w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tight">Polygon Portfolio Dashboard</h1>
                        <p className="text-slate-500 font-medium">Multi-module asset tracking with Multicall V3 optimization</p>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
                    <div className="flex items-center gap-3 bg-slate-800/80 backdrop-blur-sm p-2.5 rounded-xl border border-slate-700 shadow-inner">
                        <Settings className="w-4 h-4 text-slate-500" />
                        <span className="text-xs font-black text-slate-400 uppercase">Batch Size:</span>
                        <select 
                            value={batchSize}
                            onChange={(e) => setBatchSize(Number(e.target.value))}
                            className="bg-slate-900 text-indigo-400 text-xs font-black px-3 py-1 rounded-lg border border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/50"
                        >
                            <option value={5}>5 Address</option>
                            <option value={10}>10 Address</option>
                            <option value={20}>20 Address</option>
                        </select>
                    </div>
                    <div className="relative flex-1 xl:flex-none">
                        <input 
                            type="text" 
                            value={rpcUrl}
                            onChange={(e) => setRpcUrl(e.target.value)}
                            className="bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-4 py-3 text-sm w-full xl:w-96 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                            placeholder="Polygon RPC Endpoint"
                        />
                    </div>
                    <button 
                        onClick={handleRefresh}
                        disabled={loading || addresses.length === 0}
                        className={`flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-black text-sm transition-all shadow-2xl ${
                            loading ? 'bg-slate-700 cursor-not-allowed text-slate-400' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/40 hover:-translate-y-0.5'
                        }`}
                    >
                        <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        {loading ? 'Refreshing...' : 'Sync All Data'}
                    </button>
                </div>
            </header>

            {/* Global Stats Summary (Now reflects filtered results) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-10">
                <StatCard icon={<Activity className="text-indigo-400" />} label="Total Staking" value={globalStats.val} color="indigo" />
                <StatCard icon={<TrendingUp className="text-blue-400" />} label="Mint Staking" value={globalStats.mint} color="blue" />
                <StatCard icon={<ArrowUpRight className="text-purple-400" />} label="Bond Staking" value={globalStats.bond} color="purple" />
                <StatCard icon={<Wallet className="text-emerald-400" />} label="Turbine" value={globalStats.turb} color="emerald" />
                <StatCard icon={<Info className="text-amber-400" />} label="Spider Web" value={globalStats.spid} color="amber" />
                <StatCard icon={<Coins className="text-pink-400" />} label="Derived LGNS" value={globalStats.dlgns} color="pink" />
                <StatCard icon={<Layers className="text-cyan-400" />} label="Derived slgns" value={globalStats.dslgns} color="cyan" />
            </div>

            {/* Filter & Actions */}
            <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-3xl flex flex-col md:flex-row justify-between items-center gap-6 mb-8 shadow-2xl">
                <div className="relative w-full md:w-[600px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input 
                        type="text" 
                        placeholder="Search by remark or address..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-slate-900 border border-slate-700 text-slate-100 rounded-2xl pl-12 pr-4 py-4 w-full focus:ring-2 focus:ring-indigo-500 outline-none shadow-inner text-lg font-medium"
                    />
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <label className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-2xl cursor-pointer font-bold transition-all shadow-lg border border-slate-600/50">
                        <Upload className="w-5 h-5" />
                        Import
                        <input type="file" className="hidden" accept=".json" onChange={handleImport} />
                    </label>
                    <button 
                        onClick={handleExport}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-2xl font-bold transition-all shadow-lg border border-slate-600/50"
                    >
                        <FileJson className="w-5 h-5" />
                        Export
                    </button>
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-[2rem] overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1350px]">
                        <thead>
                            <tr className="bg-slate-900/80 border-b border-slate-700 text-[11px] font-black text-slate-500 uppercase tracking-widest">
                                <th className="px-8 py-6">User Identity</th>
                                <th className="px-6 py-6 text-right">Mint / Bond</th>
                                <th className="px-6 py-6 text-right">Total Staking</th>
                                <th className="px-6 py-6 text-right">Module Balances</th>
                                <th className="px-6 py-6">Derived Assets</th>
                                <th className="px-8 py-6 text-center">Metadata</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/20">
                            {filteredAddresses.map((addr) => {
                                const data = stakingData[addr.aAddress] || {
                                    totalStaking: '0.0',
                                    mintStaking: '0.0',
                                    bondStaking: '0.0',
                                    spiderWebReward: '0.0',
                                    turbineBalance: '0.0',
                                    derivedLgns: '0.0',
                                    derivedSlgns: '0.0'
                                };

                                return (
                                    <tr key={addr.aAddress} className="group hover:bg-slate-700/30 transition-all border-b border-slate-700/20 last:border-0">
                                        <td className="px-8 py-8 min-w-[420px]">
                                            <div className="flex flex-col gap-3">
                                                <div className="flex items-center gap-3">
                                                    {editingRemark?.address === addr.aAddress ? (
                                                        <div className="flex items-center gap-2">
                                                            <input 
                                                                autoFocus
                                                                className="bg-slate-900 border-2 border-indigo-500 rounded-xl px-4 py-2 text-sm text-slate-100 outline-none w-64 shadow-xl"
                                                                value={editingRemark.value}
                                                                onChange={(e) => setEditingRemark({ ...editingRemark, value: e.target.value })}
                                                                onBlur={() => handleUpdateRemark(addr.aAddress, editingRemark.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') handleUpdateRemark(addr.aAddress, editingRemark.value);
                                                                    if (e.key === 'Escape') setEditingRemark(null);
                                                                }}
                                                            />
                                                            <button onClick={() => handleUpdateRemark(addr.aAddress, editingRemark.value)} className="bg-emerald-500 p-2 rounded-lg text-white shadow-lg"><Save className="w-4 h-4" /></button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-3">
                                                            <span className="font-black text-lg text-slate-200 tracking-tight">{addr.remark || 'No Remark'}</span>
                                                            <button onClick={() => setEditingRemark({ address: addr.aAddress, value: addr.remark })} className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-slate-700 rounded-lg text-slate-400 hover:text-indigo-400">
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 bg-slate-900/60 rounded-xl px-4 py-3 w-fit border border-slate-700/50 shadow-inner">
                                                    <span className="text-xs font-mono text-slate-400 select-all font-bold tracking-tight break-all">{addr.aAddress}</span>
                                                    <button 
                                                        onClick={() => copyToClipboard(addr.aAddress)} 
                                                        className="text-slate-600 hover:text-indigo-400 transition-all active:scale-90"
                                                        title="Copy Address"
                                                    >
                                                        {copiedAddress === addr.aAddress ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                                <div className="text-[10px] text-slate-600 font-bold bg-slate-900/20 p-2 rounded-lg border border-slate-700/30">
                                                    <span className="uppercase text-[9px] text-slate-700 mr-2">Derived:</span>
                                                    <span className="font-mono text-slate-500">{addr.derivedAddress}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-8 text-right">
                                            <div className="flex flex-col gap-2">
                                                <div className="text-[11px] text-blue-400 font-black bg-blue-400/10 px-3 py-1.5 rounded-xl border border-blue-400/20 inline-block ml-auto shadow-sm">MINT: {formatNum(data.mintStaking)}</div>
                                                <div className="text-[11px] text-purple-400 font-black bg-purple-400/10 px-3 py-1.5 rounded-xl border border-purple-400/20 inline-block ml-auto shadow-sm">BOND: {formatNum(data.bondStaking)}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-8 text-right">
                                            <div className="inline-block px-5 py-3 bg-slate-900 rounded-2xl font-black text-white text-base shadow-xl border border-slate-700/50 min-w-[130px]">
                                                {formatNum(data.totalStaking)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-8 text-right">
                                            <div className="flex flex-col items-end gap-2">
                                                <span className="text-sm font-black text-emerald-400 tracking-tight">TURB: {formatNum(data.turbineBalance)}</span>
                                                <span className="text-sm font-black text-amber-400 tracking-tight">SPID: {formatNum(data.spiderWebReward)}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-8">
                                            <div className="flex flex-col gap-2 w-[160px]">
                                                <div className="flex justify-between items-center px-3 py-2 bg-slate-900/90 rounded-xl border border-slate-700/50 shadow-sm">
                                                    <span className="text-[10px] text-slate-500 font-black uppercase">LGNS</span>
                                                    <span className="text-pink-400 font-black text-xs">{formatNum(data.derivedLgns)}</span>
                                                </div>
                                                <div className="flex justify-between items-center px-3 py-2 bg-slate-900/90 rounded-xl border border-slate-700/50 shadow-sm">
                                                    <span className="text-[10px] text-slate-500 font-black uppercase">slgns</span>
                                                    <span className="text-cyan-400 font-black text-xs">{formatNum(data.derivedSlgns)}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-8 text-center">
                                            <div className="flex flex-col gap-2 items-center">
                                                <span className="text-[11px] font-black bg-slate-900 border border-slate-700 px-4 py-2 rounded-xl text-slate-500 shadow-sm min-w-[100px]">
                                                    {addr.log}
                                                </span>
                                                {addr.split && (
                                                    <span className="text-[11px] font-black text-indigo-400 bg-indigo-500/10 px-4 py-1.5 rounded-xl border border-indigo-500/30 uppercase tracking-tighter shadow-sm">
                                                        {addr.split}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {filteredAddresses.length === 0 && (
                    <div className="p-32 text-center bg-slate-900/20">
                        <ListFilter className="w-24 h-24 text-slate-800 mx-auto mb-8 opacity-50" />
                        <p className="text-slate-500 font-black text-2xl italic tracking-tight">No accounts match the filters.</p>
                        <button onClick={() => setSearchTerm('')} className="mt-6 px-8 py-3 bg-slate-800 text-indigo-400 hover:bg-slate-700 rounded-2xl font-black transition-all">Reset Filters</button>
                    </div>
                )}
            </div>
            
            <footer className="mt-16 text-center">
                <div className="inline-flex flex-col items-center gap-3 px-10 py-8 bg-slate-800/30 rounded-[2.5rem] border border-slate-700/50 backdrop-blur-sm shadow-xl">
                    <p className="flex items-center gap-2 text-slate-500 font-bold">
                        Database Capacity: <span className="text-indigo-400 font-black">{addresses.length} Verified Accounts</span>
                    </p>
                    <p className="text-slate-700 text-[10px] font-black uppercase tracking-[0.2em] mt-2 italic">Polygon Project Insights • Optimized Multicall Protocol</p>
                </div>
            </footer>
        </div>
    );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: number, color: string }) {
    return (
        <div className={`bg-slate-800/40 border-2 border-slate-700/40 p-5 rounded-3xl hover:border-${color}-500/50 transition-all hover:shadow-2xl group relative overflow-hidden`}>
            <div className={`absolute top-0 right-0 w-24 h-24 bg-${color}-500/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150`}></div>
            <div className="flex items-center gap-3 mb-4 relative z-10">
                <div className={`p-2.5 bg-slate-900 rounded-2xl group-hover:scale-110 transition-transform shadow-inner border border-slate-700/50`}>{icon}</div>
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 truncate">{label}</span>
            </div>
            <div className="text-2xl font-black text-white truncate px-1 relative z-10">
                {value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                <span className="text-[9px] ml-2 text-slate-700 font-black uppercase">Units</span>
            </div>
        </div>
    );
}

function formatNum(val: string) {
    const n = parseFloat(val);
    if (isNaN(n) || n === 0) return '0.00';
    if (n < 0.0001) return n.toFixed(8);
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}
