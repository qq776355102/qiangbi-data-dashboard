
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
    FileJson,
    PieChart,
    ChevronDown,
    Zap,
    AlertCircle,
    Server
} from 'lucide-react';
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
    const [batchSize, setBatchSize] = useState(5); // 默认调小以适应公共节点
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
        setRpcStatus('idle');
        try {
            const service = new BlockchainService(rpcUrl);
            const results = await service.batchQuery(addresses, batchSize);
            const newStakingData = Object.fromEntries(results);
            setStakingData(prev => ({ ...prev, ...newStakingData }));
            localStorage.setItem('polygon_staking_stats', JSON.stringify({ ...stakingData, ...newStakingData }));
            setRpcStatus('ok');
        } catch (error: any) {
            console.error("Refresh error:", error);
            setRpcStatus('error');
            // 如果是已知的异常，不再 Alert 阻断，而是在 UI 显示状态
            if (!error.message?.includes('missing revert data')) {
                alert(`Network Error: ${error.message}`);
            }
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
        downloadAnchor.setAttribute("download", `polygon_portfolio_export.json`);
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

    const chartData = useMemo(() => {
        const total = globalStats.mint + globalStats.bond + globalStats.turb + globalStats.spid;
        if (total === 0) return [];
        return [
            { label: 'Minting', value: globalStats.mint, color: '#6366f1' },
            { label: 'Bonds', value: globalStats.bond, color: '#a855f7' },
            { label: 'Turbine', value: globalStats.turb, color: '#10b981' },
            { label: 'Spider', value: globalStats.spid, color: '#f59e0b' }
        ];
    }, [globalStats]);

    return (
        <div className="max-w-[1720px] mx-auto px-6 py-8 pb-20">
            {/* Header Area */}
            <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 mb-12">
                <div className="flex items-center gap-5">
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 animate-pulse"></div>
                        <div className="relative bg-gradient-to-br from-indigo-500 to-indigo-700 p-4 rounded-3xl shadow-2xl">
                            <Zap className="text-white w-10 h-10" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-5xl font-black text-white tracking-tighter flex items-center gap-3">
                            Polygon <span className="text-indigo-500">Viz</span>
                        </h1>
                        <p className="text-slate-400 font-bold text-lg tracking-tight">Enterprise Multi-Wallet Analytics Dashboard</p>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
                    <div className="flex items-center gap-3 bg-slate-800/60 backdrop-blur-xl p-3 rounded-2xl border border-white/5 shadow-xl">
                        <Server className={`w-5 h-5 ${rpcStatus === 'error' ? 'text-red-500' : rpcStatus === 'ok' ? 'text-emerald-500' : 'text-slate-500'}`} />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Node Config:</span>
                        <select 
                            value={batchSize}
                            onChange={(e) => setBatchSize(Number(e.target.value))}
                            className="bg-slate-900/50 text-indigo-400 text-sm font-black px-4 py-1.5 rounded-xl border border-white/5 outline-none hover:bg-slate-900 transition-colors"
                        >
                            <option value={2}>STABLE (2)</option>
                            <option value={5}>NORMAL (5)</option>
                            <option value={10}>FAST (10)</option>
                        </select>
                    </div>
                    <div className="relative flex-1 xl:flex-none group">
                        <input 
                            type="text" 
                            value={rpcUrl}
                            onChange={(e) => setRpcUrl(e.target.value)}
                            className={`bg-slate-800/60 border border-white/5 text-slate-200 rounded-2xl px-5 py-4 text-sm w-full xl:w-[420px] outline-none shadow-2xl focus:border-indigo-500/50 transition-all font-mono ${rpcStatus === 'error' ? 'ring-2 ring-red-500/50 border-red-500/50' : ''}`}
                            placeholder="RPC Endpoint URL"
                        />
                        {rpcStatus === 'error' && (
                            <div className="absolute top-full left-0 mt-2 text-[10px] text-red-400 font-bold bg-red-500/10 px-3 py-1 rounded-lg border border-red-500/20 backdrop-blur-md">
                                RPC 报错: 请尝试更换其它公共节点 (如: ankr, alchemy)
                            </div>
                        )}
                    </div>
                    <button 
                        onClick={handleRefresh}
                        disabled={loading || addresses.length === 0}
                        className={`flex items-center justify-center gap-3 px-10 py-4 rounded-2xl font-black text-base transition-all shadow-[0_20px_50px_rgba(79,70,229,0.3)] ${
                            loading ? 'bg-slate-700 text-slate-400' : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:-translate-y-1 active:translate-y-0'
                        }`}
                    >
                        <RefreshCcw className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
                        {loading ? 'SYNCHRONIZING...' : 'FETCH DATA'}
                    </button>
                </div>
            </header>

            {/* Global Stats Matrix */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
                <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <SummaryTile icon={<Activity />} label="Aggregated Staking" value={globalStats.val} subValue="9 decimals" color="indigo" />
                    <SummaryTile icon={<TrendingUp />} label="Mint Pool" value={globalStats.mint} subValue="Principal" color="blue" />
                    <SummaryTile icon={<ArrowUpRight />} label="Active Bonds" value={globalStats.bond} subValue="Payouts" color="purple" />
                    <SummaryTile icon={<Wallet />} label="Turbine Liquid" value={globalStats.turb} subValue="Claimable" color="emerald" />
                    <SummaryTile icon={<Info />} label="Spider Web" value={globalStats.spid} subValue="Rewards" color="amber" />
                    <SummaryTile icon={<Coins />} label="LGNS Holding" value={globalStats.dlgns} subValue="Governance" color="pink" />
                    <SummaryTile icon={<Layers />} label="slgns Assets" value={globalStats.dslgns} subValue="Liquid Staking" color="cyan" />
                    <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/20 rounded-3xl p-6 flex flex-col justify-center items-center text-center">
                        <span className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-1">Total Assets</span>
                        <div className="text-3xl font-black text-white">{(globalStats.val + globalStats.dlgns + globalStats.dslgns).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                        <span className="text-[10px] text-slate-500 font-bold mt-2">REAL-TIME AGGREGATE</span>
                    </div>
                </div>

                {/* Donut Chart Visualization */}
                <div className="lg:col-span-4 bg-slate-800/40 border border-white/5 rounded-[2.5rem] p-8 flex flex-col items-center justify-center relative overflow-hidden group">
                    <div className="absolute top-6 left-8 flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-indigo-500" />
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Asset Allocation</span>
                    </div>
                    
                    {chartData.length > 0 ? (
                        <div className="flex flex-col items-center gap-8 w-full">
                            <div className="relative w-48 h-48">
                                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                                    {(() => {
                                        let cumulativePercent = 0;
                                        const total = chartData.reduce((acc, d) => acc + d.value, 0);
                                        return chartData.map((slice, i) => {
                                            const percent = (slice.value / total) * 100;
                                            const startX = Math.cos(2 * Math.PI * cumulativePercent / 100);
                                            const startY = Math.sin(2 * Math.PI * cumulativePercent / 100);
                                            cumulativePercent += percent;
                                            const endX = Math.cos(2 * Math.PI * cumulativePercent / 100);
                                            const endY = Math.sin(2 * Math.PI * cumulativePercent / 100);
                                            const largeArcFlag = percent > 50 ? 1 : 0;
                                            const pathData = `M 50 50 L ${50 + 40 * startX} ${50 + 40 * startY} A 40 40 0 ${largeArcFlag} 1 ${50 + 40 * endX} ${50 + 40 * endY} Z`;
                                            return <path key={i} d={pathData} fill={slice.color} className="opacity-80 hover:opacity-100 transition-opacity cursor-pointer" />;
                                        });
                                    })()}
                                    <circle cx="50" cy="50" r="28" fill="#1e293b" />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                    <span className="text-[10px] font-black text-slate-500 uppercase">Yield</span>
                                    <span className="text-2xl font-black text-white">{( (globalStats.turb + globalStats.spid) / (globalStats.val || 1) * 100).toFixed(1)}%</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 w-full px-4">
                                {chartData.map((slice, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: slice.color }}></div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter leading-none">{slice.label}</span>
                                            <span className="text-xs font-black text-white">{((slice.value / (chartData.reduce((a,b)=>a+b.value,0)) || 1) * 100).toFixed(1)}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-20">
                            <Database className="w-12 h-12 text-slate-700 mx-auto mb-4 opacity-30" />
                            <p className="text-slate-600 font-bold">No data to visualize</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Filter Area */}
            <div className="bg-slate-800/40 backdrop-blur-xl border border-white/5 p-6 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center gap-6 mb-10 shadow-2xl">
                <div className="relative w-full md:w-[680px]">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-500" />
                    <input 
                        type="text" 
                        placeholder="Search wallets by alias or address string..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-slate-900/50 border border-white/5 text-slate-100 rounded-[1.5rem] pl-14 pr-6 py-5 w-full outline-none shadow-inner text-xl focus:border-indigo-500/30 transition-all font-medium placeholder:text-slate-600"
                    />
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <label className="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-5 bg-slate-700/50 hover:bg-slate-700 text-slate-100 rounded-[1.5rem] cursor-pointer font-black border border-white/5 transition-colors">
                        <Upload className="w-6 h-6" />
                        IMPORT
                        <input type="file" className="hidden" accept=".json" onChange={handleImport} />
                    </label>
                    <button onClick={handleExport} className="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-5 bg-slate-700/50 hover:bg-slate-700 text-slate-100 rounded-[1.5rem] font-black border border-white/5 transition-colors">
                        <FileJson className="w-6 h-6" />
                        EXPORT
                    </button>
                </div>
            </div>

            {/* Data Grid */}
            <div className="bg-slate-800/30 backdrop-blur-2xl border border-white/5 rounded-[3rem] overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.3)]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1400px]">
                        <thead>
                            <tr className="bg-slate-900/60 border-b border-white/5 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                <th className="px-10 py-8">Wallet Identity</th>
                                <th className="px-6 py-8 text-right">Staking Breakdown</th>
                                <th className="px-6 py-8 text-right">Net Liquidity</th>
                                <th className="px-6 py-8 text-right">Yield Portfolio</th>
                                <th className="px-6 py-8">Governance Assets</th>
                                <th className="px-10 py-8 text-center">Last Pulse</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.03]">
                            {filteredAddresses.map((addr) => {
                                const data = stakingData[addr.aAddress];
                                const isStale = data && (Date.now() - (data.lastUpdated || 0) > 3600000); // 1小时以上未更新

                                return (
                                    <tr key={addr.aAddress} className="group hover:bg-white/[0.02] transition-all">
                                        <td className="px-10 py-10">
                                            <div className="flex flex-col gap-4">
                                                <div className="flex items-center gap-4">
                                                    {editingRemark?.address === addr.aAddress ? (
                                                        <div className="flex items-center gap-3">
                                                            <input 
                                                                autoFocus
                                                                className="bg-slate-950 border-2 border-indigo-500/50 rounded-2xl px-5 py-2.5 text-base text-white outline-none w-72 shadow-[0_0_30px_rgba(79,70,229,0.2)]"
                                                                value={editingRemark.value}
                                                                onChange={(e) => setEditingRemark({ ...editingRemark, value: e.target.value })}
                                                                onBlur={() => handleUpdateRemark(addr.aAddress, editingRemark.value)}
                                                                onKeyDown={(e) => e.key === 'Enter' && handleUpdateRemark(addr.aAddress, editingRemark.value)}
                                                            />
                                                            <button onClick={() => handleUpdateRemark(addr.aAddress, editingRemark.value)} className="bg-indigo-500 p-2.5 rounded-xl hover:bg-indigo-400 transition-colors shadow-lg shadow-indigo-500/20"><Save className="w-5 h-5" /></button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-4">
                                                            <span className="font-black text-2xl text-slate-100 tracking-tight group-hover:text-indigo-400 transition-colors">{addr.remark || 'Unknown'}</span>
                                                            <button onClick={() => setEditingRemark({ address: addr.aAddress, value: addr.remark })} className="opacity-0 group-hover:opacity-100 transition-all p-2 bg-slate-800 rounded-xl text-slate-500 hover:text-white border border-white/5 shadow-lg">
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                            {isStale && <AlertCircle className="w-5 h-5 text-amber-500 animate-pulse" title="数据较旧，请刷新" />}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 bg-slate-950/40 rounded-[1.25rem] px-5 py-3.5 w-fit border border-white/5 shadow-inner">
                                                    <span className="text-xs font-mono text-slate-500 font-black tracking-wider">{addr.aAddress.slice(0, 10)}...{addr.aAddress.slice(-8)}</span>
                                                    <button onClick={() => copyToClipboard(addr.aAddress)} className="text-slate-700 hover:text-indigo-400 transition-colors p-1">
                                                        {copiedAddress === addr.aAddress ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-10 text-right">
                                            <div className="flex flex-col gap-3">
                                                <div className="flex items-center justify-end gap-2 group/val">
                                                    <div className="text-[10px] text-blue-400 font-black bg-blue-500/10 px-3 py-1.5 rounded-xl border border-blue-500/20 shadow-sm">MINT</div>
                                                    <span className="font-black text-white text-lg">{formatNum(data?.mintStaking || '0')}</span>
                                                </div>
                                                <div className="flex items-center justify-end gap-2 group/val">
                                                    <div className="text-[10px] text-purple-400 font-black bg-purple-500/10 px-3 py-1.5 rounded-xl border border-purple-500/20 shadow-sm">BOND</div>
                                                    <span className="font-black text-white text-lg">{formatNum(data?.bondStaking || '0')}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-10 text-right">
                                            <div className="inline-flex flex-col items-end">
                                                <div className="px-7 py-4 bg-slate-950 rounded-3xl font-black text-white text-xl shadow-2xl border border-white/5 group-hover:border-indigo-500/30 transition-all min-w-[160px]">
                                                    {formatNum(data?.totalStaking || '0')}
                                                </div>
                                                <span className="text-[10px] text-slate-600 font-black mt-2 tracking-widest uppercase">9 Decimal Multiplier</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-10 text-right">
                                            <div className="flex flex-col items-end gap-3">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm font-black text-emerald-400">{formatNum(data?.turbineBalance || '0')}</span>
                                                    <span className="text-[9px] font-black bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-lg border border-emerald-500/20">TURB</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm font-black text-amber-500">{formatNum(data?.spiderWebReward || '0')}</span>
                                                    <span className="text-[9px] font-black bg-amber-500/10 text-amber-500 px-2 py-1 rounded-lg border border-amber-500/20">SPID</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-10">
                                            <div className="flex flex-col gap-3 w-[180px]">
                                                <div className="flex justify-between items-center px-4 py-3 bg-slate-950/80 rounded-2xl border border-white/5 group-hover:bg-slate-950 transition-colors">
                                                    <span className="text-[10px] text-slate-500 font-black tracking-widest">LGNS</span>
                                                    <span className="text-pink-400 font-black text-sm">{formatNum(data?.derivedLgns || '0')}</span>
                                                </div>
                                                <div className="flex justify-between items-center px-4 py-3 bg-slate-950/80 rounded-2xl border border-white/5 group-hover:bg-slate-950 transition-colors">
                                                    <span className="text-[10px] text-slate-500 font-black tracking-widest uppercase">slgns</span>
                                                    <span className="text-cyan-400 font-black text-sm">{formatNum(data?.derivedSlgns || '0')}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-10 text-center">
                                            <div className="flex flex-col gap-2 items-center">
                                                <span className="text-[10px] font-black bg-slate-950/80 border border-white/5 px-5 py-2.5 rounded-2xl text-slate-500 shadow-inner group-hover:text-indigo-400 group-hover:border-indigo-500/20 transition-all">
                                                    {addr.log}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {filteredAddresses.length === 0 && (
                    <div className="p-40 text-center bg-slate-950/20">
                        <ListFilter className="w-32 h-32 text-slate-800 mx-auto mb-10 opacity-20 animate-bounce" />
                        <p className="text-slate-500 font-black text-3xl italic tracking-tighter">No wallet match found for the current filter.</p>
                        <button onClick={() => setSearchTerm('')} className="mt-10 px-10 py-4 bg-indigo-600/10 text-indigo-400 rounded-[1.5rem] font-black hover:bg-indigo-600/20 transition-all border border-indigo-500/20">Clear Search Filter</button>
                    </div>
                )}
            </div>
        </div>
    );
}

function SummaryTile({ icon, label, value, subValue, color }: { icon: React.ReactNode, label: string, value: number, subValue: string, color: string }) {
    const colorClasses: Record<string, string> = {
        indigo: 'border-indigo-500/20 text-indigo-400 shadow-indigo-500/5 hover:border-indigo-500/50 hover:bg-indigo-500/5',
        blue: 'border-blue-500/20 text-blue-400 shadow-blue-500/5 hover:border-blue-500/50 hover:bg-blue-500/5',
        purple: 'border-purple-500/20 text-purple-400 shadow-purple-500/5 hover:border-purple-500/50 hover:bg-purple-500/5',
        emerald: 'border-emerald-500/20 text-emerald-400 shadow-emerald-500/5 hover:border-emerald-500/50 hover:bg-emerald-500/5',
        amber: 'border-amber-500/20 text-amber-400 shadow-amber-500/5 hover:border-amber-500/50 hover:bg-amber-500/5',
        pink: 'border-pink-500/20 text-pink-400 shadow-pink-500/5 hover:border-pink-500/50 hover:bg-pink-500/5',
        cyan: 'border-cyan-500/20 text-cyan-400 shadow-cyan-500/5 hover:border-cyan-500/50 hover:bg-cyan-500/5',
    };

    return (
        <div className={`bg-slate-800/30 backdrop-blur-md border rounded-[2rem] p-6 transition-all group cursor-default shadow-2xl ${colorClasses[color] || ''}`}>
            <div className="flex items-center gap-4 mb-5">
                <div className="p-3 bg-slate-950 rounded-2xl shadow-inner border border-white/5 transition-transform group-hover:scale-110">
                    {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'w-6 h-6' })}
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 leading-none mb-1">{label}</span>
                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">{subValue}</span>
                </div>
            </div>
            <div className="text-3xl font-black text-white tracking-tighter truncate">
                {value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                <span className="text-[10px] ml-2 text-slate-600 font-bold uppercase tracking-widest">Units</span>
            </div>
        </div>
    );
}

function formatNum(val: string) {
    const n = parseFloat(val);
    if (isNaN(n) || n === 0) return '0.00';
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}
