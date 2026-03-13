import { useState, useEffect, useCallback } from 'react';
import {
    Phone, PhoneCall, PhoneOff, RefreshCw, CheckCircle2, XCircle,
    AlertTriangle, BarChart3, Users, Play, Pause, Plus,
    ChevronRight, Loader2, Mic, ArrowUpRight,
    Radio, Zap, TrendingUp, Calendar, Trash2, Archive
} from 'lucide-react';
import clsx from 'clsx';
import {
    VoiceCampaignService,
    type VoiceCampaign,
    type VoiceCall,
    type VoiceCampaignClient,
    categorizarCliente,
} from '../lib/voiceCampaigns';
import { WisphubService } from '../lib/wisphub';

// ── N8N Webhook URL (ajustar en producción)
const N8N_INICIAR_CAMPANA = 'https://n8n.rapilinksas.co/webhook/iniciar-campana';

// ─────────────────────────────────────────────
// SUB-COMPONENTES
// ─────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color, sub }: {
    icon: any; label: string; value: string | number; color: string; sub?: string
}) {
    return (
        <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
            <div className={clsx('p-3 rounded-xl shrink-0', color)}>
                <Icon className="w-5 h-5" />
            </div>
            <div>
                <p className="text-xs font-black uppercase text-muted-foreground tracking-widest">{label}</p>
                <p className="text-2xl font-black text-foreground leading-none mt-0.5">{value}</p>
                {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
            </div>
        </div>
    );
}

type ResultType = 'acepto' | 'rechazo' | 'reintento' | 'escalado' | 'no_contesto' | 'buzon';

const RESULT_CONFIG: Record<ResultType, { label: string; color: string; icon: any }> = {
    acepto: { label: '✅ Aceptó', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: CheckCircle2 },
    rechazo: { label: '❌ Rechazó', color: 'bg-red-500/10 text-red-600 border-red-500/20', icon: XCircle },
    reintento: { label: '🔄 Reintento', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: RefreshCw },
    escalado: { label: '↗️ Escalado', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: ArrowUpRight },
    no_contesto: { label: '📵 No contestó', color: 'bg-gray-500/10 text-gray-500 border-gray-500/20', icon: PhoneOff },
    buzon: { label: '📬 Buzón', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20', icon: Mic },
};

function ResultBadge({ resultado }: { resultado?: string | null }) {
    const cfg = resultado ? RESULT_CONFIG[resultado as ResultType] : null;
    if (!cfg) return <span className="text-xs text-muted-foreground">—</span>;
    return (
        <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase border', cfg.color)}>
            {cfg.label}
        </span>
    );
}

const ESTADO_CAMPANA: Record<string, { label: string; color: string; dot: string }> = {
    borrador: { label: 'Borrador', color: 'text-gray-400', dot: 'bg-gray-400' },
    revision: { label: 'En Revisión', color: 'text-amber-500', dot: 'bg-amber-500' },
    activa: { label: 'Activa', color: 'text-emerald-500', dot: 'bg-emerald-500' },
    pausada: { label: 'Pausada', color: 'text-orange-500', dot: 'bg-orange-500' },
    completada: { label: 'Completada', color: 'text-blue-500', dot: 'bg-blue-500' },
};

// ─────────────────────────────────────────────
// MODAL: NUEVA CAMPAÑA
// ─────────────────────────────────────────────

function NewCampaignModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const [paso, setPaso] = useState<'datos' | 'clientes' | 'preview'>('datos');
    const [nombre, setNombre] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [filtroCategoria, setFiltroCategoria] = useState<string[]>(['A', 'B', 'C', 'D']);
    const [filtroHistorial, setFiltroHistorial] = useState({
        nuevos: true,
        noContesto: true,
        rechazaron: false,
        aceptaron: false,
    });
    const [maxClientes, setMaxClientes] = useState<number>(0); // 0 = sin límite
    const [clientes, setClientes] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

    const clientesSeleccionados = clientes.filter(c => c._selected);

    const cargarClientes = async () => {
        setLoading(true);
        setError('');
        try {
            const [wisphubClients, historySummary] = await Promise.all([
                WisphubService.searchClients(''),
                VoiceCampaignService.getCallsSummary()
            ]);

            let categorizados = wisphubClients
                .filter((c: any) => c.telefono || c.celular)
                .map((c: any) => {
                    const idWisp = String(c.id_servicio);
                    const history = historySummary[idWisp];
                    const precio = Number(c.precio_plan || c.precio || 0);
                    const cat = categorizarCliente(precio);
                    return {
                        id_cliente_wisphub: idWisp,
                        nombre: c.nombre,
                        telefono: (c.celular || c.telefono || '').replace(/\D/g, ''),
                        plan_actual: c.nombre_plan || 'Plan Actual',
                        velocidad_actual: Number(c.velocidad || c.megas || 30),
                        precio_actual: precio,
                        ...cat,
                        _selected: true,
                        _history: history,
                    };
                })
                .filter((c: any) => {
                    // Filtro Categoría
                    if (!filtroCategoria.includes(c.categoria)) return false;

                    // Filtro Histórico
                    if (!c._history) return filtroHistorial.nuevos;

                    const res = c._history.resultado;
                    if (res === 'acepto') return filtroHistorial.aceptaron;
                    if (res === 'rechazo') return filtroHistorial.rechazaron;
                    if (res === 'no_contesto' || res === 'buzon') return filtroHistorial.noContesto;

                    return true;
                });

            // Aplicar límite si está configurado
            if (maxClientes > 0) {
                categorizados = categorizados.slice(0, maxClientes);
            }
            setClientes(categorizados);
        } catch (e: any) {
            setError('Error cargando clientes: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleCliente = (index: number) => {
        setClientes(prev => prev.map((c, i) => i === index ? { ...c, _selected: !c._selected } : c));
    };

    const seleccionarTodos = (valor: boolean) => {
        setClientes(prev => prev.map(c => ({ ...c, _selected: valor })));
    };

    const crearCampana = async () => {
        if (!nombre.trim()) return;
        setCreating(true);
        try {
            const campana = await VoiceCampaignService.createCampaign(nombre, descripcion);
            // Solo incluir los clientes que están seleccionados
            const clientesToAdd = clientesSeleccionados.map(c => ({
                campana_id: campana.id,
                id_cliente_wisphub: c.id_cliente_wisphub,
                nombre: c.nombre,
                telefono: c.telefono,
                plan_actual: c.plan_actual,
                velocidad_actual: c.velocidad_actual,
                precio_actual: c.precio_actual,
                categoria: c.categoria,
                plan_upsell: c.plan_upsell,
                precio_upsell: c.precio_upsell,
                velocidad_upsell: c.velocidad_upsell,
                plan_downsell: c.plan_downsell,
                precio_downsell: c.precio_downsell,
                velocidad_downsell: c.velocidad_downsell,
            }));
            await VoiceCampaignService.addClients(campana.id, clientesToAdd);
            await VoiceCampaignService.submitForReview(campana.id);
            onCreated();
            onClose();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-card w-full max-w-2xl rounded-3xl border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-6 border-b border-border bg-gradient-to-r from-violet-500/10 to-blue-500/10">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-violet-500/20 rounded-2xl">
                            <Radio className="w-6 h-6 text-violet-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-black uppercase tracking-widest text-foreground">Nueva Campaña de Voz</h2>
                            <p className="text-xs text-muted-foreground">Sofía llamará a tus clientes automáticamente</p>
                        </div>
                    </div>
                    {/* Stepper */}
                    <div className="flex items-center gap-2 mt-4">
                        {(['datos', 'clientes', 'preview'] as const).map((s, i) => (
                            <div key={s} className="flex items-center gap-2">
                                <div className={clsx(
                                    'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all',
                                    paso === s ? 'bg-violet-500 text-white' : i < ['datos', 'clientes', 'preview'].indexOf(paso) ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'
                                )}>{i + 1}</div>
                                <span className={clsx('text-[10px] font-black uppercase', paso === s ? 'text-foreground' : 'text-muted-foreground')}>
                                    {s === 'datos' ? 'Datos' : s === 'clientes' ? 'Clientes' : 'Preview'}
                                </span>
                                {i < 2 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar" style={{ maxHeight: 'calc(90vh - 200px)' }}>
                    {paso === 'datos' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-black uppercase text-muted-foreground mb-2">Nombre de la Campaña *</label>
                                <input
                                    value={nombre}
                                    onChange={e => setNombre(e.target.value)}
                                    placeholder="Ej: Upgrade Planes Febrero 2026"
                                    className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-violet-500/20 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase text-muted-foreground mb-2">Descripción</label>
                                <textarea
                                    value={descripcion}
                                    onChange={e => setDescripcion(e.target.value)}
                                    placeholder="Objetivo, alcance, notas internas..."
                                    rows={3}
                                    className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-violet-500/20 outline-none resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase text-muted-foreground mb-2">Categorías de Clientes</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { cat: 'A', desc: 'Upgrade Gratuito (mismo precio, más velocidad)', color: 'emerald' },
                                        { cat: 'B', desc: 'Migración con Ahorro (más barato)', color: 'blue' },
                                        { cat: 'C', desc: 'Migración con Aumento de Precio', color: 'amber' },
                                        { cat: 'D', desc: 'Migración Forzosa (plan obsoleto)', color: 'red' },
                                    ].map(({ cat, desc, color }) => (
                                        <button
                                            key={cat}
                                            onClick={() => setFiltroCategoria(prev =>
                                                prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                                            )}
                                            className={clsx(
                                                'p-3 rounded-xl border text-left transition-all',
                                                filtroCategoria.includes(cat)
                                                    ? `border-${color}-500/50 bg-${color}-500/10`
                                                    : 'border-border bg-muted/30'
                                            )}
                                        >
                                            <p className="text-xs font-black">Cat. {cat}</p>
                                            <p className="text-[9px] text-muted-foreground leading-snug mt-0.5">{desc}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase text-muted-foreground mb-2">
                                    Límite de Clientes
                                    <span className="normal-case font-normal ml-1 text-muted-foreground/60">(0 = sin límite)</span>
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        min={0}
                                        value={maxClientes}
                                        onChange={e => setMaxClientes(Math.max(0, parseInt(e.target.value) || 0))}
                                        className="w-28 bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-sm font-black focus:ring-2 focus:ring-violet-500/20 outline-none"
                                        placeholder="0"
                                    />
                                    <div className="flex gap-2">
                                        {[1, 10, 50, 100].map(n => (
                                            <button
                                                key={n}
                                                onClick={() => setMaxClientes(n)}
                                                className={clsx(
                                                    'px-3 py-2 rounded-lg text-xs font-black border transition-all',
                                                    maxClientes === n
                                                        ? 'bg-violet-500 text-white border-violet-500'
                                                        : 'bg-muted/50 text-muted-foreground border-border hover:border-violet-500/50'
                                                )}
                                            >
                                                {n}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {maxClientes > 0 && (
                                    <p className="text-[10px] text-violet-400 font-bold mt-1.5">✓ Solo se cargarán los primeros {maxClientes} clientes filtrados</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase text-muted-foreground mb-3">Filtrar por Historial</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { id: 'nuevos', label: '🆕 Solo Nuevos', desc: 'Nunca llamados' },
                                        { id: 'noContesto', label: '🔄 Reintentos', desc: 'No contestó/Buzón' },
                                        { id: 'rechazaron', label: '❌ Rechazaron', desc: 'Dijo que no antes' },
                                        { id: 'aceptaron', label: '✅ Aceptaron', desc: 'Ya tiene upgrade' },
                                    ].map(f => (
                                        <button
                                            key={f.id}
                                            onClick={() => setFiltroHistorial(prev => ({ ...prev, [f.id]: !prev[f.id as keyof typeof prev] }))}
                                            className={clsx(
                                                'p-3 rounded-xl border text-left transition-all',
                                                filtroHistorial[f.id as keyof typeof filtroHistorial]
                                                    ? 'bg-blue-500/10 border-blue-500/30'
                                                    : 'bg-muted/30 border-border opacity-60'
                                            )}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className={clsx(
                                                    'w-3.5 h-3.5 rounded flex items-center justify-center border transition-all',
                                                    filtroHistorial[f.id as keyof typeof filtroHistorial] ? 'bg-blue-500 border-blue-500' : 'bg-transparent border-muted-foreground/40'
                                                )}>
                                                    {filtroHistorial[f.id as keyof typeof filtroHistorial] && <span className="text-white text-[9px] font-black">✓</span>}
                                                </div>
                                                <p className="text-xs font-black">{f.label}</p>
                                            </div>
                                            <p className="text-[9px] text-muted-foreground leading-snug">{f.desc}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {paso === 'clientes' && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-muted-foreground">Clientes de WISPHub filtrados por categoría</p>
                                    {clientes.length > 0 && (
                                        <p className="text-[10px] font-black mt-0.5">
                                            <span className="text-violet-400">{clientesSeleccionados.length}</span>
                                            <span className="text-muted-foreground"> / {clientes.length} seleccionados</span>
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={cargarClientes}
                                    disabled={loading}
                                    className="flex items-center gap-2 px-4 py-2 bg-violet-500 text-white rounded-xl text-xs font-black hover:bg-violet-600 transition-all disabled:opacity-50"
                                >
                                    {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                    {loading ? 'Cargando...' : 'Cargar Clientes'}
                                </button>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-500 font-bold">
                                    {error}
                                </div>
                            )}

                            {clientes.length > 0 && (
                                <>
                                    {/* Controles de selección masiva */}
                                    <div className="flex items-center gap-2 pb-1 border-b border-border">
                                        <span className="text-[10px] text-muted-foreground font-bold uppercase">Selección:</span>
                                        <button
                                            onClick={() => seleccionarTodos(true)}
                                            className="px-2.5 py-1 text-[10px] font-black bg-violet-500/10 text-violet-400 rounded-lg border border-violet-500/20 hover:bg-violet-500/20 transition-all"
                                        >
                                            ✓ Todos
                                        </button>
                                        <button
                                            onClick={() => seleccionarTodos(false)}
                                            className="px-2.5 py-1 text-[10px] font-black bg-muted text-muted-foreground rounded-lg border border-border hover:border-red-500/30 transition-all"
                                        >
                                            ✕ Ninguno
                                        </button>
                                        <span className="text-[10px] text-muted-foreground ml-auto">
                                            {clientesSeleccionados.length} entrarán a la campaña
                                        </span>
                                    </div>

                                    {/* Lista con checkboxes */}
                                    <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-1.5">
                                        {clientes.map((c, i) => (
                                            <button
                                                key={i}
                                                onClick={() => toggleCliente(i)}
                                                className={clsx(
                                                    'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                                                    c._selected
                                                        ? 'bg-violet-500/10 border-violet-500/30'
                                                        : 'bg-muted/20 border-border opacity-50 hover:opacity-70'
                                                )}
                                            >
                                                {/* Checkbox visual */}
                                                <div className={clsx(
                                                    'w-4 h-4 rounded flex items-center justify-center shrink-0 border-2 transition-all',
                                                    c._selected
                                                        ? 'bg-violet-500 border-violet-500'
                                                        : 'bg-transparent border-muted-foreground/40'
                                                )}>
                                                    {c._selected && <span className="text-white text-[9px] font-black leading-none">✓</span>}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-black truncate">{c.nombre}</p>
                                                    <p className="text-[10px] text-muted-foreground">{c.telefono} · Cat. {c.categoria} · ${c.precio_actual?.toLocaleString()}/mes</p>
                                                </div>
                                                <span className={clsx(
                                                    'shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase',
                                                    c.categoria === 'A' ? 'bg-emerald-500/20 text-emerald-600' :
                                                        c.categoria === 'B' ? 'bg-blue-500/20 text-blue-600' :
                                                            c.categoria === 'C' ? 'bg-amber-500/20 text-amber-600' :
                                                                'bg-red-500/20 text-red-600'
                                                )}>Cat. {c.categoria}</span>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}

                            {clientes.length === 0 && !loading && (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                    <p className="text-xs font-bold">Haz clic en "Cargar Clientes" para obtener la lista</p>
                                </div>
                            )}
                        </div>
                    )}

                    {paso === 'preview' && (
                        <div className="space-y-4">
                            <div className="p-4 bg-gradient-to-br from-violet-500/10 to-blue-500/10 rounded-2xl border border-violet-500/20">
                                <h3 className="text-sm font-black text-foreground mb-3">📋 Resumen de la Campaña</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase font-black">Nombre</p>
                                        <p className="text-xs font-bold">{nombre}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase font-black">Clientes</p>
                                        <p className="text-xs font-bold">{clientesSeleccionados.length} <span className="text-muted-foreground font-normal">(de {clientes.length})</span></p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase font-black">Categorías</p>
                                        <p className="text-xs font-bold">Cat. {filtroCategoria.join(', ')}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase font-black">Simultáneas</p>
                                        <p className="text-xs font-bold">Máx. 90 llamadas</p>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-black text-amber-600">La campaña se enviará a revisión</p>
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            Un supervisor deberá aprobarla antes de que Sofía empiece a llamar.
                                            Las llamadas usarán el trunk TroncalMovil a través de Issabel PBX.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-500 font-bold">
                                    {error}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-border flex items-center justify-between">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 bg-muted text-muted-foreground rounded-xl text-xs font-black uppercase hover:bg-muted/80 transition-all"
                    >
                        Cancelar
                    </button>
                    <div className="flex items-center gap-2">
                        {paso !== 'datos' && (
                            <button
                                onClick={() => setPaso(paso === 'preview' ? 'clientes' : 'datos')}
                                className="px-5 py-2.5 bg-muted text-foreground rounded-xl text-xs font-black uppercase hover:bg-muted/80 transition-all"
                            >
                                ← Atrás
                            </button>
                        )}
                        {paso === 'datos' && (
                            <button
                                onClick={() => nombre.trim() && setPaso('clientes')}
                                disabled={!nombre.trim()}
                                className="px-5 py-2.5 bg-violet-500 text-white rounded-xl text-xs font-black uppercase hover:bg-violet-600 transition-all disabled:opacity-50"
                            >
                                Siguiente →
                            </button>
                        )}
                        {paso === 'clientes' && (
                            <button
                                onClick={() => clientesSeleccionados.length > 0 && setPaso('preview')}
                                disabled={clientesSeleccionados.length === 0}
                                className="px-5 py-2.5 bg-violet-500 text-white rounded-xl text-xs font-black uppercase hover:bg-violet-600 transition-all disabled:opacity-50"
                            >
                                Preview ({clientesSeleccionados.length}) →
                            </button>
                        )}
                        {paso === 'preview' && (
                            <button
                                onClick={crearCampana}
                                disabled={creating}
                                className="px-5 py-2.5 bg-emerald-500 text-white rounded-xl text-xs font-black uppercase hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                                {creating ? 'Creando...' : 'Crear y Enviar a Revisión'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// PANEL DE DETALLE DE CAMPAÑA
// ─────────────────────────────────────────────

function CampaignDetailPanel({ campaign, onBack, onRefresh }: {
    campaign: VoiceCampaign;
    onBack: () => void;
    onRefresh: () => void;
}) {
    const [calls, setCalls] = useState<VoiceCall[]>([]);
    const [clients, setClients] = useState<VoiceCampaignClient[]>([]);
    const [loading, setLoading] = useState(true);
    const [approving, setApproving] = useState(false);
    const [tab, setTab] = useState<'llamadas' | 'clientes'>('llamadas');
    const [maxSimultaneas, setMaxSimultaneas] = useState(1);

    useEffect(() => {
        loadData();
    }, [campaign.id]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [c, cl] = await Promise.all([
                VoiceCampaignService.getCampaignCalls(campaign.id),
                VoiceCampaignService.getCampaignClients(campaign.id),
            ]);
            setCalls(c);
            setClients(cl);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async () => {
        setApproving(true);
        try {
            await VoiceCampaignService.approveCampaign(campaign.id, N8N_INICIAR_CAMPANA, maxSimultaneas);
            onRefresh();
        } catch (e: any) {
            alert('Error al aprobar: ' + e.message);
        } finally {
            setApproving(false);
        }
    };

    const handlePause = async () => {
        await VoiceCampaignService.pauseCampaign(campaign.id);
        onRefresh();
    };

    const handleStop = async () => {
        if (!confirm('¿Deseas detener esta campaña definitivamente? Los clientes no llamados quedarán disponibles para futuras campañas.')) return;
        try {
            await VoiceCampaignService.archiveCampaign(campaign.id);
            onRefresh();
        } catch (e: any) {
            alert('Error al detener: ' + e.message);
        }
    };

    const handleDelete = async () => {
        if (!confirm('¿Estás seguro de eliminar esta campaña? No se puede deshacer.')) return;
        try {
            await VoiceCampaignService.deleteCampaign(campaign.id);
            onBack();
            onRefresh();
        } catch (e: any) {
            alert('Error al eliminar: ' + e.message);
        }
    };

    const handleArchive = async () => {
        if (!confirm('¿Quieres mover esta campaña a completadas?')) return;
        try {
            await VoiceCampaignService.archiveCampaign(campaign.id);
            onRefresh();
        } catch (e: any) {
            alert('Error al archivar: ' + e.message);
        }
    };

    const est = ESTADO_CAMPANA[campaign.estado];
    const completadas = campaign.llamadas_completadas || 1;
    const tasaConv = Math.round((campaign.llamadas_aceptaron / completadas) * 100);

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2">
                <button onClick={onBack} className="text-xs font-black text-muted-foreground hover:text-foreground uppercase transition-colors">
                    ← Campañas
                </button>
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs font-black uppercase text-foreground">{campaign.nombre}</span>
                <span className={clsx('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase ml-2', est.color)}>
                    <span className={clsx('w-1.5 h-1.5 rounded-full', campaign.estado === 'activa' ? 'animate-pulse' : '', est.dot)} />
                    {est.label}
                </span>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={Users} label="Total Clientes" value={campaign.total_clientes} color="bg-violet-500/10 text-violet-500" />
                <StatCard icon={CheckCircle2} label="Aceptaron" value={campaign.llamadas_aceptaron} color="bg-emerald-500/10 text-emerald-500"
                    sub={`${tasaConv}% conversión`} />
                <StatCard icon={XCircle} label="Rechazaron" value={campaign.llamadas_rechazaron} color="bg-red-500/10 text-red-500" />
                <StatCard icon={RefreshCw} label="Reintentos" value={campaign.llamadas_reintento} color="bg-amber-500/10 text-amber-500" />
            </div>

            {/* Actions & Config */}
            <div className="flex flex-col gap-4 bg-muted/20 p-5 rounded-3xl border border-border/50">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        {(campaign.estado === 'revision' || campaign.estado === 'pausada') && (
                            <div className="flex flex-col gap-1.5 px-4 h-11 justify-center bg-card border border-border rounded-xl shadow-sm">
                                <label className="text-[9px] font-black uppercase text-muted-foreground leading-none">Canales Simultáneos</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={90}
                                    value={maxSimultaneas}
                                    onChange={(e) => setMaxSimultaneas(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-16 bg-transparent border-none p-0 text-sm font-black focus:ring-0 outline-none"
                                />
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            {(campaign.estado === 'revision' || campaign.estado === 'pausada') && (
                                <button
                                    onClick={handleApprove}
                                    disabled={approving}
                                    className="flex items-center gap-2 px-6 h-11 bg-emerald-500 text-white rounded-xl text-xs font-black uppercase hover:bg-emerald-600 shadow-xl shadow-emerald-500/20 transition-all disabled:opacity-50"
                                >
                                    {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                                    {approving ? 'Iniciando...' : campaign.estado === 'pausada' ? 'Reanudar' : 'Iniciar Campaña'}
                                </button>
                            )}
                            {campaign.estado === 'activa' && (
                                <button
                                    onClick={handlePause}
                                    className="flex items-center gap-2 px-6 h-11 bg-orange-500 text-white rounded-xl text-xs font-black uppercase hover:bg-orange-600 transition-all shadow-xl shadow-orange-500/20"
                                >
                                    <Pause className="w-4 h-4 fill-current" />
                                    Pausar
                                </button>
                            )}
                            {(campaign.estado === 'activa' || campaign.estado === 'pausada') && (
                                <button
                                    onClick={handleStop}
                                    className="flex items-center gap-2 px-6 h-11 bg-slate-700 text-white rounded-xl text-xs font-black uppercase hover:bg-slate-800 transition-all shadow-lg"
                                >
                                    <XCircle className="w-4 h-4" />
                                    Detener
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {campaign.estado !== 'activa' && (
                            <>
                                <button
                                    onClick={handleArchive}
                                    className="p-3 bg-muted text-muted-foreground rounded-xl hover:text-foreground hover:bg-muted/80 transition-all border border-border"
                                    title="Archivar"
                                >
                                    <Archive className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-all border border-red-500/20"
                                    title="Eliminar"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </>
                        )}
                        <button
                            onClick={loadData}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 h-11 bg-muted text-foreground rounded-xl text-xs font-black uppercase hover:bg-muted/80 transition-all border border-border"
                        >
                            <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
                            Refrescar
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-muted/30 rounded-xl p-1 w-fit">
                {(['llamadas', 'clientes'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={clsx(
                            'px-4 py-2 rounded-lg text-xs font-black uppercase transition-all',
                            tab === t ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
                        )}
                    >
                        {t === 'llamadas' ? `📞 Llamadas (${calls.length})` : `👥 Clientes (${clients.length})`}
                    </button>
                ))}
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center h-40">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            ) : tab === 'llamadas' ? (
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/30 border-b border-border">
                                <tr>
                                    {['Cliente', 'Resultado', 'Plan Aceptado', 'Duración', 'Audio', 'Fecha'].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-[9px] font-black uppercase text-muted-foreground tracking-widest">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {calls.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-12 text-center text-xs text-muted-foreground">
                                            No hay llamadas registradas aún
                                        </td>
                                    </tr>
                                ) : calls.map(call => (
                                    <tr key={call.id} className="hover:bg-muted/20 transition-colors">
                                        <td className="px-4 py-3 text-xs font-black">{call.id_cliente_wisphub}</td>
                                        <td className="px-4 py-3"><ResultBadge resultado={call.resultado} /></td>
                                        <td className="px-4 py-3 text-xs text-muted-foreground">{call.plan_aceptado || '—'}</td>
                                        <td className="px-4 py-3 text-xs text-muted-foreground">
                                            {call.duracion_segundos ? `${Math.round(call.duracion_segundos / 60)}m ${call.duracion_segundos % 60}s` : '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {call.recording_url ? (
                                                <a href={call.recording_url} target="_blank" rel="noopener noreferrer"
                                                    className="flex items-center gap-1 text-[10px] font-black text-violet-500 hover:underline">
                                                    <Mic className="w-3 h-3" /> Audio
                                                </a>
                                            ) : <span className="text-[10px] text-muted-foreground">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-[10px] text-muted-foreground">
                                            {new Date(call.iniciada_at).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/30 border-b border-border">
                                <tr>
                                    {['Cliente', 'Teléfono', 'Cat.', 'Plan Actual', 'Upsell → Downsell', 'Estado'].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-[9px] font-black uppercase text-muted-foreground tracking-widest">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {clients.map(c => (
                                    <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                                        <td className="px-4 py-3 text-xs font-black">{c.nombre}</td>
                                        <td className="px-4 py-3 text-xs text-muted-foreground">{c.telefono}</td>
                                        <td className="px-4 py-3">
                                            <span className={clsx(
                                                'px-2 py-0.5 rounded-full text-[9px] font-black uppercase',
                                                c.categoria === 'A' ? 'bg-emerald-500/20 text-emerald-600' :
                                                    c.categoria === 'B' ? 'bg-blue-500/20 text-blue-600' :
                                                        c.categoria === 'C' ? 'bg-amber-500/20 text-amber-600' :
                                                            'bg-red-500/20 text-red-600'
                                            )}>Cat. {c.categoria}</span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-muted-foreground">{c.plan_actual} · ${c.precio_actual?.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-[10px] text-muted-foreground">
                                            {c.plan_upsell} → {c.plan_downsell}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={clsx(
                                                'px-2 py-0.5 rounded-full text-[9px] font-black uppercase',
                                                c.estado === 'completado' ? 'bg-emerald-500/10 text-emerald-600' :
                                                    c.estado === 'en_llamada' ? 'bg-blue-500/10 text-blue-600 animate-pulse' :
                                                        c.estado === 'error' ? 'bg-red-500/10 text-red-600' :
                                                            'bg-muted text-muted-foreground'
                                            )}>{c.estado}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────

export function VoiceCampaigns() {
    const [campaigns, setCampaigns] = useState<VoiceCampaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<VoiceCampaign | null>(null);
    const [showNew, setShowNew] = useState(false);
    const [showCompleted, setShowCompleted] = useState(false);

    const loadCampaigns = useCallback(async () => {
        setLoading(true);
        try {
            const data = await VoiceCampaignService.getCampaigns();
            setCampaigns(data);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadCampaigns(); }, []);

    // Totales globales
    const totalClientes = campaigns.reduce((a, c) => a + c.total_clientes, 0);
    const totalAceptaron = campaigns.reduce((a, c) => a + c.llamadas_aceptaron, 0);
    const totalCompletadas = campaigns.reduce((a, c) => a + c.llamadas_completadas, 0);
    const activas = campaigns.filter(c => c.estado === 'activa').length;

    if (selected) {
        return (
            <div>
                <CampaignDetailPanel
                    campaign={selected}
                    onBack={() => { setSelected(null); loadCampaigns(); }}
                    onRefresh={async () => {
                        const data = await VoiceCampaignService.getCampaigns();
                        setCampaigns(data);
                        const updated = data.find(c => c.id === selected.id);
                        if (updated) setSelected(updated);
                        else setSelected(null);
                    }}
                />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2.5 bg-gradient-to-br from-violet-500/20 to-blue-500/20 rounded-2xl">
                            <Radio className="w-6 h-6 text-violet-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black uppercase tracking-tight text-foreground">Voice AI</h1>
                            <p className="text-xs text-muted-foreground">Sofía • Rapilink Upgrade Campaigns</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowCompleted(!showCompleted)}
                        className={clsx(
                            'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase transition-all border',
                            showCompleted ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 'bg-muted text-muted-foreground border-border'
                        )}
                    >
                        <Archive className="w-4 h-4" />
                        {showCompleted ? 'Ocultar Histórico' : 'Ver Histórico'}
                    </button>
                    <button
                        onClick={loadCampaigns}
                        className="p-2.5 hover:bg-muted rounded-xl transition-colors"
                    >
                        <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
                    </button>
                    <button
                        onClick={() => setShowNew(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-500 to-blue-500 text-white rounded-xl text-xs font-black uppercase hover:opacity-90 shadow-lg shadow-violet-500/20 transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        Nueva Campaña
                    </button>
                </div>
            </div>

            {/* Stats Globales */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={Radio} label="Campañas Activas" value={activas} color="bg-violet-500/10 text-violet-500" />
                <StatCard icon={PhoneCall} label="Total Clientes" value={totalClientes.toLocaleString()} color="bg-blue-500/10 text-blue-500" />
                <StatCard icon={TrendingUp} label="Conversiones" value={totalAceptaron} color="bg-emerald-500/10 text-emerald-500"
                    sub={totalCompletadas > 0 ? `${Math.round(totalAceptaron / totalCompletadas * 100)}% tasa` : ''} />
                <StatCard icon={BarChart3} label="Completadas" value={totalCompletadas} color="bg-amber-500/10 text-amber-500" />
            </div>

            {/* Campaigns Grid */}
            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            ) : campaigns.length === 0 ? (
                <div className="text-center py-24">
                    <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-violet-500/10 to-blue-500/10 rounded-3xl flex items-center justify-center">
                        <Radio className="w-10 h-10 text-violet-400/50" />
                    </div>
                    <h3 className="text-base font-black text-foreground mb-2">No hay campañas aún</h3>
                    <p className="text-sm text-muted-foreground mb-6">Crea tu primera campaña de llamadas automatizadas</p>
                    <button
                        onClick={() => setShowNew(true)}
                        className="px-6 py-3 bg-gradient-to-r from-violet-500 to-blue-500 text-white rounded-xl font-black text-xs uppercase shadow-lg"
                    >
                        + Crear Primera Campaña
                    </button>
                </div>
            ) : (
                <div className="grid gap-4">
                    {campaigns
                        .filter(c => showCompleted ? true : c.estado !== 'completada')
                        .map(campaign => {
                            const est = ESTADO_CAMPANA[campaign.estado];
                            const completadas = campaign.llamadas_completadas || 1;
                            const progress = Math.round((campaign.llamadas_completadas / (campaign.total_clientes || 1)) * 100);
                            const conv = Math.round((campaign.llamadas_aceptaron / completadas) * 100);

                            return (
                                <div
                                    key={campaign.id}
                                    onClick={() => setSelected(campaign)}
                                    className="group bg-card border border-border hover:border-violet-500/30 rounded-2xl p-5 cursor-pointer transition-all hover:shadow-lg hover:shadow-violet-500/5"
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={clsx(
                                                'p-2.5 rounded-xl',
                                                campaign.estado === 'activa' ? 'bg-emerald-500/10' :
                                                    campaign.estado === 'revision' ? 'bg-amber-500/10' :
                                                        campaign.estado === 'completada' ? 'bg-blue-500/10' :
                                                            'bg-muted'
                                            )}>
                                                {campaign.estado === 'activa' ? (
                                                    <Radio className="w-5 h-5 text-emerald-500 animate-pulse" />
                                                ) : campaign.estado === 'revision' ? (
                                                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                                                ) : (
                                                    <Phone className="w-5 h-5 text-muted-foreground" />
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-foreground group-hover:text-violet-500 transition-colors">{campaign.nombre}</h3>
                                                {campaign.descripcion && (
                                                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{campaign.descripcion}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={clsx('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase', est.color)}>
                                                <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', campaign.estado === 'activa' ? 'animate-pulse' : '', est.dot)} />
                                                {est.label}
                                            </span>
                                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-violet-500 transition-colors" />
                                        </div>
                                    </div>

                                    {/* Stats row */}
                                    <div className="grid grid-cols-4 gap-3 mb-4">
                                        {[
                                            { label: 'Total', value: campaign.total_clientes },
                                            { label: '✅ Aceptaron', value: campaign.llamadas_aceptaron },
                                            { label: '❌ Rechazaron', value: campaign.llamadas_rechazaron },
                                            { label: '🔄 Reintento', value: campaign.llamadas_reintento },
                                        ].map(s => (
                                            <div key={s.label} className="bg-muted/30 rounded-xl p-2.5 text-center">
                                                <p className="text-[9px] text-muted-foreground uppercase font-black">{s.label}</p>
                                                <p className="text-lg font-black text-foreground">{s.value}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Progress bar */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[9px] font-black text-muted-foreground uppercase">
                                            <span>Progreso</span>
                                            <span>{progress}% · {conv}% conversión</span>
                                        </div>
                                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-violet-500 to-emerald-500 rounded-full transition-all duration-500"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-3 flex items-center justify-between">
                                        <span className="text-[9px] text-muted-foreground">
                                            <Calendar className="w-3 h-3 inline mr-1" />
                                            {new Date(campaign.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </span>
                                        {campaign.estado === 'revision' && (
                                            <span className="text-[9px] font-black text-amber-500 uppercase animate-pulse">
                                                ⚠️ Pendiente de aprobación
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                </div>
            )}

            {/* Modal */}
            {showNew && (
                <NewCampaignModal
                    onClose={() => setShowNew(false)}
                    onCreated={loadCampaigns}
                />
            )}
        </div>
    );
}

export default VoiceCampaigns;
