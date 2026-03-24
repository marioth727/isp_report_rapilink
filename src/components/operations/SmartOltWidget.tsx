import { useState, useEffect } from 'react';
import { Activity, XCircle, AlertTriangle, Loader2, Wifi, ShieldCheck, ArrowUp } from 'lucide-react';
import { WisphubService } from '../../lib/wisphub';
import { SmartOLTService } from '../../lib/smartolt';
import clsx from 'clsx';

interface SmartOltWidgetProps {
    cedula?: string;
    idServicio?: number | null;
}

export function SmartOltWidget({ cedula, idServicio }: SmartOltWidgetProps) {
    const [loading, setLoading] = useState(false);
    const [signalRx, setSignalRx] = useState<number | null>(null);
    const [signalTx, setSignalTx] = useState<number | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [snOnu, setSnOnu] = useState<string | null>(null);

    useEffect(() => {
        if (!cedula && !idServicio) {
            setError('Información de red no disponible.');
            return;
        }

        let isMounted = true;

        const loadSignal = async () => {
            setLoading(true);
            setError(null);
            try {
                // 1. Obtener sn_onu desde WispHub
                const clientDetails = await WisphubService.getClientForSmartOlt(cedula, idServicio || undefined);
                if (!isMounted) return;

                if (!clientDetails) {
                    setError('Cliente no encontrado en WispHub.');
                    setLoading(false);
                    return;
                }

                const sn = clientDetails.sn_onu;
                setSnOnu(sn || null);

                if (!sn) {
                    setError('El campo SN (sn_onu) está vacío en WispHub.');
                    setLoading(false);
                    return;
                }

                // 2. Verificar estado en SmartOLT
                const assetStatus = await SmartOLTService.verifyAssetStatus(sn);
                if (!isMounted) return;

                if (!assetStatus) {
                    setError('ONU no encontrada o dada de baja en SmartOLT.');
                    setLoading(false);
                    return;
                }

                setStatus(assetStatus.status);

                // 3. Obtener señal real (RX y TX)
                if (assetStatus.status === 'online') {
                    const signals = await SmartOLTService.getOnuSignal(sn);
                    if (isMounted && signals) {
                        setSignalRx(signals.rx !== null ? signals.rx : assetStatus.signal_dbm);
                        setSignalTx(signals.tx);
                    } else if (isMounted) {
                        setSignalRx(assetStatus.signal_dbm);
                    }
                } else {
                    // Si está offline, solo tenemos el último RX conocido
                    if (isMounted) setSignalRx(assetStatus.signal_dbm); 
                }

            } catch (err: any) {
                if (isMounted) {
                    console.error('Error fetching SmartOLT signal:', err);
                    setError('Fallo al conectar con SmartOLT.');
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadSignal();

        return () => {
            isMounted = false;
        };
    }, [cedula, idServicio]);

    // Evaluación de calidad (RX)
    const getRxQuality = (dbm: number | null) => {
        if (dbm === null) return { text: 'Desconocida', color: 'text-slate-400', iconColor: 'text-slate-400', icon: Activity };
        if (dbm >= -25 && dbm <= -10) return { text: 'Excelente', color: 'text-white', iconColor: 'text-[#2de370]', icon: ShieldCheck };
        if (dbm >= -28 && dbm < -25) return { text: 'Aceptable', color: 'text-white', iconColor: 'text-amber-400', icon: AlertTriangle };
        if (dbm < -28) return { text: 'Crítica', color: 'text-rose-400', iconColor: 'text-rose-500', icon: XCircle };
        return { text: 'Desconocida', color: 'text-slate-400', iconColor: 'text-slate-400', icon: Activity };
    };

    const StatusBadge = () => {
        if (!status) return null;
        return (
            <div className={clsx(
                "flex items-center gap-1.5 px-3 py-1 rounded-full border border-opacity-50 shadow-[0_0_15px_rgba(0,0,0,0.2)]",
                status === 'online' ? "border-[#2de370] text-[#2de370] shadow-[#2de370]/20" :
                status === 'los' ? "border-rose-500 text-rose-500 shadow-rose-500/20" :
                status === 'power_failure' ? "border-amber-500 text-amber-500 shadow-amber-500/20" :
                "border-slate-500 text-slate-400"
            )}>
                <Activity size={14} className={clsx("animate-pulse", status !== 'online' && "hidden")} />
                <span className="text-xs font-bold tracking-wide uppercase">
                    {status === 'power_failure' ? 'SIN ENERGÍA' : status === 'los' ? 'CABLE ROTO' : status}
                </span>
            </div>
        );
    };

    const rxQuality = getRxQuality(signalRx);
    const RxIcon = rxQuality.icon;

    return (
        <div className="w-full relative rounded-3xl p-px overflow-hidden bg-gradient-to-br from-slate-700/50 to-slate-900/50 shadow-2xl">
            {/* Contenedor principal oscuro tipo Glass */}
            <div className="w-full h-full bg-[#1e2330]/90 backdrop-blur-3xl rounded-[23px] flex flex-col pt-4">
                
                {/* Cabecera */}
                <div className="px-5 flex items-center justify-between z-10">
                    <div className="flex items-center gap-2">
                        <Wifi size={24} className="text-[#3b82f6] drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]" strokeWidth={2.5} />
                        <h4 className="text-lg font-black text-white tracking-wide">ESTADO ÓPTICO</h4>
                    </div>
                    <StatusBadge />
                </div>

                <div className="px-4 pb-6 mt-4 z-10 mb-2 relative flex flex-col">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-3">
                            <Loader2 size={32} className="text-[#3b82f6] animate-spin" />
                            <span className="text-sm font-medium text-slate-400 animate-pulse">Diagnosticando red...</span>
                        </div>
                    ) : error ? (
                        <div className="flex items-start gap-4 p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 backdrop-blur-md">
                            <AlertTriangle size={24} className="shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-bold tracking-tight mb-1 text-white">Diagnóstico Incompleto</p>
                                <p className="text-sm font-medium opacity-90 leading-relaxed">{error}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="relative">
                            {/* Inner Box Glassmorphism */}
                            <div className="border border-white/10 bg-white/5 backdrop-blur-xl rounded-2xl p-5 shadow-[inset_0_0_20px_rgba(255,255,255,0.02)] overflow-hidden">
                                
                                {/* Decoración de fondo suave (líneas/luces) simulando la imagen */}
                                <div className="absolute inset-0 opacity-20 pointer-events-none mix-blend-screen" 
                                    style={{
                                        backgroundImage: 'radial-gradient(circle at 70% 80%, rgba(45, 227, 112, 0.15) 0%, transparent 50%), radial-gradient(circle at 10% 20%, rgba(59, 130, 246, 0.15) 0%, transparent 40%)'
                                    }}>
                                </div>

                                <div className="flex relative z-10 w-full">
                                    {/* Izquierda: RX Grande */}
                                    <div className="flex-1 flex flex-col justify-end">
                                        <div className="flex items-baseline gap-1.5 drop-shadow-md">
                                            <span className={clsx(
                                                "text-6xl font-black tracking-tight leading-none",
                                                signalRx !== null ? "text-white" : "text-slate-500"
                                            )}>
                                                {signalRx !== null ? signalRx.toFixed(2) : '- -'}
                                            </span>
                                            <span className="text-2xl font-bold text-slate-200">dBm</span>
                                        </div>
                                        <div className="mt-2 text-sm font-semibold text-slate-300 flex items-center gap-1">
                                            <span className="text-white font-bold">RX</span> (Recepción)
                                        </div>
                                    </div>

                                    {/* Divisor Vertical */}
                                    <div className="w-px bg-white/10 mx-6 self-stretch rounded-full" />

                                    {/* Derecha: Calidad Arriba, TX Abajo */}
                                    <div className="flex-1 flex flex-col justify-between py-1">
                                        
                                        {/* Calidad Arriba Derecha */}
                                        <div className="flex items-start gap-2 mb-4">
                                            <RxIcon size={24} className={rxQuality.iconColor} strokeWidth={2.5} />
                                            <div className="flex flex-col">
                                                <span className={clsx("text-base font-bold leading-tight", rxQuality.color)}>
                                                    {rxQuality.text}
                                                </span>
                                                <span className="text-xs font-medium text-slate-400">
                                                    Calidad del Enlace
                                                </span>
                                            </div>
                                        </div>

                                        {/* TX Abajo Derecha */}
                                        <div className="flex flex-col mt-auto">
                                            {signalTx !== null ? (
                                                <div className="flex items-baseline gap-1 drop-shadow-sm">
                                                    <span className="text-[28px] font-bold tracking-tight text-white leading-none">
                                                        {signalTx.toFixed(2)}
                                                    </span>
                                                    <span className="text-base font-semibold text-slate-200">dBm</span>
                                                </div>
                                            ) : (
                                                <span className="text-2xl font-bold text-slate-500">- -</span>
                                            )}
                                            
                                            <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-slate-300 uppercase tracking-wide">
                                                <span className="text-white font-bold">TX</span> (Transmisión)
                                                <ArrowUp size={12} className="text-slate-400 ml-0.5" strokeWidth={3} />
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            </div>
                            
                            {/* Insignia Flotante Bottom Center superpuesta al borde */}
                            {snOnu && (
                                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-20">
                                    <div className="bg-[#121c2d] border border-blue-500/30 shadow-[0_4px_10px_rgba(0,0,0,0.5)] rounded-full px-4 py-1.5 flex items-center justify-center">
                                        <span className="text-[10px] font-black text-blue-400/80 uppercase tracking-widest mr-1">
                                            SERIAL ONU:
                                        </span>
                                        <span className="text-[11px] font-mono font-bold text-slate-200 tracking-wider">
                                            {snOnu}
                                        </span>
                                    </div>
                                </div>
                            )}

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
