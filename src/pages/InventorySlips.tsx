import { useState, useEffect } from 'react';
import {
    FileText,
    Sunrise,
    Sunset,
    Users,
    ChevronRight,
    Loader2,
    CheckCircle2,
    Package,
    History,
    Download,
    Mail,
    AlertTriangle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SignaturePad } from '../components/ui/SignaturePad';
import { canManageInventory } from '../lib/permissions';
import clsx from 'clsx';

export default function InventorySlips() {
    const [step, setStep] = useState<'mode-select' | 'tech-select' | 'review' | 'signature' | 'success' | 'history'>('mode-select');
    const [mode, setMode] = useState<'morning' | 'evening'>('morning');
    const [technicians, setTechnicians] = useState<any[]>([]);
    const [selectedTech, setSelectedTech] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [openTicketsWithMaterial, setOpenTicketsWithMaterial] = useState<any[]>([]); // Tickets que tienen material pero no están cerrados

    const [itemsToProcess, setItemsToProcess] = useState<any[]>([]); // Items to deliver or settle
    const [techStock, setTechStock] = useState<any[]>([]); // Items currently assigned to tech
    const [realCounts, setRealCounts] = useState<Record<string, number>>({}); // Supervisor physical count
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [userPermissions, setUserPermissions] = useState<any>({});

    const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
    const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
    const [notes, setNotes] = useState('');
    const [history, setHistory] = useState<any[]>([]);

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                setCurrentUser(profile);
                setUserPermissions(profile?.permissions || {});
            }
        };
        fetchUser();
    }, []);

    useEffect(() => {
        if (step === 'tech-select') {
            loadTechnicians();
        } else if (step === 'history') {
            loadHistory();
        }
    }, [step]);

    const loadHistory = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('inventory_delivery_slips')
            .select('*, profiles!inventory_delivery_slips_technician_id_fkey(full_name)')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            console.error('Error loading history:', error);
        }

        if (data) {
            console.log('History data loaded:', data);
            setHistory(data);
        }
        setLoading(false);
    };

    const loadTechnicians = async () => {
        setLoading(true);
        const { data } = await supabase.from('profiles').select('id, full_name').eq('is_field_tech', true).order('full_name');
        if (data) setTechnicians(data);
        setLoading(false);
    };

    const handleTechSelect = async (tech: any) => {
        setSelectedTech(tech);
        setLoading(true);

        if (mode === 'morning') {
            const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local

            // 1. Fetch Today's Morning Slips to filter out already signed items
            const { data: todaysMorningSlips } = await supabase
                .from('inventory_delivery_slips')
                .select('items_snapshot')
                .eq('technician_id', tech.id)
                .eq('slip_type', 'morning_delivery')
                .gte('created_at', today);

            const alreadyInSlipQty = new Map<string, number>();
            if (todaysMorningSlips) {
                todaysMorningSlips.forEach(slip => {
                    if (Array.isArray(slip.items_snapshot)) {
                        slip.items_snapshot.forEach((item: any) => {
                            if (item.id) {
                                const currentQty = alreadyInSlipQty.get(item.id) || 0;
                                alreadyInSlipQty.set(item.id, currentQty + (item.quantity || 1));
                            }
                        });
                    }
                });
            }

            // 2. Fetch current stock assigned to tech
            const { data: assets } = await supabase
                .from('inventory_assets')
                .select('*, inventory_items(name, is_serialized)')
                .eq('current_holder_id', tech.id)
                .eq('status', 'assigned');

            // 3. Filter or adjust quantities for items already processed today
            const pendingAssets = (assets || []).map(asset => {
                const signedQty = alreadyInSlipQty.get(asset.id) || 0;
                const assetQty = asset.quantity || 1;
                
                if (signedQty > 0) {
                    if (assetQty > signedQty) {
                        // Return only the difference (new additions)
                        return { ...asset, quantity: assetQty - signedQty };
                    } else {
                        // Fully signed already
                        return null; 
                    }
                }
                return asset;
            }).filter(Boolean);

            setItemsToProcess(pendingAssets);
        } else {
            // [FIX] Usar fecha local del cliente, no UTC.
            const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local

            // 1. Fetch Today's Consumption
            const { data: installations } = await supabase
                .from('inventory_movements')
                .select('*, inventory_assets!inventory_movements_asset_id_fkey(*, inventory_items(name, is_serialized))')
                .eq('origin_holder_id', tech.id)
                .in('movement_type', ['installation', 'CONSUMO'])
                .gte('created_at', today);

            // 1.5 Fetch TODAY'S SETTLEMENTS to filter out already settled items (Client-side filtering)
            // Needed because we cannot alter schema on self-hosted instances easily from here.
            const { data: todaysSlips } = await supabase
                .from('inventory_delivery_slips')
                .select('items_snapshot')
                .eq('technician_id', tech.id)
                .eq('slip_type', 'evening_settlement')
                .gte('created_at', today);

            const settledIds = new Set<string>();
            if (todaysSlips) {
                todaysSlips.forEach(slip => {
                    if (Array.isArray(slip.items_snapshot)) {
                        slip.items_snapshot.forEach((item: any) => {
                            if (item.id) settledIds.add(item.id);
                        });
                    }
                });
            }

            const filteredInstallations = (installations || []).filter(inst => !settledIds.has(inst.asset_id));
            setItemsToProcess(filteredInstallations);

            // 1.6 DETECCIÓN DE TICKETS FANTASMA (Abiertos con Material)
            // Buscamos tickets en WispHub vinculados a este técnico que no estén cerrados (status 4)
            const { data: activeWorkItems } = await supabase
                .from('workflow_workitems')
                .select('*, workflow_activities(process_id, workflow_processes(reference_id, metadata))')
                .eq('participant_id', tech.id)
                .eq('status', 'PE');

            const ghostCandidates = [];
            if (activeWorkItems) {
                for (const wi of activeWorkItems) {
                    const ticketId = wi.workflow_activities?.workflow_processes?.reference_id;
                    if (ticketId) {
                        // Vemos si este ticket tiene algún movimiento de CONSUMO hoy
                        const hasMaterial = filteredInstallations.some(inst => 
                            inst.notes?.includes(`#${ticketId}`) || 
                            inst.notes?.includes(ticketId)
                        );
                        if (hasMaterial) {
                            ghostCandidates.push({
                                id: ticketId,
                                client: wi.workflow_activities?.workflow_processes?.metadata?.nombre_cliente || 'Cliente Desconocido',
                                items: filteredInstallations.filter(inst => inst.notes?.includes(ticketId))
                            });
                        }
                    }
                }
            }
            setOpenTicketsWithMaterial(ghostCandidates);

            // 2. Fetch Current Remaining Stock (to show the "Cruce")
            const { data: currentStock } = await supabase
                .from('inventory_assets')
                .select('*, inventory_items(name, is_serialized)')
                .eq('current_holder_id', tech.id)
                .eq('status', 'assigned');

            setItemsToProcess(filteredInstallations);
            // @ts-ignore - we'll use this in the UI logic
            setTechStock(currentStock || []);
        }

        setLoading(false);
        setStep('review');
    };

    const handleSaveSlip = async (signatureData: string) => {
        setLoading(true);
        try {
            // 1. Save to DB first
            const { data: slipData, error } = await supabase.from('inventory_delivery_slips').insert({
                technician_id: selectedTech.id,
                slip_type: mode === 'morning' ? 'morning_delivery' : 'evening_settlement',
                signature_data: signatureData,
                items_snapshot: itemsToProcess.map(i => ({
                    id: i.id,
                    serial: i.serial_number || i.inventory_assets?.serial_number,
                    name: i.inventory_items?.name || i.inventory_assets?.inventory_items?.name,
                    status: i.status || 'consumed',
                    quantity: i.quantity // Snapshot the quantity at time of signing
                })),
                notes: mode === 'morning' ? 'Entrega de material y equipos' : 'Liquidación diaria de instalaciones'
            }).select().single();

            if (error) throw error;

            // 2. Generate PDF
            const { generateDeliverySlipPDF } = await import('../lib/pdfGenerator');

            // --- Pre-process items for PDF if it's evening to show the "Cruce" ---
            let pdfItems = [];
            if (mode === 'evening') {
                const aggregates = techStock.reduce((acc, s) => {
                    const id = s.item_id;
                    if (!acc[id]) acc[id] = { name: s.inventory_items?.name || '?', stock: 0, consumed: 0, serial: s.serial_number || '---' };
                    acc[id].stock += s.quantity || 1;
                    return acc;
                }, {} as Record<string, any>);

                itemsToProcess.forEach(c => {
                    const id = c.inventory_assets?.item_id || c.item_id;
                    if (!aggregates[id]) {
                        aggregates[id] = {
                            name: (c.inventory_items?.name || c.inventory_assets?.inventory_items?.name || '?'),
                            stock: 0,
                            consumed: 0,
                            serial: c.serial_number || c.inventory_assets?.serial_number || '---'
                        };
                    }
                    aggregates[id].consumed += c.quantity || 1;
                });

                pdfItems = Object.entries(aggregates).map(([itemId, row]: [string, any]) => {
                    const expected = row.stock;
                    const realValue = realCounts[itemId] ?? expected;
                    return {
                        name: row.name,
                        serial: row.serial,
                        quantity: row.consumed,
                        initial: row.stock + row.consumed,
                        consumed: row.consumed,
                        physical: realValue, // Use audited count
                        status: 'installed'
                    };
                });
            } else {
                pdfItems = itemsToProcess.map(i => ({
                    name: i.inventory_items?.name || i.inventory_assets?.inventory_items?.name || 'Item',
                    serial: i.serial_number || i.inventory_assets?.serial_number,
                    quantity: i.quantity || 1,
                    status: i.status
                }));
            }

            const pdf = await generateDeliverySlipPDF({
                id: slipData.id,
                type: mode === 'morning' ? 'morning' : 'evening',
                technicianName: selectedTech.full_name,
                technicianId: selectedTech.id,
                date: new Date(),
                items: pdfItems,
                signatureData,
                notes: notes || (mode === 'morning' ? 'Entrega de materiales y equipos' : 'Liquidación diaria de instalaciones')
            });

            setPdfBlob(pdf);

            // 3. TRANSACTIONAL SETTLEMENT: Return remaining stock to Warehouse
            if (mode === 'evening') {
                // Group assets by itemId to handle discrepancies efficiently
                const groupedStock = techStock.reduce((acc: Record<string, any[]>, s: any) => {
                    const id = s.item_id;
                    if (!acc[id]) acc[id] = [];
                    acc[id].push(s);
                    return acc;
                }, {} as Record<string, any[]>);

                for (const itemId in groupedStock) {
                    const assets = groupedStock[itemId];
                    const expectedQty = assets.reduce((sum: number, a: any) => sum + (a.quantity || 1), 0);
                    const realCount = realCounts[itemId] ?? expectedQty;

                    // How many units are actually returning?
                    let returningQty = Math.min(realCount, expectedQty);
                    let missingQty = Math.max(0, expectedQty - realCount);

                    for (const asset of assets) {
                        if (returningQty <= 0 && missingQty <= 0) break;

                        const assetQty = asset.quantity || 1;

                        if (returningQty >= assetQty) {
                            // Full Return of this asset
                            await supabase.from('inventory_assets').update({
                                status: 'warehouse',
                                current_holder_id: null,
                            }).eq('id', asset.id);

                            await supabase.from('inventory_movements').insert({
                                asset_id: asset.id,
                                movement_type: 'return',
                                origin_holder_id: selectedTech.id,
                                notes: `Liquidación: Retorno físico completo.`,
                                quantity: assetQty,
                                created_by: currentUser?.id
                            });
                            returningQty -= assetQty;
                        } else if (returningQty > 0) {
                            // Partial Return (only for consumables)
                            await supabase.from('inventory_assets').update({
                                status: 'warehouse',
                                current_holder_id: null,
                            }).eq('id', asset.id);

                            await supabase.from('inventory_movements').insert({
                                asset_id: asset.id,
                                movement_type: 'return',
                                origin_holder_id: selectedTech.id,
                                notes: `Liquidación: Retorno parcial (${returningQty}/${assetQty}).`,
                                quantity: returningQty,
                                created_by: currentUser?.id
                            });
                            returningQty = 0;
                        } else if (missingQty > 0) {
                            // Missing / Loss
                            await supabase.from('inventory_assets').update({
                                status: 'warehouse',
                                current_holder_id: null,
                            }).eq('id', asset.id);

                            await supabase.from('inventory_movements').insert({
                                asset_id: asset.id,
                                movement_type: 'adjustment',
                                origin_holder_id: selectedTech.id,
                                notes: `FALTANTE EN LIQUIDACIÓN: Técnico reportó menos físico del esperado.`,
                                quantity: Math.min(missingQty, assetQty),
                                created_by: currentUser?.id
                            });
                            missingQty -= assetQty;
                        }
                    }
                }

                // 4. (SKIPPED) MARK CONSUMED MOVEMENTS AS SETTLED
                // We are using client-side filtering based on existing slips, so no DB update needed here.
                /* 
                const movementIds = itemsToProcess.map(m => m.id).filter(Boolean);
                if (movementIds.length > 0) {
                     // ... DB update skipped ...
                }
                */
            }

            // 5. Upload PDF to Storage
            const fileName = `acta_${slipData.id}_${Date.now()}.pdf`;
            const { error: uploadError } = await supabase.storage
                .from('delivery-acts')
                .upload(fileName, pdf, {
                    contentType: 'application/pdf',
                    upsert: true
                });

            if (uploadError) {
                console.error('Error uploading PDF:', uploadError);
            } else {
                const { data: { publicUrl } } = supabase.storage
                    .from('delivery-acts')
                    .getPublicUrl(fileName);
                setGeneratedPdfUrl(publicUrl);
            }

            setStep('success');
        } catch (err) {
            console.error(err);
            alert('Error al guardar el acta. Detalles en consola.');
        } finally {
            setLoading(false);
        }
    };

    const resetFlow = () => {
        setStep('mode-select');
        setSelectedTech(null);
        setItemsToProcess([]);
        setGeneratedPdfUrl(null);
        setPdfBlob(null);
        setNotes('');
    };

    const handleEditQuantity = async (item: any) => {
        const currentQty = item.quantity || 1;
        const newQtyStr = prompt(`Cantidad actual: ${currentQty}\nIngrese la cantidad REAL a entregar (el resto se devolverá a bodega):`, String(currentQty));

        if (newQtyStr === null) return;
        const newQty = parseInt(newQtyStr);

        if (isNaN(newQty) || newQty <= 0) {
            alert('Cantidad inválida.');
            return;
        }

        if (newQty >= currentQty) {
            if (newQty > currentQty) alert('No puedes aumentar la cantidad asignada aquí. Usa "Agregar Stock".');
            return;
        }

        const returnQty = currentQty - newQty;
        if (!confirm(`Se actualizará la entrega a ${newQty} y se devolverán ${returnQty} a bodega. ¿Confirmar?`)) return;

        setLoading(true);
        try {
            // 1. Update Asset (Assigned) to New Quantity
            const { error: updateError } = await supabase
                .from('inventory_assets')
                .update({ quantity: newQty })
                .eq('id', item.id);

            if (updateError) throw updateError;

            // --- CONSOLIDATED PARTIAL RETURN (SINGLE-ROW POLICY) ---
            const { data: existingWH } = await supabase
                .from('inventory_assets')
                .select('*')
                .eq('item_id', item.item_id)
                .eq('status', 'warehouse')
                .limit(1);

            const whAsset = existingWH?.[0];

            if (whAsset) {
                // Merge into existing row
                await supabase
                    .from('inventory_assets')
                    .update({ quantity: (whAsset.quantity || 0) + returnQty })
                    .eq('id', whAsset.id);

                await supabase.from('inventory_movements').insert({
                    asset_id: whAsset.id,
                    movement_type: 'return',
                    origin_holder_id: selectedTech.id,
                    quantity: returnQty,
                    notes: `Ajuste parcial en acta - Consolidado en Bodega`,
                    created_by: (await supabase.auth.getUser()).data.user?.id
                });
            } else {
                // Create new single warehouse row
                const { data: newAsset } = await supabase
                    .from('inventory_assets')
                    .insert({
                        item_id: item.item_id,
                        serial_number: `BOD-${Date.now()}`,
                        status: 'warehouse',
                        quantity: returnQty,
                        current_location: 'BODEGA CENTRAL'
                    })
                    .select()
                    .single();

                if (newAsset) {
                    await supabase.from('inventory_movements').insert({
                        asset_id: newAsset.id,
                        movement_type: 'return',
                        origin_holder_id: selectedTech.id,
                        quantity: returnQty,
                        notes: `Ajuste parcial en acta - Nueva entrada bodega`,
                        created_by: (await supabase.auth.getUser()).data.user?.id
                    });
                }
            }

            // 4. Update Local State
            setItemsToProcess(prev => prev.map(i =>
                i.id === item.id ? { ...i, quantity: newQty } : i
            ));

        } catch (err) {
            console.error('Error splitting quantity:', err);
            alert('Error al ajustar cantidad. Intente nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveItem = async (item: any) => {
        if (!confirm(`¿Estás seguro de devolver este ítem a Bodega?\n\n${item.inventory_items?.name || 'Item'} - ${item.serial_number}`)) {
            return;
        }

        setLoading(true);
        try {
            // --- CONSOLIDATED FULL REMOVAL (SINGLE-ROW POLICY) ---
            if (!item.inventory_items?.is_serialized) {
                const { data: existingWH } = await supabase
                    .from('inventory_assets')
                    .select('*')
                    .eq('item_id', item.item_id)
                    .eq('status', 'warehouse')
                    .limit(1);

                const whAsset = existingWH?.[0];

                if (whAsset) {
                    await supabase
                        .from('inventory_assets')
                        .update({ quantity: (whAsset.quantity || 0) + (item.quantity || 1) })
                        .eq('id', whAsset.id);

                    await supabase.from('inventory_movements').insert({
                        asset_id: whAsset.id,
                        movement_type: 'return',
                        origin_holder_id: selectedTech.id,
                        quantity: item.quantity || 1,
                        notes: `Devolución consolidada (Corrección de Acta)`,
                        created_by: (await supabase.auth.getUser()).data.user?.id
                    });
                } else {
                    const { data: newWH } = await supabase
                        .from('inventory_assets')
                        .insert({
                            item_id: item.item_id,
                            serial_number: `BOD-${Date.now()}`,
                            status: 'warehouse',
                            quantity: item.quantity || 1,
                            current_location: 'BODEGA CENTRAL'
                        })
                        .select()
                        .single();

                    if (newWH) {
                        await supabase.from('inventory_movements').insert({
                            asset_id: newWH.id,
                            movement_type: 'return',
                            origin_holder_id: selectedTech.id,
                            quantity: item.quantity || 1,
                            notes: `Devolución inicial (Corrección de Acta)`,
                            created_by: (await supabase.auth.getUser()).data.user?.id
                        });
                    }
                }

                // Delete the assigned fragmented row
                await supabase.from('inventory_assets').delete().eq('id', item.id);
            } else {
                // Standard Serialized Return
                const { error: updateError } = await supabase
                    .from('inventory_assets')
                    .update({
                        status: 'warehouse',
                        current_holder_id: null,
                        last_movement_id: null
                    })
                    .eq('id', item.id);

                if (updateError) throw updateError;

                const { error: moveError } = await supabase
                    .from('inventory_movements')
                    .insert({
                        asset_id: item.id,
                        movement_type: 'return',
                        origin_holder_id: selectedTech.id,
                        notes: 'Corrección manual durante creación de Acta Digital',
                        created_by: (await supabase.auth.getUser()).data.user?.id,
                        quantity: 1
                    });

                if (moveError) throw moveError;
            }

            // 3. Update Local State
            setItemsToProcess(prev => prev.filter(i => i.id !== item.id));

        } catch (err) {
            console.error('Error removing item:', err);
            alert('Error al devolver el ítem. Intente nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPdf = () => {
        if (pdfBlob) {
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Soporte_Acta_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    const handleSendEmail = () => {
        if (!generatedPdfUrl) {
            alert('El PDF aún no se ha subido o no hay URL disponible.');
            return;
        }

        const subject = encodeURIComponent(`Acta Digital - ${mode === 'morning' ? 'Entrega' : 'Liquidación'} - ${selectedTech?.full_name}`);
        const body = encodeURIComponent(`Hola,\n\nSe adjunta el enlace para descargar el acta digital generada el ${new Date().toLocaleString()}.\n\nVer Documento: ${generatedPdfUrl}\n\nAtentamente,\nRapiLink SAS`);

        window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
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

                    <button
                        onClick={() => setStep('history')}
                        className="col-span-1 md:col-span-2 flex items-center justify-center gap-3 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-xs font-bold uppercase hover:bg-slate-50 hover:border-slate-300 transition-all mt-4"
                    >
                        <History size={18} />
                        Ver Historial de Actas
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

                            {/* ALERTA DE TICKETS ABIERTOS (ANTI-FANTASMA) */}
                            {mode === 'evening' && openTicketsWithMaterial.length > 0 && (
                                <div className="mt-4 p-4 bg-orange-50 border-2 border-orange-200 rounded-3xl animate-pulse">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle className="text-orange-600 w-5 h-5 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-orange-800 tracking-tight">Atención: Material en Vivienda Detectado</p>
                                            <p className="text-[10px] text-orange-700 font-bold leading-tight mt-1">
                                                Hay {openTicketsWithMaterial.length} ticket(s) con material instalado que siguen abiertos. 
                                                Al liquidar, estos quedarán como "Reserva en Vivienda" para mañana.
                                            </p>
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                {openTicketsWithMaterial.map(tk => (
                                                    <span key={tk.id} className="text-[8px] bg-white/50 px-2 py-0.5 rounded border border-orange-200 font-black text-orange-700">
                                                        TK-{tk.id}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
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
                                    <div key={idx} className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl border border-border group/item hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-white rounded-xl border border-border shadow-sm">
                                                <Package size={20} className="text-muted-foreground" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-black uppercase text-foreground">
                                                    {item.inventory_items?.name || item.inventory_assets?.inventory_items?.name || 'Item'}
                                                </p>
                                                {/* Only show SN if item is serialized (e.g. ONU, Router) - Hide for consumables */}
                                                {(item.inventory_items?.is_serialized || item.inventory_assets?.inventory_items?.is_serialized) && (
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                                            SN: {item.serial_number || item.inventory_assets?.serial_number || '---'}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {/* Quantity Display - Redesigned */}
                                            {(item.quantity > 1 || !item.inventory_items?.is_serialized) && (
                                                <div className="flex flex-col items-center justify-center bg-blue-50/50 border-2 border-blue-100/80 px-3 py-1 rounded-xl min-w-[3.5rem]">
                                                    <span className="text-[9px] uppercase font-black text-blue-400 tracking-tight">Cant</span>
                                                    <span className="text-xl font-black text-blue-600 leading-none -mt-0.5">{item.quantity}</span>
                                                </div>
                                            )}

                                            {mode === 'evening' && (
                                                <span className="hidden sm:inline-flex px-3 py-1.5 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase rounded-lg border border-emerald-100 shadow-sm">
                                                    Instalado
                                                </span>
                                            )}

                                            {/* Actions for Morning Delivery */}
                                            {mode === 'morning' && (
                                                <>
                                                    {/* Full Return - Only for authorized roles */}
                                                    {canManageInventory({ role: currentUser?.user_metadata?.role, permissions: userPermissions } as any) && (
                                                        <>
                                                            {/* Edit Quantity (Partial Return) */}
                                                            {(!item.inventory_items?.is_serialized || item.quantity > 1) && (
                                                                <button
                                                                    onClick={() => handleEditQuantity(item)}
                                                                    title="Editar Cantidad"
                                                                    className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-blue-500 hover:border-blue-200 hover:bg-blue-50 transition-all opacity-0 group-hover/item:opacity-100"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                                                </button>
                                                            )}

                                                            <button
                                                                onClick={() => handleRemoveItem(item)}
                                                                title="Devolver a Bodega"
                                                                className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all opacity-0 group-hover/item:opacity-100"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
                                                            </button>
                                                        </>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Inventory Reconciliation (Evening Only) */}
                        {mode === 'evening' && techStock.length > 0 && (
                            <div className="mt-8 pt-6 border-t border-border animate-in fade-in slide-in-from-bottom-2">
                                <h4 className="text-sm font-black uppercase text-foreground mb-4 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                                    Cruce de Inventario
                                </h4>
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                    <table className="w-full text-left text-[11px] border-collapse">
                                        <thead>
                                            <tr className="bg-slate-100/80 border-b border-slate-200 transition-colors">
                                                <th className="px-4 py-2 font-black uppercase text-slate-500">Material</th>
                                                <th className="px-4 py-2 font-black uppercase text-slate-500 text-center">Inicial</th>
                                                <th className="px-4 py-2 font-black uppercase text-slate-500 text-center">Gasto</th>
                                                <th className="px-4 py-2 font-black uppercase text-slate-500 text-center">Esperado</th>
                                                <th className="px-4 py-2 font-black uppercase text-slate-500 text-center w-24">Conteo Real</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {(() => {
                                                const aggregates = techStock.reduce((acc, s) => {
                                                    const id = s.item_id;
                                                    if (!acc[id]) acc[id] = { name: s.inventory_items?.name || '?', stock: 0, consumed: 0 };
                                                    acc[id].stock += s.quantity || 1;
                                                    return acc;
                                                }, {} as Record<string, any>);

                                                itemsToProcess.forEach(c => {
                                                    const id = c.inventory_assets?.item_id || c.item_id;
                                                    if (!aggregates[id]) {
                                                        aggregates[id] = {
                                                            name: (c.inventory_items?.name || c.inventory_assets?.inventory_items?.name || '?'),
                                                            stock: 0,
                                                            consumed: 0
                                                        };
                                                    }
                                                    aggregates[id].consumed += c.quantity || 1;
                                                });

                                                return Object.entries(aggregates).map(([itemId, row]: [string, any], i) => {
                                                    const expected = row.stock;
                                                    const realValue = realCounts[itemId] ?? expected;

                                                    return (
                                                        <tr key={i} className="hover:bg-white/50 transition-colors">
                                                            <td className="px-4 py-2.5 font-bold text-slate-700 uppercase">{row.name}</td>
                                                            <td className="px-4 py-2.5 text-center font-bold text-slate-400">{(row.stock + row.consumed)}</td>
                                                            <td className="px-4 py-2.5 text-center font-bold text-blue-500">-{row.consumed}</td>
                                                            <td className="px-4 py-2.5 text-center">
                                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-black">
                                                                    {expected}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-2.5 text-center">
                                                                <div className="relative group/input">
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        value={realValue}
                                                                        onChange={(e) => setRealCounts(prev => ({ ...prev, [itemId]: parseInt(e.target.value) || 0 }))}
                                                                        className={clsx(
                                                                            "w-16 h-8 text-center bg-white border-2 rounded-lg font-black transition-all outline-none",
                                                                            realValue !== expected ? "border-orange-500 text-orange-600 ring-4 ring-orange-500/10" : "border-slate-200 focus:border-blue-500 text-slate-900"
                                                                        )}
                                                                    />
                                                                    {realValue < expected && (
                                                                        <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center bg-orange-500 text-white text-[8px] font-black rounded-full animate-bounce">
                                                                            !
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                });
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-3 italic text-center px-4">
                                    * El balance muestra lo que el técnico debe tener en su maletín al finalizar el día.
                                </p>
                            </div>
                        )}

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

                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase text-muted-foreground ml-1">Observaciones (Opcional)</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder={mode === 'morning' ? 'Entrega de materiales y equipos' : 'Liquidación diaria de instalaciones'}
                            className="w-full p-4 bg-muted/50 border border-border rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none h-24"
                        />
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
                        <p className="text-muted-foreground font-medium mt-2">El documento ha sido firmado, registrado y generado correctamente.</p>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4 px-4">
                        <button
                            onClick={handleDownloadPdf}
                            className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
                            Descargar PDF
                        </button>

                        <button
                            onClick={handleSendEmail}
                            disabled={!generatedPdfUrl}
                            className="px-6 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                            Enviar Correo
                        </button>
                    </div>

                    <div className="flex justify-center gap-4 pt-8 border-t border-slate-100 mt-8">
                        <button
                            onClick={resetFlow}
                            className="px-8 py-3 text-white bg-slate-800 rounded-xl text-xs font-bold uppercase hover:bg-slate-900 transition-all shadow-lg"
                        >
                            Volver a Inicio de Actas
                        </button>

                    </div>
                </div>
            )}
            {/* Step: History */}
            {step === 'history' && (
                <div className="space-y-6 animate-in slide-in-from-right-4">
                    <div className="flex items-center justify-between">
                        <button onClick={() => setStep('mode-select')} className="text-xs font-black uppercase text-muted-foreground hover:text-primary">← Volver</button>
                        <h2 className="text-xl font-black uppercase">Historial de Actas</h2>
                    </div>

                    <div className="bg-white border text-left border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        {loading ? (
                            <div className="p-12 flex justify-center">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            </div>
                        ) : history.length === 0 ? (
                            <div className="p-12 text-center text-muted-foreground">
                                <p className="text-sm font-medium">No hay actas registradas.</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 border-b border-slate-100 text-xs uppercase font-black text-slate-500">
                                    <tr>
                                        <th className="px-6 py-4">Fecha</th>
                                        <th className="px-6 py-4">Técnico</th>
                                        <th className="px-6 py-4">Tipo</th>
                                        <th className="px-6 py-4 text-center">Ítems</th>
                                        <th className="px-6 py-4 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {history.map((slip) => (
                                        <tr key={slip.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-slate-700">
                                                {new Date(slip.created_at).toLocaleDateString()}
                                                <span className="block text-[10px] text-slate-400 font-normal">
                                                    {new Date(slip.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-700 uppercase table-cell">
                                                {slip.profiles?.full_name || '---'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase border ${slip.slip_type === 'morning_delivery'
                                                    ? 'bg-sky-50 text-sky-600 border-sky-100'
                                                    : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                                                    }`}>
                                                    {slip.slip_type === 'morning_delivery' ? 'Entrega' : 'Liquidación'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center text-slate-600 font-medium">
                                                {slip.items_snapshot?.length || 0}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={async () => {
                                                            const { data: files } = await supabase.storage.from('delivery-acts').list('', { search: `acta_${slip.id}` });
                                                            if (files && files.length > 0) {
                                                                const { data: { publicUrl } } = supabase.storage.from('delivery-acts').getPublicUrl(files[0].name);

                                                                const subject = encodeURIComponent(`Acta Digital - ${slip.slip_type === 'morning_delivery' ? 'Entrega' : 'Liquidación'} - ${slip.profiles?.full_name}`);
                                                                const body = encodeURIComponent(`Hola,\n\nSe adjunta el enlace para el acta digital del ${new Date(slip.created_at).toLocaleDateString()}.\n\nVer Documento: ${publicUrl}\n\nAtentamente,\nRapiLink SAS`);

                                                                window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
                                                            } else {
                                                                alert('Archivo no encontrado.');
                                                            }
                                                        }}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 text-xs font-bold hover:text-sky-600 hover:border-sky-200 transition-colors"
                                                        title="Enviar por correo"
                                                    >
                                                        <Mail size={14} />
                                                        Email
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            // Strategy: List files in bucket matching the slip ID to find the PDF.
                                                            const { data: files } = await supabase.storage.from('delivery-acts').list('', { search: `acta_${slip.id}` });
                                                            if (files && files.length > 0) {
                                                                const { data: { publicUrl } } = supabase.storage.from('delivery-acts').getPublicUrl(files[0].name);
                                                                window.open(publicUrl, '_blank');
                                                            } else {
                                                                alert('Archivo no encontrado.');
                                                            }
                                                        }}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 text-xs font-bold hover:text-primary hover:border-primary transition-colors"
                                                    >
                                                        <Download size={14} />
                                                        PDF
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
