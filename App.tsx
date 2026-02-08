
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
    PieChart
} from 'lucide-react';
import React, { useState, useEffect, useMemo } from 'react';
import { AddressEntry, StakingData } from './types.ts';
import { DEFAULT_RPC } from './constants.ts';
import { BlockchainService } from './services/blockchainService.ts';

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
    const [batchSize, setBatchSize] = useState(2); 
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [editingRemark, setEditingRemark] = useState<{ address: string, value: string } | null>(null);
    const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
    const [rpcStatus, setRpcStatus] = useState<'idle' | 'ok' | 'error'>('idle');

    useEffect(() => {
        const saved = localStorage.getItem('polygon_addresses');
        if (saved) {
            setAddresses(JSON.parse(saved));
        } else {
            setAddresses(INITIAL_ADDRESSES);
            saveAddresses(INITIAL_ADDRESSES);
        }

        const savedStats = localStorage.getItem('polygon_staking_stats');
        if (savedStats) {
            setStakingData(JSON.parse(savedStats));
        }
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

    const filteredAddresses = useMemo(() => {
        return addresses.filter(a => 
            (a.remark || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
            (a.aAddress || "").toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [addresses, searchTerm]);

    const globalStats = useMemo(() => {
        let totals = { val: 0, turb: 0, spid: 0, mint: 0, bond: 0, dlgns: 0, dslgns: 0 };
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
        <div className="max-w-[1700px] mx-auto px-6 py-8 pb-16">
            {/* Header Area */}
            <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 mb-12">
                <div className="flex items-center gap-5">
                    <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-4 rounded-[1.5rem] shadow-2xl shadow-indigo-500/20">
                        <Zap className="text-white w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tighter italic leading-none">
                            Polygon <span className="text-indigo-500">Analytics</span>
                        </h1>
                        <p className="text-slate-500 font-bold text-sm mt-1">Institutional Liquidity Dashboard</p>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                    <div className="bg-slate-800/40 backdrop-blur-xl p-3 rounded-xl border border-white/5 flex items-center gap-3">
                        <Server className={`w-4 h-4 ${rpcStatus === 'error' ? 'text-red-500' : 'text-emerald-500'}`} />
                        <select 
                            value={batchSize}
                            onChange={(e) => setBatchSize(Number(e.target.value))}
                            className="bg-transparent text-indigo-400 text-[10px] font-black outline-none cursor-pointer tracking-widest"
                        >
                            <option value={2}>STABLE</option>
                            <option value={5}>BALANCED</option>
                            <option value={10}>AGGRESSIVE</option>
                        </select>
                    </div>
                    <input 
                        type="text" 
                        value={rpcUrl}
                        onChange={(e) => setRpcUrl(e.target.value)}
                        className="bg-slate-800/40 border border-white/5 text-slate-300 rounded-xl px-5 py-3 text-xs w-full xl:w-[320px] outline-none font-mono focus:border-indigo-500/30 transition-all shadow-inner"
                        placeholder="RPC Endpoint"
                    />
                    <button 
                        onClick={handleRefresh}
                        disabled={loading || addresses.length === 0}
                        className={`flex items-center gap-2 px-8 py-3 rounded-xl font-black text-xs transition-all ${
                            loading ? 'bg-slate-700 text-slate-400' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-500/20'
                        }`}
                    >
                        <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        {loading ? 'SYNCING...' : 'SYNC DATA'}
                    </button>
                </div>
            </header>

            {/* Quick Summary Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-12">
                <MiniCard icon={<Activity />} label="Total" value={globalStats.val} color="indigo" />
                <MiniCard icon={<TrendingUp />} label="Mint" value={globalStats.mint} color="blue" />
                <MiniCard icon={<ArrowUpRight />} label="Bonds" value={globalStats.bond} color="purple" />
                <MiniCard icon={<Wallet />} label="Turbine" value={globalStats.turb} color="emerald" />
                <MiniCard icon={<Info />} label="Spider" value={globalStats.spid} color="amber" />
                <MiniCard icon={<Coins />} label="LGNS" value={globalStats.dlgns} color="pink" />
                <MiniCard icon={<Layers />} label="slgns" value={globalStats.dslgns} color="cyan" />
            </div>

            {/* Main Data Container */}
            <div className="bg-slate-900/50 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] shadow-2xl overflow-hidden">
                {/* Search & Actions */}
                <div className="p-6 border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="relative w-full md:w-[450px]">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" />
                        <input 
                            type="text" 
                            placeholder="Find specific wallet..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-slate-950/50 border border-white/5 text-slate-100 rounded-2xl pl-12 pr-5 py-4 w-full outline-none focus:border-indigo-500/20 text-md font-medium placeholder:text-slate-700"
                        />
                    </div>
                    <div className="flex gap-3">
                        <label className="flex items-center gap-2 px-6 py-3 bg-slate-800/40 hover:bg-slate-800 rounded-xl cursor-pointer font-black text-[10px] border border-white/5 transition-colors tracking-widest">
                            <Upload className="w-4 h-4" /> IMPORT <input type="file" className="hidden" onChange={handleImport} />
                        </label>
                        <button onClick={handleExport} className="flex items-center gap-2 px-6 py-3 bg-slate-800/40 hover:bg-slate-800 rounded-xl font-black text-[10px] border border-white/5 transition-colors tracking-widest">
                            <FileJson className="w-4 h-4" /> EXPORT
                        </button>
                    </div>
                </div>

                {/* The Grid */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1200px]">
                        <thead>
                            <tr className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] border-b border-white/5">
                                <th className="px-8 py-8 w-[28%]">Wallet Identity</th>
                                <th className="px-4 py-8 text-right w-[15%]">Staking Breakdown</th>
                                <th className="px-4 py-8 text-center w-[18%]">总质押合计</th>
                                <th className="px-4 py-8 text-right w-[14%]">Yield Portfolio</th>
                                <th className="px-4 py-8 w-[15%]">Governance Assets</th>
                                <th className="px-8 py-8 text-center w-[10%]">Pulse</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.03]">
                            {filteredAddresses.map((addr) => {
                                const data = stakingData[addr.aAddress];
                                return (
                                    <tr key={addr.aAddress} className="group hover:bg-white/[0.01] transition-all border-b border-white/[0.02]">
                                        {/* Wallet Identity - Compacted */}
                                        <td className="px-8 py-10">
                                            <div className="flex flex-col gap-3">
                                                <div className="flex items-center gap-3">
                                                    {editingRemark?.address === addr.aAddress ? (
                                                        <input autoFocus className="bg-slate-950 border border-indigo-500/50 rounded-xl px-4 py-2 text-white outline-none w-48 text-lg" value={editingRemark.value} onChange={(e) => setEditingRemark({ ...editingRemark, value: e.target.value })} onBlur={() => handleUpdateRemark(addr.aAddress, editingRemark.value)} />
                                                    ) : (
                                                        <div className="flex items-center gap-3">
                                                            <span className="font-black text-2xl text-slate-100 group-hover:text-indigo-400 transition-colors tracking-tighter">{addr.remark || 'N/A'}</span>
                                                            <button onClick={() => setEditingRemark({ address: addr.aAddress, value: addr.remark })} className="opacity-0 group-hover:opacity-100 p-1.5 bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-all"><Edit2 className="w-3 h-3" /></button>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 bg-slate-950/60 rounded-xl px-4 py-2 w-fit border border-white/5 shadow-inner">
                                                    <span className="text-[10px] font-mono text-slate-500 font-bold tracking-tight">{addr.aAddress.slice(0, 10)}...{addr.aAddress.slice(-8)}</span>
                                                    <button onClick={() => copyToClipboard(addr.aAddress)} className="text-slate-700 hover:text-indigo-400">
                                                        {copiedAddress === addr.aAddress ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                                    </button>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Staking Breakdown - Closer to Name */}
                                        <td className="px-4 py-10">
                                            <div className="flex flex-col items-end gap-3">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-black text-white text-lg">{formatNum(data?.mintStaking || '0')}</span>
                                                    <div className="text-[8px] text-blue-400 font-black bg-blue-500/10 px-2 py-1 rounded-md border border-blue-500/20 tracking-widest">MINT</div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="font-black text-white text-lg">{formatNum(data?.bondStaking || '0')}</span>
                                                    <div className="text-[8px] text-purple-400 font-black bg-purple-500/10 px-2 py-1 rounded-md border border-purple-500/20 tracking-widest">BOND</div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* 总质押合计 */}
                                        <td className="px-4 py-10">
                                            <div className="flex flex-col items-center">
                                                <div className="bg-slate-950 rounded-[2rem] px-10 py-5 border border-white/10 shadow-2xl group-hover:border-indigo-500/40 transition-all min-w-[180px] text-center bg-gradient-to-b from-slate-950 to-black">
                                                    <span className="text-3xl font-black text-white tracking-tighter">
                                                        {formatNum(data?.totalStaking || '0')}
                                                    </span>
                                                </div>
                                                <span className="text-[8px] text-slate-600 font-black mt-3 tracking-[0.2em] uppercase opacity-50">9 Decimal Multiplier</span>
                                            </div>
                                        </td>

                                        {/* Yield Portfolio */}
                                        <td className="px-4 py-10">
                                            <div className="flex flex-col items-end gap-3">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-black text-emerald-400 text-base">{formatNum(data?.turbineBalance || '0')}</span>
                                                    <span className="text-[8px] font-black bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-md border border-emerald-500/10 tracking-widest">TURB</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="font-black text-amber-500 text-base">{formatNum(data?.spiderWebReward || '0')}</span>
                                                    <span className="text-[8px] font-black bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-md border border-amber-500/10 tracking-widest">SPID</span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Governance Assets */}
                                        <td className="px-4 py-10">
                                            <div className="flex flex-col gap-2.5 w-[160px]">
                                                <div className="flex justify-between items-center px-4 py-3 bg-slate-950/80 rounded-xl border border-white/5 group-hover:bg-black transition-colors">
                                                    <span className="text-[9px] text-slate-600 font-black tracking-widest">LGNS</span>
                                                    <span className="text-pink-400 font-black text-sm">{formatNum(data?.derivedLgns || '0')}</span>
                                                </div>
                                                <div className="flex justify-between items-center px-4 py-3 bg-slate-950/80 rounded-xl border border-white/5 group-hover:bg-black transition-colors">
                                                    <span className="text-[9px] text-slate-600 font-black tracking-widest uppercase italic">slgns</span>
                                                    <span className="text-cyan-400 font-black text-sm">{formatNum(data?.derivedSlgns || '0')}</span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Last Pulse */}
                                        <td className="px-8 py-10 text-center">
                                            <div className="inline-block px-4 py-2 bg-slate-950 rounded-xl border border-white/5 text-slate-600 font-black text-[9px] tracking-widest group-hover:text-indigo-400 group-hover:border-indigo-500/20 transition-all">
                                                {addr.log}
                                            </div>
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

function MiniCard({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: number, color: string }) {
    const colorMap: Record<string, string> = {
        indigo: 'text-indigo-500 bg-indigo-500/5 border-indigo-500/20',
        blue: 'text-blue-500 bg-blue-500/5 border-blue-500/20',
        purple: 'text-purple-500 bg-purple-500/5 border-purple-500/20',
        emerald: 'text-emerald-500 bg-emerald-500/5 border-emerald-500/20',
        amber: 'text-amber-500 bg-amber-500/5 border-amber-500/20',
        pink: 'text-pink-500 bg-pink-500/5 border-pink-500/20',
        cyan: 'text-cyan-500 bg-cyan-500/5 border-cyan-500/20',
    };

    return (
        <div className={`p-5 rounded-2xl border ${colorMap[color]} bg-slate-900/40 backdrop-blur-md shadow-sm`}>
            <div className="flex items-center gap-2.5 mb-2.5">
                {React.cloneElement(icon as React.ReactElement, { size: 14 })}
                <span className="text-[8px] font-black uppercase tracking-[0.2em] opacity-50">{label}</span>
            </div>
            <div className="text-lg font-black text-white truncate tracking-tighter">
                {value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
        </div>
    );
}

function formatNum(val: string) {
    const n = parseFloat(val);
    if (isNaN(n) || n === 0) return '0.00';
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}
