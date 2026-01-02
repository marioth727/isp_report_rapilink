
import { useForm, useFieldArray } from 'react-hook-form';
import type { DailyReport } from '../../types';
import { REPORT_CATEGORIES, PREDEFINED_OBJECTIONS } from '../../types';
import { Plus, Trash2, Save, Calendar as CalendarIcon, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import clsx from 'clsx';

export function DailyReportForm() {
    const navigate = useNavigate();
    const [saving, setSaving] = useState(false);

    const { register, control, handleSubmit, watch, formState: { errors } } = useForm<DailyReport>({
        defaultValues: {
            date: new Date().toISOString().split('T')[0],
            metrics: {
                contacts: { made: 0, effective: 0, no_answer: 0, switched_off: 0, wrong_number: 0, hung_up: 0 },
                conversion: { accepted: 0, rejected: 0 },
                alerts: { churn_rate: 0, complaints: 0, escalations: 0 }
            },
            categories_results: REPORT_CATEGORIES.map(cat => ({
                category_name: cat,
                goal: 0, contacted: 0, accepted: 0, rejected: 0,
                switched_off: 0, wrong_number: 0, hung_up: 0, thinking: 0, no_answer: 0
            })),
            objections: [],
            special_cases: [],
            observations: ''
        }
    });

    const { fields: objectionFields, append: appendObjection, remove: removeObjection } = useFieldArray({
        control,
        name: "objections"
    });

    const { fields: specialCaseFields, append: appendSpecialCase, remove: removeSpecialCase } = useFieldArray({
        control,
        name: "special_cases"
    });

    const { fields: categoryFields } = useFieldArray({
        control,
        name: "categories_results"
    });

    const watchedObjections = watch("objections");

    const onSubmit = async (data: DailyReport) => {
        // Validation: Prevent all zeros
        const totalContacts =
            data.metrics.contacts.made +
            data.metrics.contacts.effective +
            data.metrics.contacts.no_answer;

        const totalCategoryActivity = data.categories_results.reduce((sum, cat) => sum + cat.contacted + cat.goal, 0);

        if (totalContacts === 0 && totalCategoryActivity === 0) {
            alert("⚠️ No se puede guardar un reporte vacío. Por favor registra actividad real.");
            return;
        }

        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user found');

            let score: 'VERDE' | 'AMARILLO' | 'ROJO' = 'VERDE';
            if (data.metrics.conversion.accepted < 5 || data.metrics.contacts.made < 30) score = 'ROJO';
            else if (data.metrics.conversion.accepted < 10) score = 'AMARILLO';

            const reportData = {
                ...data,
                user_id: user.id,
                performance_score: score
            };

            const { error } = await supabase.from('daily_reports').insert(reportData);
            if (error) throw error;

            navigate('/reportes');
        } catch (error: any) {
            alert('Error al guardar: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 max-w-[95%] xl:max-w-7xl mx-auto pb-24">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-card p-6 rounded-lg border border-border shadow-sm gap-4">
                <div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Nuevo Reporte Diario</h2>
                    <p className="text-muted-foreground text-sm">Registra tu actividad del día con detalle.</p>
                </div>
                <div className="flex items-center gap-3 bg-background border border-input rounded-md px-3 py-2 w-full md:w-auto shadow-sm focus-within:ring-2 focus-within:ring-ring">
                    <CalendarIcon className="w-5 h-5 text-muted-foreground" />
                    <label className="sr-only">Fecha</label>
                    <input
                        type="date"
                        {...register('date')}
                        className="bg-transparent border-none focus:outline-none text-foreground w-full font-medium"
                        style={{ colorScheme: 'dark' }} // Force dark calendar picker
                    />
                </div>
            </div>

            {/* 1. Métricas Generales */}
            <div className="bg-card p-6 rounded-lg border border-border space-y-4">
                <h3 className="text-lg font-semibold border-b border-border pb-2 text-primary">1. Actividad y Contacto</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <InputGroup label="Llamadas Realizadas" register={register('metrics.contacts.made', { valueAsNumber: true })} />
                    <InputGroup label="Contactos Efectivos" register={register('metrics.contacts.effective', { valueAsNumber: true })} />
                    <InputGroup label="No Contestó" register={register('metrics.contacts.no_answer', { valueAsNumber: true })} />
                    <InputGroup label="Apagado" register={register('metrics.contacts.switched_off', { valueAsNumber: true })} />
                    <InputGroup label="Equivocado" register={register('metrics.contacts.wrong_number', { valueAsNumber: true })} />
                    <InputGroup label="Cuelgan" register={register('metrics.contacts.hung_up', { valueAsNumber: true })} />
                </div>
            </div>

            {/* 2. Resultados por Categoría */}
            <div className="bg-card p-6 rounded-lg border border-border space-y-4 overflow-hidden">
                <h3 className="text-lg font-semibold border-b border-border pb-2 text-primary">2. Resultados por Categoría</h3>
                <div className="overflow-x-auto pb-2">
                    <table className="w-full text-sm whitespace-nowrap border-collapse">
                        <thead>
                            <tr className="text-left text-muted-foreground bg-muted/30">
                                <th className="p-3 sticky left-0 bg-card z-10 border-r border-border min-w-[200px]">Categoría</th>
                                <th className="p-2 text-center w-24 bg-sky-900/20 text-sky-400 font-bold border-x border-border/50">Meta</th>
                                <th className="p-2 text-center w-20">Contac.</th>
                                <th className="p-2 text-center w-20 font-bold text-green-500">Acept.</th>
                                <th className="p-2 text-center w-20 text-red-500">Rech.</th>
                                <th className="p-2 text-center w-20">Apagado</th>
                                <th className="p-2 text-center w-20">Equiv.</th>
                                <th className="p-2 text-center w-20">Cuelgan</th>
                                <th className="p-2 text-center w-20 text-yellow-500">Pesarán</th>
                                <th className="p-2 text-center w-20">No Con.</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {categoryFields.map((field, index) => (
                                <tr key={field.id} className="group hover:bg-muted/10 transition-colors">
                                    <td className="p-3 font-medium sticky left-0 bg-card border-r border-border peer-hover:bg-muted/10">{field.category_name}</td>

                                    {/* Meta Column - Distinct Style */}
                                    <td className="p-1 bg-sky-900/10 border-x border-border/50">
                                        <input
                                            type="number"
                                            {...register(`categories_results.${index}.goal`, { valueAsNumber: true })}
                                            className="w-full bg-transparent border-none text-center font-bold text-sky-400 focus:ring-0"
                                        />
                                    </td>

                                    <td className="p-1"><TableInput register={register(`categories_results.${index}.contacted`, { valueAsNumber: true })} /></td>
                                    <td className="p-1"><TableInput register={register(`categories_results.${index}.accepted`, { valueAsNumber: true })} highlight="green" /></td>
                                    <td className="p-1"><TableInput register={register(`categories_results.${index}.rejected`, { valueAsNumber: true })} highlight="red" /></td>
                                    <td className="p-1"><TableInput register={register(`categories_results.${index}.switched_off`, { valueAsNumber: true })} /></td>
                                    <td className="p-1"><TableInput register={register(`categories_results.${index}.wrong_number`, { valueAsNumber: true })} /></td>
                                    <td className="p-1"><TableInput register={register(`categories_results.${index}.hung_up`, { valueAsNumber: true })} /></td>
                                    <td className="p-1"><TableInput register={register(`categories_results.${index}.thinking`, { valueAsNumber: true })} highlight="yellow" /></td>
                                    <td className="p-1"><TableInput register={register(`categories_results.${index}.no_answer`, { valueAsNumber: true })} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 3. Objeciones */}
                <div className="bg-card p-6 rounded-lg border border-border space-y-4 h-full">
                    <div className="flex justify-between items-center border-b border-border pb-2">
                        <h3 className="text-lg font-semibold text-primary">3. Objeciones Principales</h3>
                        <button type="button" onClick={() => appendObjection({ objection: '', count: 1 })} className="flex items-center gap-1 text-xs bg-secondary hover:bg-secondary/80 text-secondary-foreground px-3 py-1.5 rounded transition-colors">
                            <Plus className="w-3.5 h-3.5" /> Agregar
                        </button>
                    </div>

                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                        {objectionFields.map((field, index) => (
                            <div key={field.id} className="flex flex-col gap-2 bg-muted/20 p-3 rounded border border-border/50">
                                <div className="flex gap-2">
                                    <select
                                        {...register(`objections.${index}.objection`)}
                                        className="flex-1 bg-background border border-input rounded p-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
                                    >
                                        <option value="" disabled>Selecciona objeción...</option>
                                        {PREDEFINED_OBJECTIONS.map(obj => (
                                            <option key={obj} value={obj}>{obj}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="number"
                                        {...register(`objections.${index}.count`, { valueAsNumber: true })}
                                        className="w-16 bg-background border border-input rounded p-2 text-center text-sm"
                                    />
                                    <button type="button" onClick={() => removeObjection(index)} className="text-muted-foreground hover:text-destructive p-2">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                                {watchedObjections?.[index]?.objection === "Otro motivo" && (
                                    <input
                                        {...register(`objections.${index}.custom_reason`)}
                                        placeholder="Detalle el motivo..."
                                        className="w-full bg-background border border-input rounded p-2 text-sm"
                                    />
                                )}
                            </div>
                        ))}
                        {objectionFields.length === 0 && <p className="text-muted-foreground text-sm italic text-center py-8">Sin objeciones.</p>}
                    </div>
                </div>

                {/* 4. Casos Especiales */}
                <div className="bg-card p-6 rounded-lg border border-border space-y-4 h-full">
                    <div className="flex justify-between items-center border-b border-border pb-2">
                        <h3 className="text-lg font-semibold text-primary">4. Casos Especiales</h3>
                        <button type="button" onClick={() => appendSpecialCase({ description: '' })} className="flex items-center gap-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded transition-colors">
                            <Plus className="w-3.5 h-3.5" /> Agregar Caso
                        </button>
                    </div>

                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                        {specialCaseFields.map((field, index) => (
                            <div key={field.id} className="bg-indigo-500/5 p-3 rounded border border-indigo-500/10 space-y-2">
                                <div className="flex gap-2">
                                    <input
                                        {...register(`special_cases.${index}.description`)}
                                        placeholder="Descripción del caso..."
                                        className="flex-1 bg-background border border-input rounded p-2 text-sm"
                                    />
                                    <button type="button" onClick={() => removeSpecialCase(index)} className="text-muted-foreground hover:text-destructive p-2">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                                <input
                                    {...register(`special_cases.${index}.account_number`)}
                                    placeholder="Nro. Cuenta / Teléfono (Opcional)"
                                    className="w-full bg-background border border-input rounded p-2 text-xs font-mono text-muted-foreground"
                                />
                            </div>
                        ))}
                        {specialCaseFields.length === 0 && <p className="text-muted-foreground text-sm italic text-center py-8">Sin casos especiales.</p>}
                    </div>
                </div>
            </div>

            {/* 5. Observaciones */}
            <div className="bg-card p-6 rounded-lg border border-border space-y-4">
                <h3 className="text-lg font-semibold border-b border-border pb-2 text-primary">5. Observaciones</h3>
                <textarea
                    {...register('observations')}
                    rows={4}
                    className="w-full bg-background border border-input rounded p-3 resize-none focus:ring-2 focus:ring-ring focus:outline-none"
                    placeholder="Comentarios adicionales, aprendizajes del día..."
                />
            </div>

            <div className="sticky bottom-0 bg-background/80 backdrop-blur-md p-4 border-t border-border -mx-4 md:-mx-8 -mb-8 flex justify-between items-center z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                <div className="flex items-center gap-2 text-sm text-yellow-500 bg-yellow-500/10 px-3 py-1 rounded hidden sm:flex">
                    <AlertCircle className="w-4 h-4" />
                    <span>Revisa tus ceros antes de guardar</span>
                </div>
                <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3 rounded-lg font-bold text-lg hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/25 disabled:opacity-50"
                >
                    <Save className="w-5 h-5" />
                    {saving ? 'Guardando...' : 'Guardar Reporte'}
                </button>
            </div>

        </form>
    );
}

function InputGroup({ label, register, step }: { label: string, register: any, step?: string }) {
    return (
        <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-muted-foreground truncate" title={label}>{label}</label>
            <input
                type="number"
                step={step || "1"}
                {...register}
                onFocus={(e) => e.target.select()} // Auto-select all on focus for easier editing
                className="w-full bg-background border border-input rounded p-2 focus:ring-2 focus:ring-ring focus:outline-none font-mono text-lg transition-colors hover:border-primary/50"
            />
        </div>
    );
}

function TableInput({ register, highlight }: { register: any, highlight?: 'green' | 'red' | 'yellow' }) {
    return (
        <input
            type="number"
            {...register}
            onFocus={(e) => e.target.select()}
            className={`w-full bg-transparent border border-transparent hover:border-border focus:border-input rounded p-1 text-center font-mono focus:outline-none focus:ring-1 focus:ring-ring transition-all ${highlight === 'green' ? 'bg-green-500/5 text-green-600 font-bold' :
                    highlight === 'red' ? 'bg-red-500/5 text-red-600' :
                        highlight === 'yellow' ? 'bg-yellow-500/5 text-yellow-600' : ''
                }`}
        />
    )
}
