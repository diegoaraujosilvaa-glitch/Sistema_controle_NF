import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Truck, 
  ClipboardCheck, 
  ClipboardX, 
  History, 
  Search, 
  AlertCircle,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  Plus,
  Layers,
  FileText,
  Car,
  Barcode,
  ChevronRight,
  LayoutDashboard,
  Settings
} from 'lucide-react';
import { Movement, OperationType, OperationStatus, Vehicle } from './types';
import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  setDoc, 
  doc, 
  writeBatch,
  getDoc,
  Timestamp,
  getCountFromServer
} from 'firebase/firestore';

export default function App() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'checkout' | 'checkin' | 'vehicles'>('checkout');
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'missing_plate' | 'missing_keys' | 'other' | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [manualPlate, setManualPlate] = useState('');
  const [historySearch, setHistorySearch] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    nfe_key: '',
    vehicle_plate: '',
    vehicle_model: '',
    driver_name: '',
    status: 'Concluída' as OperationStatus,
    reason: ''
  });

  const [batchKeys, setBatchKeys] = useState<{key: string, count: number}[]>([]);
  const [currentScan, setCurrentScan] = useState('');
  const [plateQuery, setPlateQuery] = useState('');
  const [showPlateSuggestions, setShowPlateSuggestions] = useState(false);

  const [vehicleForm, setVehicleForm] = useState({
    plate: '',
    model: '',
    driver_name: ''
  });

  const scanInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMovements();
    fetchVehicles();
  }, []);

  const fetchMovements = async () => {
    try {
      const q = query(collection(db, 'normagate_movimentacoes'), orderBy('timestamp', 'desc'), limit(50));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          nfe_key: d.nfe_key,
          operation_type: d.operation_type,
          status: d.status,
          reason: d.reason,
          vehicle_plate: d.vehicle_plate,
          vehicle_model: d.vehicle_model,
          driver_name: d.driver_name,
          timestamp: d.timestamp?.toDate?.()?.toISOString() || new Date().toISOString()
        };
      }) as Movement[];
      setMovements(data);
    } catch (err) {
      console.error('Failed to fetch movements', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVehicles = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'normagate_veiculos'));
      const data = querySnapshot.docs.map(doc => {
        const d = doc.data();
        return {
          plate: doc.id,
          model: d.model,
          driver_name: d.driver_name
        };
      }) as Vehicle[];
      setVehicles(data);
    } catch (err) {
      console.error('Failed to fetch vehicles', err);
    }
  };

  const handleSaveVehicle = async () => {
    if (!vehicleForm.plate) return;
    try {
      const plate = vehicleForm.plate.toUpperCase();
      await setDoc(doc(db, 'normagate_veiculos', plate), {
        model: vehicleForm.model,
        driver_name: vehicleForm.driver_name
      });
      fetchVehicles();
      setVehicleForm({ plate: '', model: '', driver_name: '' });
      setSuccess('Veículo cadastrado com sucesso!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error saving vehicle', err);
      setError('Erro ao salvar veículo.');
    }
  };

  const seedVehicles = async () => {
    const initialVehicles = [
      { plate: 'PNZ4406', model: 'MB08' },
      { plate: 'ORZ0465', model: 'MB09' },
      { plate: 'HWL7403', model: 'MB18' },
      { plate: 'HXY7945', model: 'MB19' },
      { plate: 'OSA6711', model: 'MB20' },
      { plate: 'OSL9998', model: 'MB21' },
      { plate: 'PMH9219', model: 'MB23' },
      { plate: 'OCF9681', model: 'MB24' },
      { plate: 'OSU7145', model: 'MB49' },
      { plate: 'POW9495', model: 'MB51' },
      { plate: 'PNR2C84', model: 'MB55' },
      { plate: 'POR0C93', model: 'MB56' },
      { plate: 'POZ5F66', model: 'MB59' },
      { plate: 'OIM0086', model: 'MB60' },
      { plate: 'SBK9I25', model: 'MB62' },
      { plate: 'SBV7I66', model: 'MB63' },
      { plate: 'SBD9F47', model: 'MB65' },
      { plate: 'SAX9B97', model: 'MB66' },
      { plate: 'SBT6A94', model: 'MB67' },
      { plate: 'NIU2I54', model: 'MB69' },
      { plate: 'THN6F19', model: 'MB71' },
      { plate: 'PNY8C03', model: 'MB73' }
    ];

    try {
      const batch = writeBatch(db);
      initialVehicles.forEach(v => {
        const docRef = doc(db, 'normagate_veiculos', v.plate);
        batch.set(docRef, { model: v.model, driver_name: '' });
      });
      await batch.commit();
      fetchVehicles();
      setSuccess('Carga inicial de veículos realizada!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error seeding vehicles', err);
      setError('Erro ao realizar carga inicial.');
    }
  };

  const addKeyToBatch = async (key: string) => {
    const trimmed = key.trim();
    if (!trimmed) return;
    if (batchKeys.some(item => item.key === trimmed)) {
      setError('Esta nota já está na lista do lote.');
      setErrorType('other');
      setShowErrorModal(true);
      return;
    }

    try {
      // Regra de Ouro: Validação de Ciclo no Firestore
      const lastMoveQuery = query(
        collection(db, 'normagate_movimentacoes'),
        where('nfe_key', '==', trimmed),
        orderBy('timestamp', 'desc'),
        limit(1)
      );
      const lastMoveSnapshot = await getDocs(lastMoveQuery);
      
      if (!lastMoveSnapshot.empty) {
        const lastMove = lastMoveSnapshot.docs[0].data();
        
        if (activeTab === 'checkout') {
          if (lastMove.operation_type === 'Saída' && lastMove.status === 'Concluída') {
            // Exceção: Permita se o último registro for 'Retorno ao CD'
            if (lastMove.status !== 'Retorno ao CD') {
              setError(`NF já registrada em Saída anterior sem fechamento de ciclo.`);
              setErrorType('other');
              setShowErrorModal(true);
              return;
            }
          }
        } else if (activeTab === 'checkin') {
          if (lastMove.operation_type === 'Entrada' && lastMove.status === 'Concluída') {
            // Exceção: Permita se o último registro for 'Saída por Recusa'
            if (lastMove.status !== 'Saída por Recusa') {
              setError(`NF já registrada em Entrada anterior sem fechamento de ciclo.`);
              setErrorType('other');
              setShowErrorModal(true);
              return;
            }
          }
        }
      }

      const q = query(collection(db, 'normagate_movimentacoes'), where('nfe_key', '==', trimmed));
      const snapshot = await getCountFromServer(q);
      setBatchKeys([{ key: trimmed, count: snapshot.data().count || 0 }, ...batchKeys]);
      setCurrentScan('');
      setError(null);
    } catch (err) {
      console.error('Error in addKeyToBatch', err);
      setBatchKeys([{ key: trimmed, count: 0 }, ...batchKeys]);
      setCurrentScan('');
    }
  };

  const removeKeyFromBatch = (index: number) => {
    setBatchKeys(batchKeys.filter((_, i) => i !== index));
  };

  const handleSubmit = async (type: OperationType) => {
    setError(null);
    setErrorType(null);
    setSuccess(null);

    const nfe_keys = batchKeys.map(item => item.key);

    if (nfe_keys.length === 0) {
      setError('Por favor, bipe ao menos uma nota fiscal.');
      setErrorType('missing_keys');
      setShowErrorModal(true);
      return;
    }

    if (!formData.vehicle_plate) {
      setError('A placa do veículo é obrigatória.');
      setErrorType('missing_plate');
      setShowErrorModal(true);
      return;
    }

    if (formData.status !== 'Concluída' && !formData.reason) {
      setError('O motivo é obrigatório para este status.');
      setErrorType('other');
      setShowErrorModal(true);
      return;
    }

    try {
      const batch = writeBatch(db);
      const movementsCol = collection(db, 'normagate_movimentacoes');

      // Validation logic (simplified for frontend, ideally should be in a transaction or cloud function)
      // But here we'll just process them as requested.
      
      for (const key of nfe_keys) {
        const newDocRef = doc(movementsCol);
        batch.set(newDocRef, {
          nfe_key: key,
          operation_type: type,
          status: formData.status,
          reason: formData.reason || null,
          vehicle_plate: formData.vehicle_plate.toUpperCase(),
          vehicle_model: formData.vehicle_model || null,
          driver_name: formData.driver_name || null,
          timestamp: Timestamp.now()
        });
      }

      await batch.commit();

      setSuccess(`${nfe_keys.length} notas processadas com sucesso!`);
      setFormData({ nfe_key: '', vehicle_plate: '', vehicle_model: '', driver_name: '', status: 'Concluída', reason: '' });
      setBatchKeys([]);
      setPlateQuery('');
      fetchMovements();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error submitting batch', err);
      setError(err.message || 'Erro ao processar operação.');
      setShowErrorModal(true);
    }
  };

  const filteredVehicles = vehicles.filter(v => 
    v.plate.toLowerCase().includes(plateQuery.toLowerCase()) ||
    (v.model && v.model.toLowerCase().includes(plateQuery.toLowerCase()))
  );

  const filteredMovements = movements.filter(m => 
    m.nfe_key.toLowerCase().includes(historySearch.toLowerCase()) ||
    m.vehicle_plate.toLowerCase().includes(historySearch.toLowerCase()) ||
    (m.vehicle_model && m.vehicle_model.toLowerCase().includes(historySearch.toLowerCase())) ||
    (m.driver_name && m.driver_name.toLowerCase().includes(historySearch.toLowerCase())) ||
    (m.reason && m.reason.toLowerCase().includes(historySearch.toLowerCase()))
  );

  const getNFNumber = (key: string) => {
    if (key.length === 44) {
      return `NF ${key.slice(25, 34).replace(/^0+/, '')}`;
    }
    return key;
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans text-slate-900 overflow-x-hidden">
      {/* Header Compacto - Material Design 3 Style */}
      <header className="bg-white border-b border-slate-100 pt-4 px-4 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-brand-100">
              <Truck size={24} />
            </div>
            <h1 className="text-xl font-bold text-brand-700 tracking-tight">
              NORMAGATE NFe
            </h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setActiveTab('dashboard')} className={`p-2 rounded-full ${activeTab === 'dashboard' ? 'bg-brand-50 text-brand-600' : 'text-slate-400'}`}>
              <LayoutDashboard size={20} />
            </button>
            <button onClick={() => setActiveTab('vehicles')} className={`p-2 rounded-full ${activeTab === 'vehicles' ? 'bg-brand-50 text-brand-600' : 'text-slate-400'}`}>
              <Settings size={20} />
            </button>
          </div>
        </div>
        
        {/* Tabs Largas */}
        <div className="flex w-full border-b border-slate-100">
          <button 
            onClick={() => { setActiveTab('checkout'); setBatchKeys([]); setFormData(f => ({...f, status: 'Concluída'})); }}
            className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-all relative ${activeTab === 'checkout' ? 'text-brand-600' : 'text-slate-400'}`}
          >
            Check-out
            {activeTab === 'checkout' && <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-1 bg-brand-600 rounded-t-full" />}
          </button>
          <button 
            onClick={() => { setActiveTab('checkin'); setBatchKeys([]); setFormData(f => ({...f, status: 'Concluída'})); }}
            className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-all relative ${activeTab === 'checkin' ? 'text-brand-600' : 'text-slate-400'}`}
          >
            Check-in
            {activeTab === 'checkin' && <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-1 bg-brand-600 rounded-t-full" />}
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col pb-24">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                  <p className="text-xs font-bold text-emerald-600 uppercase">Saídas</p>
                  <p className="text-2xl font-black text-emerald-700">{movements.filter(m => m.operation_type === 'Saída').length}</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                  <p className="text-xs font-bold text-blue-600 uppercase">Entradas</p>
                  <p className="text-2xl font-black text-blue-700">{movements.filter(m => m.operation_type === 'Entrada').length}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-sm font-bold text-slate-500 uppercase">Histórico Recente</h2>
                </div>
                
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-600 transition-colors" size={18} />
                  <input 
                    type="text" 
                    placeholder="PESQUISAR NF OU PLACA..."
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-brand-600 focus:bg-white outline-none font-black text-xs uppercase tracking-widest transition-all"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  {filteredMovements.slice(0, 15).map(m => (
                    <div key={m.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group active:bg-slate-50 transition-colors">
                      <div>
                        <p className="font-black text-slate-900">{getNFNumber(m.nfe_key)}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                          {m.vehicle_plate} {m.vehicle_model ? `(${m.vehicle_model})` : ''} {m.driver_name ? `• ${m.driver_name}` : ''} • {new Date(m.timestamp).toLocaleDateString()} {new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                        {m.reason && (
                          <p className="text-[10px] font-black text-rose-600 uppercase mt-1 bg-rose-50 px-2 py-0.5 rounded-md inline-block">
                            MOTIVO: {m.reason}
                          </p>
                        )}
                      </div>
                      <div className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${m.operation_type === 'Saída' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                        {m.operation_type}
                      </div>
                    </div>
                  ))}
                  {filteredMovements.length === 0 && (
                    <div className="py-12 text-center space-y-2">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                        <Search size={24} className="text-slate-300" />
                      </div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Nenhum registro encontrado</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'vehicles' && (
            <motion.div key="vehicles" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 space-y-6">
              <div className="bg-slate-50 p-6 rounded-3xl space-y-4">
                <h2 className="text-lg font-bold text-slate-900">Cadastrar Veículo</h2>
                <div className="space-y-4">
                  <input 
                    type="text" placeholder="PLACA (EX: ABC1234)" 
                    maxLength={7}
                    className="w-full p-4 rounded-2xl border-2 border-slate-200 focus:border-brand-600 outline-none font-bold uppercase"
                    value={vehicleForm.plate} onChange={e => setVehicleForm({...vehicleForm, plate: e.target.value.toUpperCase()})}
                  />
                  <input 
                    type="text" placeholder="Modelo" 
                    className="w-full p-4 rounded-2xl border-2 border-slate-200 focus:border-brand-600 outline-none"
                    value={vehicleForm.model} onChange={e => setVehicleForm({...vehicleForm, model: e.target.value})}
                  />
                  <button onClick={handleSaveVehicle} className="w-full bg-brand-600 text-white p-4 rounded-2xl font-bold shadow-lg shadow-brand-200 active:scale-95 transition-all">
                    SALVAR VEÍCULO
                  </button>
                  <button onClick={seedVehicles} className="w-full bg-slate-200 text-slate-600 p-3 rounded-2xl font-bold text-xs uppercase active:scale-95 transition-all">
                    Realizar Carga Inicial (Lista Completa)
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {vehicles.map(v => (
                  <div key={v.plate} className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">
                      <Car size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{v.plate}</p>
                      <p className="text-xs text-slate-500">{v.model}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {(activeTab === 'checkout' || activeTab === 'checkin') && (
            <motion.div key="operacional" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full">
              {/* Seção de Identificação */}
              <div className="p-4 bg-slate-50/50 border-b border-slate-100">
                <div className="relative">
                  <label className="text-[10px] font-black text-brand-600 uppercase tracking-widest ml-1 mb-1 block">Veículo / Placa</label>
                  <div className="relative">
                    <Car className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-600" size={20} />
                    <input 
                      type="text" 
                      placeholder="PLACA OU MODELO"
                      maxLength={7}
                      className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl border-2 border-slate-200 focus:border-brand-600 outline-none font-black text-lg uppercase tracking-wider shadow-sm"
                      value={plateQuery}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setPlateQuery(val);
                        const found = vehicles.find(v => v.plate === val);
                        setFormData({ 
                          ...formData, 
                          vehicle_plate: val,
                          vehicle_model: found?.model || '',
                          driver_name: found?.driver_name || ''
                        });
                        setShowPlateSuggestions(true);
                      }}
                      onFocus={() => setShowPlateSuggestions(true)}
                    />
                  </div>
                  
                  {/* Autocomplete Suggestions */}
                  <AnimatePresence>
                    {showPlateSuggestions && plateQuery && filteredVehicles.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 z-20 overflow-hidden"
                      >
                        {filteredVehicles.map(v => (
                          <button 
                            key={v.plate}
                            className="w-full p-4 text-left hover:bg-brand-50 flex items-center justify-between border-b border-slate-50 last:border-0"
                            onClick={() => {
                              setPlateQuery(v.plate);
                              setFormData({ 
                                ...formData, 
                                vehicle_plate: v.plate,
                                vehicle_model: v.model || '',
                                driver_name: v.driver_name || ''
                              });
                              setShowPlateSuggestions(false);
                            }}
                          >
                            <span className="font-black text-slate-900">{v.plate}</span>
                            <span className="text-xs text-slate-400">{v.model}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Input de Alta Prioridade */}
              <div className="p-6 flex flex-col items-center justify-center space-y-4">
                <div className="w-full max-w-sm relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-brand-600 to-brand-800 rounded-3xl blur opacity-20 group-focus-within:opacity-40 transition duration-500"></div>
                  <div className="relative bg-white rounded-3xl border-2 border-brand-100 group-focus-within:border-brand-600 transition-all overflow-hidden">
                    <div className="flex items-center px-4 py-6">
                      <Barcode className="text-brand-600 mr-3" size={32} />
                      <input 
                        ref={scanInputRef}
                        type="text" 
                        placeholder="BIPAR NOTA"
                        className="w-full bg-transparent outline-none font-black text-2xl placeholder:text-slate-300 uppercase tracking-tighter"
                        value={currentScan}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCurrentScan(val);
                          if (val.length === 44 && /^\d+$/.test(val)) {
                            addKeyToBatch(val);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addKeyToBatch(currentScan);
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aguardando leitura do código de barras...</p>
              </div>

              {/* Status e Motivo */}
              <div className="px-4 space-y-4">
                <div className="flex gap-2">
                  <button 
                    onClick={() => setFormData({ ...formData, status: 'Concluída' })}
                    className={`flex-1 p-3 rounded-xl border-2 font-bold text-xs uppercase transition-all ${formData.status === 'Concluída' ? 'bg-brand-600 border-brand-600 text-white shadow-lg shadow-brand-100' : 'bg-white border-slate-100 text-slate-400'}`}
                  >
                    Concluída
                  </button>
                  <button 
                    onClick={() => setFormData({ ...formData, status: activeTab === 'checkout' ? 'Saída por Recusa' : 'Retorno ao CD' })}
                    className={`flex-1 p-3 rounded-xl border-2 font-bold text-xs uppercase transition-all ${formData.status !== 'Concluída' ? 'bg-rose-600 border-rose-600 text-white shadow-lg shadow-rose-100' : 'bg-white border-slate-100 text-slate-400'}`}
                  >
                    {activeTab === 'checkout' ? 'Recusa' : 'Retorno'}
                  </button>
                </div>

                {formData.status !== 'Concluída' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                    <textarea 
                      placeholder="MOTIVO OBRIGATÓRIO..."
                      className="w-full p-4 rounded-2xl border-2 border-rose-100 focus:border-rose-600 outline-none text-sm font-medium bg-rose-50/30"
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    />
                  </motion.div>
                )}
              </div>

              {/* Lista de Notas */}
              <div className="mt-6 px-4 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Notas no Lote ({batchKeys.length})</h3>
                  {batchKeys.length > 0 && (
                    <button onClick={() => setBatchKeys([])} className="text-[10px] font-black text-rose-600 uppercase">Limpar</button>
                  )}
                </div>
                <div className="space-y-2">
                  {batchKeys.map((item, idx) => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      key={item.key} 
                      className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group active:bg-slate-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-brand-50 text-brand-600 rounded-lg flex items-center justify-center relative">
                          <FileText size={16} />
                          {item.count > 0 && (
                            <span className="absolute -top-2 -right-2 bg-brand-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                              {item.count}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-black text-slate-900">{getNFNumber(item.key)}</p>
                          <p className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">{item.key}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => removeKeyFromBatch(idx)}
                        className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-rose-600 active:scale-125 transition-all"
                      >
                        <X size={20} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* FAB / Full-width Button na Base */}
      {(activeTab === 'checkout' || activeTab === 'checkin') && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent pt-10 z-20">
          <button 
            disabled={batchKeys.length === 0}
            onClick={() => handleSubmit(activeTab === 'checkout' ? 'Saída' : 'Entrada')}
            className={`w-full py-5 rounded-2xl font-black text-lg uppercase tracking-widest shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 ${
              batchKeys.length > 0 
                ? 'bg-brand-600 text-white shadow-brand-200' 
                : 'bg-slate-100 text-slate-300 cursor-not-allowed'
            }`}
          >
            {activeTab === 'checkout' ? <ArrowUpRight size={24} /> : <ArrowDownLeft size={24} />}
            Confirmar {activeTab === 'checkout' ? 'Saída' : 'Entrada'}
          </button>
        </div>
      )}

      {/* Feedback de Sucesso Toast */}
      <AnimatePresence>
        {success && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-4 right-4 bg-emerald-600 text-white p-4 rounded-2xl shadow-2xl z-50 flex items-center gap-3"
          >
            <CheckCircle2 size={24} />
            <p className="font-bold">{success}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feedback de Erro - Card Vermelho Flutuante (Material Design Modal) */}
      <AnimatePresence>
        {showErrorModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl border-4 border-rose-600"
            >
              <div className="bg-rose-600 p-8 text-white flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
                  <AlertCircle size={48} />
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tight">Atenção!</h3>
                <p className="text-lg font-bold leading-tight">{error}</p>
              </div>
              <div className="p-6 space-y-4">
                {errorType === 'missing_plate' && (
                  <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest text-center">Opção para Clientes / Fretes Externos</p>
                    <input 
                      type="text" 
                      placeholder="DIGITE A PLACA MANUAL"
                      maxLength={7}
                      className="w-full p-4 rounded-xl border-2 border-slate-200 focus:border-brand-600 outline-none font-black text-center uppercase"
                      value={manualPlate}
                      onChange={(e) => setManualPlate(e.target.value.toUpperCase())}
                    />
                    <button 
                      onClick={() => {
                        if (manualPlate) {
                          const val = manualPlate.toUpperCase();
                          const found = vehicles.find(v => v.plate === val);
                          setFormData({ 
                            ...formData, 
                            vehicle_plate: val,
                            vehicle_model: found?.model || '',
                            driver_name: found?.driver_name || ''
                          });
                          setPlateQuery(val);
                          setShowErrorModal(false);
                          setManualPlate('');
                        }
                      }}
                      className="w-full py-4 bg-brand-600 text-white rounded-xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all"
                    >
                      Usar Placa Manual
                    </button>
                  </div>
                )}
                <button 
                  onClick={() => setShowErrorModal(false)}
                  className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xl uppercase tracking-widest active:scale-95 transition-all"
                >
                  {errorType === 'missing_plate' ? 'Cancelar' : 'Entendi'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
