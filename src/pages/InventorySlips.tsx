import { useState, useEffect } from 'react';
import {
    FileText,
    Sunrise,
    Sunset,
    Users,
    ChevronRight,
    Loader2,
    CheckCircle2,
    Package
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SignaturePad } from '../components/ui/SignaturePad';
import { useNavigate } from 'react-router-dom';

export default function InventorySlips() {
    const navigate = useNavigate();
    const [step, setStep] = useState<'mode-select' | 'tech-select' | 'review' | 'signature' | 'success'>('mode-select');
    const [mode, setMode] = useState<'morning' | 'evening'>('morning');
    const [technicians, setTechnicians] = useState<any[]>([]);
    const [selectedTech, setSelectedTech] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const [itemsToProcess, setItemsToProcess] = useState<any[]>([]); // Items to deliver or settle

    useEffect(() => {
        if (step === 'tech-select') {
            loadTechnicians();
        }
    }, [step]);

    const loadTechnicians = async () => {
        setLoading(true);
        const { data } = await supabase.from('profiles').select('id, full_name').order('full_name');
        if (data) setTechnicians(data);
        setLoading(false);
    };

    const handleTechSelect = async (tech: any) => {
        setSelectedTech(tech);
        setLoading(true);

        if (mode === 'morning') {
            const { data: assets } = await supabase
                .from('inventory_assets')
                .select('*, inventory_items(name)')
                .eq('current_holder_id', tech.id)
                .eq('status', 'assigned');

            setItemsToProcess(assets || []);
        } else {
            const today = new Date().toISOString().split('T')[0];
            const { data: installations } = await supabase
                .from('inventory_movements')
                .select('*, inventory_assets(*, inventory_items(name))')
                .eq('origin_holder_id', tech.id)
                .eq('movement_type', 'installation')
                .gte('created_at', today);

            setItemsToProcess(installations || []);
        }

        setLoading(false);
        setStep('review');
    };

    const handleSaveSlip = async (signatureData: string) => {
        setLoading(true);
        try {
            const { error } = await supabase.from('inventory_delivery_slips').insert({
                technician_id: selectedTech.id,
                slip_type: mode === 'morning' ? 'morning_delivery' : 'evening_settlement',
                signature_data: signatureData,
                items_snapshot: itemsToProcess.map(i => ({
                    id: i.id,
                    serial: i.serial_number || i.inventory_assets?.serial_number,
                    name: i.inventory_items?.name || i.inventory_assets?.inventory_items?.name,
                    status: i.status || 'consumed'
                })),
                notes: mode === 'morning' ? 'Entrega de material y equipos' : 'Liquidación diaria de instalaciones'
            });

            if (error) throw error;
            setStep('success');
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const resetFlow = () => {
        setStep('mode-select');
        setSelectedTech(null);
        setItemsToProcess([]);
    };

    return (
        <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-primary/20 shadow-inner">
                    <FileText className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-4xl font-black uppercase tracking-tight">Actas Digitales</h1>
                <p className="text-muted-foreground font-medium">Formalización de entrega y recepción de materiales.</p>
            </div>

            {/* Step 1: Mode Selection */}
            {step === 'mode-select' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4">
                    <button
                        onClick={() => { setMode('morning'); setStep('tech-select'); }}
                        className="bg-sky-500/5 border-2 border-sky-500/20 p-8 rounded-[2.5rem] hover:bg-sky-500/10 hover:border-sky-500/40 transition-all text-left group"
                    >
                        <div className="p-4 bg-sky-500/10 rounded-2xl text-sky-500 w-fit mb-4 group-hover:scale-110 transition-transform">
                            <Sunrise size={32} />
                        </div>
                        <h2 className="text-2xl font-black uppercase text-foreground mb-1">Entrega Mañana</h2>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Acta de material recibido</p>
                    </button>

                    <button
                        onClick={() => { setMode('evening'); setStep('tech-select'); }}
                        className="bg-indigo-500/5 border-2 border-indigo-500/20 p-8 rounded-[2.5rem] hover:bg-indigo-500/10 hover:border-indigo-500/40 transition-all text-left group"
                    >
                        <div className="p-4 bg-indigo-500/10 rounded-2xl text-indigo-500 w-fit mb-4 group-hover:scale-110 transition-transform">
                            <Sunset size={32} />
                        </div>
                        <h2 className="text-2xl font-black uppercase text-foreground mb-1">Liquidación Tarde</h2>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Cierre de instalaciones</p>
                    </button>
                </div>
            )}

            {/* Step 2: Tech Selection */}
            {step === 'tech-select' && (
                <div className="space-y-6 animate-in slide-in-from-right-4">
                    <button onClick={() => setStep('mode-select')} className="text-xs font-black uppercase text-muted-foreground hover:text-primary">← Volver</button>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {loading ? <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /> : technicians.map(tech => (
                            <button
                                key={tech.id}
                                onClick={() => handleTechSelect(tech)}
                                className="bg-card border-2 border-border p-6 rounded-[2rem] hover:border-primary hover:bg-primary/5 transition-all text-left flex items-center gap-4 group"
                            >
                                <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                                    <Users className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                                </div>
                                <div>
                                    <p className="font-black uppercase tracking-tight text-foreground">{tech.full_name}</p>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Seleccionar</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Step 3: Review Items */}
            {step === 'review' && selectedTech && (
                <div className="space-y-6 animate-in slide-in-from-right-4">
                    <button onClick={() => setStep('tech-select')} className="text-xs font-black uppercase text-muted-foreground hover:text-primary">← Volver</button>

                    <div className="bg-card border-2 border-border p-8 rounded-[2.5rem]">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-2xl font-black uppercase tracking-tight">{mode === 'morning' ? 'Material a Cargo' : 'Resumen Instalaciones'}</h3>
                                <p className="text-muted-foreground font-medium">Técnico: {selectedTech.full_name}</p>
                            </div>
                            <div className="px-4 py-2 bg-muted rounded-xl text-xs font-black uppercase hidden sm:block">
                                {new Date().toLocaleDateString()}
                            </div>
                        </div>

                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {itemsToProcess.length === 0 ? (
                                <div className="p-8 text-center border-2 border-dashed border-border rounded-3xl text-muted-foreground">
                                    <p className="text-xs font-black uppercase">No hay registros para procesar</p>
                                </div>
                            ) : (
                                itemsToProcess.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl border border-border">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-card rounded-xl border border-border">
                                                <Package size={16} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-black uppercase">
                                                    {item.inventory_items?.name || item.inventory_assets?.inventory_items?.name || 'Item'}
                                                </p>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase">
                                                    SN: {item.serial_number || item.inventory_assets?.serial_number || '---'}
                                                </p>
                                            </div>
                                        </div>
                                        {mode === 'evening' && (
                                            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase rounded-full border border-emerald-500/20">
                                                Instalado
                                            </span>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="mt-8 pt-8 border-t border-border">
                            <button
                                onClick={() => setStep('signature')}
                                className="w-full py-4 bg-primary text-white text-xs font-black uppercase rounded-2xl shadow-xl shadow-primary/20 hover:opacity-90 transition-all"
                            >
                                Confirmar y Firmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 4: Signature */}
            {step === 'signature' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 max-w-xl mx-auto">
                    {/* Botón Volver más prominente */}
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => setStep('review')}
                            className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl text-xs font-black uppercase text-foreground hover:bg-muted hover:border-primary transition-all"
                        >
                            <ChevronRight className="w-4 h-4 rotate-180" />
                            Volver a revisar
                        </button>
                        <span className="text-xs font-bold text-muted-foreground uppercase">Paso 4 de 4</span>
                    </div>

                    <div className="text-center space-y-2">
                        <h3 className="text-2xl font-black uppercase">Firma del Técnico</h3>
                        <p className="text-muted-foreground text-xs uppercase font-bold text-balance">
                            Yo, {selectedTech?.full_name}, declaro que la información es correcta.
                        </p>
                    </div>

                    <SignaturePad onSave={handleSaveSlip} />
                </div>
            )}

            {/* Step 5: Success */}
            {step === 'success' && (
                <div className="text-center space-y-6 animate-in zoom-in-95 py-12">
                    <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border-4 border-emerald-500/20 shadow-xl shadow-emerald-500/10">
                        <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black uppercase text-foreground">¡Acta Generada!</h2>
                        <p className="text-muted-foreground font-medium mt-2">El documento ha sido firmado y registrado en el sistema.</p>
                    </div>
                    <div className="flex justify-center gap-4 pt-4">
                        <button
                            onClick={resetFlow}
                            className="px-8 py-3 bg-muted text-foreground rounded-xl text-xs font-black uppercase hover:bg-muted/80 transition-all"
                        >
                            Nueva Acta
                        </button>
                        <button
                            onClick={() => navigate('/operaciones/inventario')}
                            className="px-8 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-primary/20 hover:opacity-90 transition-all"
                        >
                            Ir al Dashboard
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
