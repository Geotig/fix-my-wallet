import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api';
import Card from './ui/Card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useLocalization } from '../contexts/LocalizationContext';

const ReportsView = () => {
  const { formatCurrency } = useLocalization();
  const [activeTab, setActiveTab] = useState('net_worth');
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Colores para el gráfico de torta
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

  useEffect(() => {
    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await apiFetch(`/api/reports/?type=${activeTab}`);
            const data = await res.json();
            setChartData(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };
    fetchData();
  }, [activeTab]);

  return (
    <div className="space-y-6">
      {/* Header y Tabs */}
      <Card className="p-4 flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Reportes Financieros</h2>
        <div className="flex bg-gray-100 rounded p-1">
            <button 
                onClick={() => setActiveTab('net_worth')}
                className={`px-4 py-1.5 rounded text-sm font-medium transition ${activeTab === 'net_worth' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
                Patrimonio Neto
            </button>
            <button 
                onClick={() => setActiveTab('spending')}
                className={`px-4 py-1.5 rounded text-sm font-medium transition ${activeTab === 'spending' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
                Gastos por Grupo
            </button>
        </div>
      </Card>

      {/* Área de Gráfico */}
      <Card className="p-6 min-h-[400px]">
        {loading ? (
            <div className="flex justify-center items-center h-64 text-gray-400">Cargando datos...</div>
        ) : chartData.length === 0 ? (
            <div className="flex justify-center items-center h-64 text-gray-400">No hay datos suficientes.</div>
        ) : (
            <>
                {activeTab === 'net_worth' && (
                    <div className="h-[350px] w-full">
                        <h3 className="text-center text-gray-500 mb-4 text-sm">Evolución últimos 12 meses</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="month" style={{ fontSize: '12px' }} />
                                <YAxis style={{ fontSize: '12px' }} tickFormatter={(val) => `$${val/1000}k`} />
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <Tooltip formatter={(value) => formatCurrency(value)} />
                                <Area type="monotone" dataKey="Net Worth" stroke="#3b82f6" fillOpacity={1} fill="url(#colorNet)" strokeWidth={3} />
                                <Area type="monotone" dataKey="Assets" stackId="1" stroke="#10b981" fill="none" strokeWidth={2} strokeDasharray="5 5" />
                                <Area type="monotone" dataKey="Debts" stackId="2" stroke="#ef4444" fill="none" strokeWidth={2} strokeDasharray="5 5" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {activeTab === 'spending' && (
                    <div className="flex flex-col md:flex-row items-center justify-center h-[350px]">
                        <div className="h-full w-full md:w-1/2">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => formatCurrency(value)} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="w-full md:w-1/3 space-y-2">
                            <h4 className="font-bold text-gray-700 mb-2">Gastos este Mes</h4>
                            {chartData.map((entry, index) => (
                                <div key={index} className="flex justify-between items-center text-sm border-b border-gray-50 pb-1">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                        <span>{entry.name}</span>
                                    </div>
                                    <span className="font-mono text-gray-600">{formatCurrency(entry.value)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </>
        )}
      </Card>
    </div>
  );
};

export default ReportsView;