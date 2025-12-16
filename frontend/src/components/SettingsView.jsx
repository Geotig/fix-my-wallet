import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api';
import Card from './ui/Card';
import Button from './ui/Button';
import Badge from './ui/Badge';
import Modal from './ui/Modal';
import Input from './ui/Input';
import Select from './ui/Select';
import { useLocalization } from '../contexts/LocalizationContext';

const SettingsView = () => {
  const [activeTab, setActiveTab] = useState('general'); // 'general ' | 'sources' | 'rules'
  
  const [sources, setSources] = useState([]);
  const [rules, setRules] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados para Modales
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);

  // Obtener funciones del contexto
  const { 
    symbol, setSymbol, 
    thousandSep, setThousandSep, 
    decimalSep, setDecimalSep, 
    decimals, setDecimals, 
    formatCurrency 
  } = useLocalization();

  // Formularios
  const [sourceForm, setSourceForm] = useState({
    name: '', email_host: 'imap.gmail.com', email_port: 993, email_user: '', password: ''
  });
  
  const [ruleForm, setRuleForm] = useState({
    source: '', account: '', parser_type: 'BANCO_CHILE', filter_recipient_email: '', search_criteria: 'UNSEEN'
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [srcRes, ruleRes, accRes] = await Promise.all([
        apiFetch('/api/email-sources/', { headers: { 'Cache-Control': 'no-cache' } }),
        apiFetch('/api/email-rules/', { headers: { 'Cache-Control': 'no-cache' } }),
        apiFetch('/api/accounts/', { headers: { 'Cache-Control': 'no-cache' } })
      ]);
      
      const srcData = await srcRes.json();
      const ruleData = await ruleRes.json();
      const accData = await accRes.json();

      setSources(srcData.results || srcData);
      setRules(ruleData.results || ruleData);
      setAccounts(accData.results || accData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- HANDLERS ---

  const handleSaveSource = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/email-sources/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sourceForm)
      });
      if (!res.ok) throw new Error("Error guardando fuente");
      setIsSourceModalOpen(false);
      setSourceForm({ name: '', email_host: 'imap.gmail.com', email_port: 993, email_user: '', password: '' });
      fetchData();
    } catch (err) { alert(err.message); }
  };

  const handleSaveRule = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/email-rules/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ruleForm)
      });
      if (!res.ok) throw new Error("Error guardando regla");
      setIsRuleModalOpen(false);
      setRuleForm({ source: '', account: '', parser_type: 'BANCO_CHILE', filter_recipient_email: '', search_criteria: 'UNSEEN' });
      fetchData();
    } catch (err) { alert(err.message); }
  };

  const handleDelete = async (endpoint, id) => {
    if (!confirm("¿Eliminar? Esto no se puede deshacer.")) return;
    await apiFetch(`${endpoint}${id}/`, { method: 'DELETE' });
    fetchData();
  };

  // --- RENDER ---

  return (
    <div className="space-y-6">
      {/* Header con Pestañas */}
      <div className="bg-white rounded-lg shadow p-2 flex gap-2 overflow-x-auto">
        <button
            onClick={() => setActiveTab('general')}
            className={`flex-1 py-2 px-4 rounded-md font-bold transition-colors whitespace-nowrap ${
                activeTab === 'general' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
        >
            🌍 Regional
        </button>
        <button
            onClick={() => setActiveTab('sources')}
            className={`flex-1 py-2 px-4 rounded-md font-bold transition-colors whitespace-nowrap ${
                activeTab === 'sources' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
        >
            📡 Fuentes
        </button>
        <button
            onClick={() => setActiveTab('rules')}
            className={`flex-1 py-2 px-4 rounded-md font-bold transition-colors whitespace-nowrap ${
                activeTab === 'rules' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
        >
            ⚙️ Reglas
        </button>
      </div>

      {/* --- CONTENIDO: GENERAL (REGIONAL) --- */}
      {activeTab === 'general' && (
        <Card className="p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Configuración Regional</h3>
            
            <div className="grid md:grid-cols-2 gap-6">
                <Input 
                    label="Símbolo de Moneda" 
                    placeholder="$" 
                    value={symbol} 
                    onChange={e => setSymbol(e.target.value)} 
                />

                <Select 
                    label="Cantidad de Decimales" 
                    value={decimals} 
                    onChange={e => setDecimals(parseInt(e.target.value))}
                >
                    <option value="0">0 (Sin decimales)</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                </Select>

                <Select 
                    label="Separador de Miles" 
                    value={thousandSep} 
                    onChange={e => setThousandSep(e.target.value)}
                >
                    <option value=".">Punto (.)</option>
                    <option value=",">Coma (,)</option>
                    <option value="'">Apostrofe (')</option>
                    <option value=" ">Espacio ( )</option>
                </Select>

                <Select 
                    label="Separador de Decimales" 
                    value={decimalSep} 
                    onChange={e => setDecimalSep(e.target.value)}
                >
                    <option value=",">Coma (,)</option>
                    <option value=".">Punto (.)</option>
                </Select>
            </div>

            <div className="mt-8 p-4 bg-gray-50 rounded border border-gray-100">
                <p className="text-sm text-gray-500 uppercase font-bold mb-2">Vista Previa:</p>
                <div className="flex gap-8 items-center">
                    <div>
                        <span className="text-xs text-gray-400">Positivo</span>
                        <div className="text-xl font-bold text-green-600">{formatCurrency(12500.50)}</div>
                    </div>
                    <div>
                        <span className="text-xs text-gray-400">Negativo</span>
                        <div className="text-xl font-bold text-red-600">{formatCurrency(-5430)}</div>
                    </div>
                </div>
            </div>
        </Card>
      )}

      {/* CONTENIDO: FUENTES */}
      {activeTab === 'sources' && (
        <>
            <div className="flex justify-end">
                <Button onClick={() => setIsSourceModalOpen(true)}>+ Nueva Fuente</Button>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
                {sources.map(src => (
                    <Card key={src.id} className="p-4 flex flex-col justify-between">
                        <div>
                            <h3 className="font-bold text-lg">{src.name}</h3>
                            <p className="text-sm text-gray-600">{src.email_user}</p>
                            <p className="text-xs text-gray-400 mt-2">{src.email_host}:{src.email_port}</p>
                            
                            <div className="mt-3 p-2 bg-gray-50 rounded text-xs">
                                <span className="font-bold">Estado:</span> {src.status_message || 'Pendiente'}
                            </div>
                        </div>
                        <div className="mt-4 flex justify-end">
                            <Button size="sm" variant="danger" onClick={() => handleDelete('/api/email-sources/', src.id)}>Eliminar</Button>
                        </div>
                    </Card>
                ))}
            </div>
        </>
      )}

      {/* CONTENIDO: REGLAS */}
      {activeTab === 'rules' && (
        <>
            <div className="flex justify-end">
                <Button onClick={() => setIsRuleModalOpen(true)}>+ Nueva Regla</Button>
            </div>

            <div className="grid gap-4">
                {rules.map(rule => (
                    <Card key={rule.id} className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <Badge color="blue">{rule.source_name}</Badge>
                                <span className="text-gray-400">➜</span>
                                <Badge color="green">{rule.account_name}</Badge>
                            </div>
                            <div className="mt-2 text-sm text-gray-700">
                                <strong>Parser:</strong> {rule.parser_type}
                            </div>
                            {rule.filter_recipient_email && (
                                <div className="text-sm text-gray-600">
                                    <strong>Filtro:</strong> Solo para <code>{rule.filter_recipient_email}</code>
                                </div>
                            )}
                        </div>
                        <Button size="sm" variant="danger" onClick={() => handleDelete('/api/email-rules/', rule.id)}>Eliminar</Button>
                    </Card>
                ))}
            </div>
        </>
      )}

      {/* --- MODAL NUEVA FUENTE --- */}
      <Modal isOpen={isSourceModalOpen} onClose={() => setIsSourceModalOpen(false)} title="Nueva Fuente de Correo">
        <form id="source-form" onSubmit={handleSaveSource} className="space-y-4">
            <Input label="Nombre (Alias)" placeholder="Gmail Casa" required value={sourceForm.name} onChange={e => setSourceForm({...sourceForm, name: e.target.value})} />
            <Input label="Correo" placeholder="usuario@gmail.com" required value={sourceForm.email_user} onChange={e => setSourceForm({...sourceForm, email_user: e.target.value})} />
            <Input label="Contraseña (App Password)" type="password" required value={sourceForm.password} onChange={e => setSourceForm({...sourceForm, password: e.target.value})} />
            <div className="flex gap-2">
                <Input label="Host" value={sourceForm.email_host} onChange={e => setSourceForm({...sourceForm, email_host: e.target.value})} containerClassName="flex-1" />
                <Input label="Puerto" type="number" value={sourceForm.email_port} onChange={e => setSourceForm({...sourceForm, email_port: e.target.value})} containerClassName="w-24" />
            </div>
            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="ghost" onClick={() => setIsSourceModalOpen(false)}>Cancelar</Button>
                <Button type="submit">Guardar</Button>
            </div>
        </form>
      </Modal>

      {/* --- MODAL NUEVA REGLA --- */}
      <Modal isOpen={isRuleModalOpen} onClose={() => setIsRuleModalOpen(false)} title="Nueva Regla de Procesamiento">
        <form id="rule-form" onSubmit={handleSaveRule} className="space-y-4">
            <Select label="Fuente de Origen" required value={ruleForm.source} onChange={e => setRuleForm({...ruleForm, source: e.target.value})}>
                <option value="">Seleccionar Fuente...</option>
                {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>

            <Select label="Cuenta Destino (Default)" required value={ruleForm.account} onChange={e => setRuleForm({...ruleForm, account: e.target.value})}>
                <option value="">Seleccionar Cuenta...</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>

            <Select label="Tipo de Parser" required value={ruleForm.parser_type} onChange={e => setRuleForm({...ruleForm, parser_type: e.target.value})}>
                <option value="BANCO_CHILE">Banco de Chile / Edwards</option>
                <option value="GENERIC">Genérico (Próximamente)</option>
            </Select>

            <div className="pt-2 border-t border-gray-100">
                <h4 className="text-xs font-bold text-gray-700 uppercase mb-2">Filtros Avanzados</h4>
                <Input 
                    label="Filtrar por Destinatario (Opcional)" 
                    placeholder="ej: mi.pareja@gmail.com"
                    helpText="Solo procesar si el correo iba dirigido a esta dirección."
                    value={ruleForm.filter_recipient_email}
                    onChange={e => setRuleForm({...ruleForm, filter_recipient_email: e.target.value})}
                />
            </div>

            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="ghost" onClick={() => setIsRuleModalOpen(false)}>Cancelar</Button>
                <Button type="submit">Guardar</Button>
            </div>
        </form>
      </Modal>
    </div>
  );
};

export default SettingsView;