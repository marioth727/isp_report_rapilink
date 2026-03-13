import { useState, useEffect } from 'react';
import { X, Save, RefreshCw, Calendar, User } from 'lucide-react';
import { WisphubService, type WispHubStaff } from '../../lib/wisphub';
import clsx from 'clsx';

interface EditTicketModalProps {
    ticket: any;
    onClose: () => void;
    onUpdate: () => void;
}

export function EditTicketModal({ ticket, onClose, onUpdate }: EditTicketModalProps) {
    const [loading, setLoading] = useState(false);
    const [subjects, setSubjects] = useState<string[]>([]);
    const [staff, setStaff] = useState<WispHubStaff[]>([]);

    // Helper robusto para parsear fechas de WispHub (DD/MM/YYYY HH:mm:ss o ISO)
    const parseWisphubDate = (dateStr: any): string => {
        if (!dateStr) return '';
        try {
            const s = String(dateStr).trim();
            if (!s || s === 'None' || s === 'undefined') return '';

            // 1. Intentar parseo nativo primero (maneja MM/DD/YYYY e ISO)
            const d = new Date(s);
            if (!isNaN(d.getTime()) && d.getFullYear() > 2000) {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const hours = String(d.getHours()).padStart(2, '0');
                const minutes = String(d.getMinutes()).padStart(2, '0');
                return `${year}-${month}-${day}T${hours}:${minutes}`;
            }

            // 2. Fallback manual para DD/MM/YYYY (que suele fallar en parseo nativo)
            if (s.includes('/')) {
                const parts = s.split(' ');
                const dateParts = parts[0].split('/');
                let timeParts = parts[1]?.split(':') || ['00', '00'];

                let hours = parseInt(timeParts[0]);
                const minutes = timeParts[1]?.slice(0, 2) || '00';

                // Manejar AM/PM si existe
                if (s.toLowerCase().includes('p. m.') && hours < 12) hours += 12;
                if (s.toLowerCase().includes('a. m.') && hours === 12) hours = 0;

                const day = dateParts[0].padStart(2, '0');
                const month = dateParts[1].padStart(2, '0');
                const year = dateParts[2];

                if (!isNaN(parseInt(year))) {
                    return `${year}-${month}-${day}T${String(hours).padStart(2, '0')}:${minutes}`;
                }
            }
        } catch (e) {
            console.error('Error parsing date:', dateStr, e);
        }
        return '';
    };

    // Form State
    const [formData, setFormData] = useState({
        asunto: ticket.asunto || '',
        prioridad: ticket.id_prioridad || ticket.prioridad_id || 2,
        estado: ticket.id_estado || ticket.estado_id || 1,
        tecnico: String(ticket.tecnico_id || ''),
        descripcion: ticket.descripcion || '',
        fecha_estimada_inicio: parseWisphubDate(ticket.fecha_estimada_inicio),
        fecha_estimada_fin: parseWisphubDate(ticket.fecha_estimada_fin || '')
    });

    useEffect(() => {
        const loadCatalogs = async () => {
            const [subj, stf] = await Promise.all([
                WisphubService.getTicketSubjects(),
                WisphubService.getStaff()
            ]);
            setSubjects(subj);
            setStaff(stf);

            // SINCRONIZACIÓN DE TÉCNICO (ROBUSTA)
            let techId = formData.tecnico;

            if (!techId || techId === 'None' || techId === '' || techId === '0' || techId === 'null' || techId === 'undefined') {
                // 1. Intentar por usuario
                if (ticket.tecnico_usuario && ticket.tecnico_usuario !== 'None' && ticket.tecnico_usuario !== '') {
                    const found = stf.find(s => String(s.usuario) === String(ticket.tecnico_usuario));
                    if (found) techId = String(found.id);
                }

                // 2. Intentar por nombre (ej: "Mario Vasquez")
                if ((!techId || techId === 'None') && ticket.nombre_tecnico && ticket.nombre_tecnico !== 'None') {
                    const found = stf.find(s =>
                        s.nombre.toLowerCase().trim() === ticket.nombre_tecnico.toLowerCase().trim() ||
                        s.nombre.toLowerCase().includes(ticket.nombre_tecnico.toLowerCase().trim()) ||
                        ticket.nombre_tecnico.toLowerCase().includes(s.nombre.toLowerCase().trim())
                    );
                    if (found) techId = String(found.id);
                }
            }

            if (techId && techId !== formData.tecnico && techId !== 'None') {
                setFormData(prev => ({ ...prev, tecnico: techId }));
            }
        };
        loadCatalogs();
    }, [ticket]);

    const handleChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Formatear fechas de vuelta a DD/MM/YYYY HH:mm
            const formatDateForWH = (isoString: string) => {
                if (!isoString) return '';
                const d = new Date(isoString);
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                const hours = String(d.getHours()).padStart(2, '0');
                const minutes = String(d.getMinutes()).padStart(2, '0');
                return `${day}/${month}/${year} ${hours}:${minutes}`;
            };

            const payload = {
                ...formData,
                fecha_estimada_inicio: formatDateForWH(formData.fecha_estimada_inicio),
                fecha_estimada_fin: formatDateForWH(formData.fecha_estimada_fin)
            };

            const success = await WisphubService.updateTicket(ticket.id, payload, 'PUT');

            if (success) {
                onUpdate();
                onClose();
            } else {
                alert('Error al actualizar el ticket. Verifique la consola o intente nuevamente.');
            }
        } catch (error) {
            console.error(error);
            alert('Error inesperado al actualizar.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white border border-zinc-200 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
                    <div>
                        <h3 className="text-lg font-bold uppercase flex items-center gap-2 text-zinc-900 tracking-tight">
                            <RefreshCw className="text-blue-600" size={20} />
                            Editar Ticket #{ticket.id}
                        </h3>
                        <p className="text-xs text-zinc-500 font-medium mt-1">
                            {ticket.nombre_cliente}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400 hover:text-zinc-600">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    <form id="edit-ticket-form" onSubmit={handleSubmit} className="space-y-5">

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {/* Asunto */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Asunto</label>
                                <select
                                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-zinc-700"
                                    value={formData.asunto}
                                    onChange={e => handleChange('asunto', e.target.value)}
                                    required
                                >
                                    <option value="">Seleccionar Asunto...</option>
                                    {subjects.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                    {/* Caso borde: El asunto actual no está en el catálogo (ej: typos de WispHub) */}
                                    {formData.asunto && !subjects.includes(formData.asunto) && (
                                        <option value={formData.asunto}>{formData.asunto}</option>
                                    )}
                                </select>
                            </div>

                            {/* Prioridad */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Prioridad</label>
                                <select
                                    className={clsx(
                                        "w-full border rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 transition-all",
                                        formData.prioridad === 1 && "bg-slate-50 border-slate-300 text-slate-700 focus:ring-slate-500/20 focus:border-slate-500",
                                        formData.prioridad === 2 && "bg-blue-50 border-blue-300 text-blue-700 focus:ring-blue-500/20 focus:border-blue-500",
                                        formData.prioridad === 3 && "bg-orange-50 border-orange-300 text-orange-700 focus:ring-orange-500/20 focus:border-orange-500",
                                        formData.prioridad === 4 && "bg-red-50 border-red-300 text-red-700 focus:ring-red-500/20 focus:border-red-500"
                                    )}
                                    value={formData.prioridad}
                                    onChange={e => handleChange('prioridad', Number(e.target.value))}
                                >
                                    <option value={1}>Baja</option>
                                    <option value={2}>Normal</option>
                                    <option value={3}>Alta</option>
                                    <option value={4}>Muy Alta</option>
                                </select>
                            </div>

                            {/* Estado */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Estado</label>
                                <select
                                    className={clsx(
                                        "w-full border rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 transition-all",
                                        formData.estado === 1 && "bg-cyan-50 border-cyan-300 text-cyan-700 focus:ring-cyan-500/20 focus:border-cyan-500",
                                        formData.estado === 2 && "bg-yellow-50 border-yellow-300 text-yellow-700 focus:ring-yellow-500/20 focus:border-yellow-500",
                                        formData.estado === 3 && "bg-green-50 border-green-300 text-green-700 focus:ring-green-500/20 focus:border-green-500",
                                        formData.estado === 4 && "bg-gray-50 border-gray-300 text-gray-700 focus:ring-gray-500/20 focus:border-gray-500"
                                    )}
                                    value={formData.estado}
                                    onChange={e => handleChange('estado', Number(e.target.value))}
                                >
                                    <option value={1}>Nuevo</option>
                                    <option value={2}>En Progreso</option>
                                    <option value={3}>Resuelto</option>
                                    <option value={4}>Cerrado</option>
                                </select>
                            </div>

                            {/* Tecnico */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                                    <User size={12} /> Técnico Asignado
                                </label>
                                <select
                                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-zinc-700"
                                    value={String(formData.tecnico)}
                                    onChange={e => handleChange('tecnico', e.target.value)}
                                >
                                    <option value="">Sin Asignar</option>
                                    {staff.map(s => (
                                        <option key={String(s.id)} value={String(s.id)}>{s.nombre}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Fechas */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                                    <Calendar size={12} /> Fecha Estimada Inicio
                                </label>
                                <input
                                    type="datetime-local"
                                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-zinc-700"
                                    value={formData.fecha_estimada_inicio}
                                    onChange={e => handleChange('fecha_estimada_inicio', e.target.value)}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                                    <Calendar size={12} /> Fecha Estimada Fin
                                </label>
                                <input
                                    type="datetime-local"
                                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-zinc-700"
                                    value={formData.fecha_estimada_fin}
                                    onChange={e => handleChange('fecha_estimada_fin', e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Descripción */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Descripción</label>
                            <textarea
                                className="w-full h-32 bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none text-zinc-700"
                                value={formData.descripcion}
                                onChange={e => handleChange('descripcion', e.target.value)}
                            />
                        </div>

                    </form>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-bold text-zinc-600 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form="edit-ticket-form"
                        disabled={loading}
                        className={clsx(
                            "px-5 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl border border-blue-600 hover:bg-blue-700 hover:border-blue-700 transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2",
                            loading && "opacity-70 cursor-not-allowed"
                        )}
                    >
                        {loading ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                        Guardar Cambios
                    </button>
                </div>
            </div>
        </div>
    );
}
