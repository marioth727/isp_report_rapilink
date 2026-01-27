import { useState, useEffect, useRef } from 'react';
import {
    FolderPlus,
    Search,
    Layers,
    Box,
    Edit,
    Trash2,
    Package,
    Plus,
    Loader2,
    Save,
    Image as ImageIcon,
    Upload
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { compressImage } from '../lib/imageUtils';
import { Modal } from '../components/ui/Modal';
import type { Database } from '../types/database';
import clsx from 'clsx';

type Category = Database['public']['Tables']['inventory_categories']['Row'];
type Item = Database['public']['Tables']['inventory_items']['Row'];

export default function InventoryCatalog() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [items, setItems] = useState<(Item & { category?: Category })[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'items' | 'categories'>('items');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal states
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [isCatModalOpen, setIsCatModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Item | null>(null);
    const [editingCat, setEditingCat] = useState<Category | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Form/Tab State inside Item Modal
    const [itemModalTab, setItemModalTab] = useState<'general' | 'technical' | 'financial'>('general');
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const initialFormData = {
        name: '',
        sku: '',
        category_id: '',
        min_stock_level: 5,
        brand: '',
        model_name: '',
        description_technical: '',
        unit_cost: 0,
        currency: 'COP',
        warranty_days: 365,
    };

    const [itemFormData, setItemFormData] = useState(initialFormData);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setItemFormData(prev => ({ ...prev, [name]: value }));
    };

    useEffect(() => {
        loadCatalogData();
    }, []);

    const loadCatalogData = async () => {
        setLoading(true);
        try {
            const { data: catData } = await supabase.from('inventory_categories').select('*').order('name');
            const { data: itemData } = await supabase.from('inventory_items').select('*, inventory_categories(*)').order('name');

            if (catData) setCategories(catData);
            if (itemData) {
                setItems(itemData.map(i => ({ ...i, category: (i as any).inventory_categories })));
            }
        } catch (error) {
            console.error('Error loading catalog:', error);
            showToast('Error al cargar datos', 'error');
        } finally {
            setLoading(false);
        }
    };

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        const event = new CustomEvent('app:toast', {
            detail: { message, type, duration: 4000 }
        });
        window.dispatchEvent(event);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingImage(true);
        try {
            const compressedBlob = await compressImage(file, 1200, 0.7);
            const reader = new FileReader();
            reader.onloadend = () => setPreviewImage(reader.result as string);
            reader.readAsDataURL(compressedBlob);

            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `products/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('inventory-images')
                .upload(filePath, compressedBlob, { contentType: 'image/jpeg' });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('inventory-images')
                .getPublicUrl(filePath);

            setPreviewImage(publicUrl);
        } catch (error: any) {
            console.error('Error uploading image:', error);
            showToast('Error al subir imagen', 'error');
        } finally {
            setUploadingImage(false);
        }
    };

    const handleSaveItem = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSaving(true);
        const payload: any = {
            ...itemFormData,
            min_stock_level: parseInt(String(itemFormData.min_stock_level)) || 0,
            unit_cost: parseFloat(String(itemFormData.unit_cost)) || 0,
            warranty_days: parseInt(String(itemFormData.warranty_days)) || 0,
            image_url: previewImage,
            category_id: itemFormData.category_id || null
        };

        try {
            if (editingItem) {
                const { error } = await supabase.from('inventory_items').update(payload).eq('id', editingItem.id);
                if (error) throw error;
                showToast('Producto actualizado', 'success');
            } else {
                const { error } = await supabase.from('inventory_items').insert(payload);
                if (error) throw error;
                showToast('Producto creado', 'success');
            }
            setIsItemModalOpen(false);
            loadCatalogData();
        } catch (err) {
            console.error(err);
            showToast('Error al guardar', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveCategory = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSaving(true);
        const formData = new FormData(e.currentTarget);
        const payload = {
            name: formData.get('name') as string,
            description: formData.get('description') as string,
            unit_type: formData.get('unit_type') as string,
        };

        try {
            if (editingCat) {
                const { error } = await supabase.from('inventory_categories').update(payload).eq('id', editingCat.id);
                if (error) throw error;
                showToast('Categoría actualizada', 'success');
            } else {
                const { error } = await supabase.from('inventory_categories').insert(payload);
                if (error) throw error;
                showToast('Categoría creada', 'success');
            }
            setIsCatModalOpen(false);
            loadCatalogData();
        } catch (err) {
            console.error(err);
            showToast('Error al guardar categoría', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteItem = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este producto?')) return;
        try {
            const { error } = await supabase.from('inventory_items').delete().eq('id', id);
            if (error) throw error;
            showToast('Producto eliminado', 'success');
            loadCatalogData();
        } catch (err) {
            showToast('No se puede eliminar: tiene activos vinculados', 'error');
        }
    };

    const openItemModal = (item: Item | null = null) => {
        setEditingItem(item);
        if (item) {
            setItemFormData({
                name: item.name || '',
                sku: item.sku || '',
                category_id: item.category_id || '',
                min_stock_level: item.min_stock_level || 5,
                brand: (item as any).brand || '',
                model_name: (item as any).model_name || '',
                description_technical: (item as any).description_technical || '',
                unit_cost: (item as any).unit_cost || 0,
                currency: (item as any).currency || 'COP',
                warranty_days: (item as any).warranty_days || 365,
            });
            setPreviewImage((item as any).image_url || null);
        } else {
            setItemFormData(initialFormData);
            setPreviewImage(null);
        }
        setItemModalTab('general');
        setIsItemModalOpen(true);
    };

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-foreground uppercase">Catálogo Maestro</h1>
                    <p className="text-muted-foreground font-medium">Define productos y categorías.</p>
                </div>
                <div className="flex items-center gap-3">
                    {activeTab === 'categories' ? (
                        <button
                            onClick={() => { setEditingCat(null); setIsCatModalOpen(true); }}
                            className="flex items-center gap-2 px-6 py-2.5 bg-card border-2 border-primary/20 text-primary rounded-xl text-sm font-black uppercase tracking-wider hover:bg-primary/5 transition-all shadow-sm"
                        >
                            <FolderPlus className="w-5 h-5" /> Nueva Categoría
                        </button>
                    ) : (
                        <button
                            onClick={() => openItemModal(null)}
                            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-black uppercase tracking-wider shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all"
                        >
                            <Plus className="w-5 h-5" /> Nuevo Producto
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card/10 backdrop-blur-md p-2 rounded-[2rem] border border-border">
                <div className="flex p-1 bg-muted/50 rounded-2xl gap-1">
                    <button
                        onClick={() => setActiveTab('items')}
                        className={clsx(
                            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all",
                            activeTab === 'items' ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Box className="w-4 h-4" /> Productos
                    </button>
                    <button
                        onClick={() => setActiveTab('categories')}
                        className={clsx(
                            "flex-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all",
                            activeTab === 'categories' ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Layers className="w-4 h-4" /> Categorías
                    </button>
                </div>

                <div className="relative flex-1 max-w-md px-2">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Buscar..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-muted/30 border border-border rounded-2xl py-3 pl-12 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                </div>
            </div>

            {activeTab === 'items' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredItems.map((item) => (
                        <div key={item.id} className="bg-card/50 backdrop-blur-sm border-2 border-border p-6 rounded-[2rem] hover:border-primary/30 transition-all group overflow-hidden relative">
                            <div className="flex justify-between items-start mb-4 relative z-10">
                                <div className="p-3 bg-primary/5 rounded-2xl text-primary">
                                    {item.image_url ? (
                                        <img src={item.image_url} alt="" className="w-7 h-7 object-contain" />
                                    ) : (
                                        <Package className="w-6 h-6" />
                                    )}
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => openItemModal(item)} className="p-2 text-muted-foreground hover:text-primary rounded-lg transition-colors"><Edit className="w-4 h-4" /></button>
                                    <button onClick={() => handleDeleteItem(item.id)} className="p-2 text-muted-foreground hover:text-red-500 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                            <div className="space-y-1 mb-6 relative z-10">
                                <span className="text-[9px] font-black text-primary uppercase border border-primary/20 px-2 py-0.5 rounded-full bg-primary/5">{item.category?.name || 'S/C'}</span>
                                <h3 className="text-xl font-black text-foreground uppercase pt-2 leading-tight">{item.name}</h3>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] pt-1">SKU: {item.sku || '---'}</p>
                            </div>
                        </div>
                    ))}
                    <button onClick={() => openItemModal(null)} className="bg-muted/10 border-2 border-dashed border-border p-8 rounded-[2rem] flex flex-col items-center justify-center gap-4 text-muted-foreground hover:border-primary/50 transition-all group min-h-[200px]">
                        <div className="p-4 bg-card/80 rounded-full group-hover:scale-110 transition-transform"><Plus className="w-8 h-8 text-primary" /></div>
                        <p className="text-xs font-black uppercase tracking-widest">Añadir Producto</p>
                    </button>
                </div>
            ) : (
                <div className="bg-card border-2 border-border rounded-[2rem] overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-muted/30 border-b border-border">
                                <th className="px-8 py-5 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Categoría</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase text-muted-foreground tracking-widest text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {categories.map((cat) => (
                                <tr key={cat.id} className="hover:bg-muted/20 transition-colors group">
                                    <td className="px-8 py-5"><span className="font-black uppercase text-sm tracking-tight">{cat.name}</span></td>
                                    <td className="px-8 py-5 text-right"><button onClick={() => { setEditingCat(cat); setIsCatModalOpen(true); }} className="p-2 text-muted-foreground hover:text-primary rounded-lg transition-all"><Edit className="w-4 h-4" /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Modal isOpen={isItemModalOpen} onClose={() => setIsItemModalOpen(false)} title={editingItem ? "Editar Producto" : "Nuevo Producto"}>
                <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-6 p-4 bg-muted/20 rounded-3xl border-2 border-dashed border-border group relative transition-all">
                        <div className="w-24 h-24 bg-card rounded-2xl border-2 border-border flex items-center justify-center overflow-hidden shrink-0 relative">
                            {previewImage ? <img src={previewImage} alt="Preview" className="w-full h-full object-contain" /> : <ImageIcon className="w-10 h-10 text-muted-foreground/30" />}
                            {uploadingImage && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-white" /></div>}
                        </div>
                        <div className="flex-1 space-y-2">
                            <h4 className="text-[10px] font-black uppercase text-primary">Imagen</h4>
                            <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-primary/10 text-primary text-[10px] font-black uppercase rounded-lg border border-primary/20 hover:bg-primary/20 transition-all flex items-center gap-2">
                                <Upload className="w-3 h-3" /> {uploadingImage ? 'Subiendo...' : 'Seleccionar'}
                            </button>
                            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                        </div>
                    </div>

                    <div className="flex gap-1 p-1 bg-muted rounded-2xl">
                        {['general', 'technical', 'financial'].map((tab) => (
                            <button key={tab} onClick={() => setItemModalTab(tab as any)} className={clsx("flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all", itemModalTab === tab ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>{tab}</button>
                        ))}
                    </div>

                    <form onSubmit={handleSaveItem} className="space-y-6">
                        {itemModalTab === 'general' && (
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Nombre</label>
                                    <input name="name" value={itemFormData.name} onChange={handleInputChange} required className="w-full bg-muted/30 border border-border rounded-xl p-3 text-sm outline-none" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Marca</label>
                                        <input name="brand" value={itemFormData.brand} onChange={handleInputChange} className="w-full bg-muted/30 border border-border rounded-xl p-3 text-sm outline-none" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Categoría</label>
                                        <select name="category_id" value={itemFormData.category_id} onChange={handleInputChange} required className="w-full bg-muted/30 border border-border rounded-xl p-3 text-sm outline-none">
                                            <option value="">Seleccionar...</option>
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">SKU</label>
                                        <input name="sku" value={itemFormData.sku} onChange={handleInputChange} className="w-full bg-muted/30 border border-border rounded-xl p-3 text-sm outline-none" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-1 text-primary">Nivel Mínimo Stock</label>
                                        <input type="number" name="min_stock_level" value={itemFormData.min_stock_level} onChange={handleInputChange} className="w-full bg-primary/5 border-2 border-primary/20 rounded-xl p-3 text-sm font-black focus:border-primary outline-none" />
                                    </div>
                                </div>
                            </div>
                        )}
                        {itemModalTab === 'technical' && (
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Modelo Exacto</label>
                                    <input name="model_name" value={itemFormData.model_name} onChange={handleInputChange} className="w-full bg-muted/30 border border-border rounded-xl p-3 text-sm outline-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Especificaciones Técnicas</label>
                                    <textarea name="description_technical" value={itemFormData.description_technical} onChange={handleInputChange} className="w-full bg-muted/30 border border-border rounded-xl p-3 text-sm outline-none h-32" />
                                </div>
                            </div>
                        )}
                        {itemModalTab === 'financial' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Costo Unitario</label>
                                        <input type="number" name="unit_cost" value={itemFormData.unit_cost} onChange={handleInputChange} className="w-full bg-muted/30 border border-border rounded-xl p-3 text-sm outline-none" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Días de Garantía</label>
                                        <input type="number" name="warranty_days" value={itemFormData.warranty_days} onChange={handleInputChange} className="w-full bg-muted/30 border border-border rounded-xl p-3 text-sm outline-none" />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="flex gap-3 pt-6 border-t border-border">
                            <button type="button" onClick={() => setIsItemModalOpen(false)} className="px-6 py-3 bg-muted rounded-xl text-xs font-black uppercase transition-all">Cancelar</button>
                            <button type="submit" disabled={isSaving} className="flex-1 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2">{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar</button>
                        </div>
                    </form>
                </div>
            </Modal>

            <Modal isOpen={isCatModalOpen} onClose={() => setIsCatModalOpen(false)} title={editingCat ? "Editar Categoría" : "Nueva Categoría"}>
                <form onSubmit={handleSaveCategory} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Nombre</label>
                        <input name="name" defaultValue={editingCat?.name} required className="w-full bg-muted/30 border border-border rounded-xl p-3 text-sm outline-none" />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={() => setIsCatModalOpen(false)} className="flex-1 py-3 bg-muted rounded-xl text-xs font-black uppercase">Cancelar</button>
                        <button type="submit" disabled={isSaving} className="flex-1 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2">{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
