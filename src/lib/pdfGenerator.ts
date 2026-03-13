import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface SlipItem {
    name: string;
    serial: string;
    quantity: number;
    status?: string;
    // New fields for reconcilliation
    initial?: number;
    consumed?: number;
    physical?: number;
}

interface SlipData {
    id: string; // Slip ID from DB
    type: 'morning' | 'evening';
    technicianName: string;
    technicianId: string;
    date: Date;
    items: SlipItem[];
    signatureData: string; // Base64 image
    notes?: string;
}

export const generateDeliverySlipPDF = async (data: SlipData): Promise<Blob> => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // --- Header ---
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('RapiLink SAS', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Nit: 901.062.663-7', pageWidth / 2, 26, { align: 'center' });
    doc.text('Siempre Conectados', pageWidth / 2, 31, { align: 'center' });

    // --- Title ---
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    const title = data.type === 'morning' ? 'ACTA DE ENTREGA DE MATERIAL' : 'LIQUIDACIÓN DE INSTALACIONES';
    doc.text(title, pageWidth / 2, 45, { align: 'center' });

    // --- Info Box ---
    doc.setFillColor(245, 245, 245);
    doc.rect(14, 55, pageWidth - 28, 35, 'F');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Fecha:', 20, 65);
    doc.text('Técnico:', 20, 75);
    doc.text('ID Técnico:', 20, 85);
    doc.text('Referencia:', 120, 65);

    doc.setFont('helvetica', 'normal');
    doc.text(format(data.date, "PPP 'a las' p", { locale: es }), 50, 65);
    doc.text(data.technicianName.toUpperCase(), 50, 75);
    doc.text(data.technicianId.split('-')[0].toUpperCase(), 50, 85);
    doc.text(data.id.split('-')[0].toUpperCase(), 145, 65);

    // --- Table ---
    const isEvening = data.type === 'evening';

    // Choose columns based on type
    const tableColumn = isEvening
        ? ["Ítem / Descripción", "Serial / Lote", "Estado", "Inicial", "Gasto", "Físico"]
        : ["Ítem / Descripción", "Serial / Lote", "Estado", "Cant."];

    const tableRows = data.items.map(item => {
        if (isEvening) {
            return [
                item.name,
                item.serial || '---',
                item.status === 'warehouse' ? 'En Bodega' :
                    item.status === 'assigned' ? 'Asignado' :
                        item.status === 'installed' ? 'Instalado' :
                            item.status === 'used' ? 'Usado' : (item.status || '---'),
                item.initial?.toString() || (item.quantity).toString(), // Fallback to qty if initial missing
                item.consumed !== undefined ? `-${item.consumed}` : '---',
                item.physical?.toString() || '---'
            ];
        } else {
            return [
                item.name,
                item.serial || '---',
                item.status === 'warehouse' ? 'En Bodega' :
                    item.status === 'assigned' ? 'Asignado' :
                        item.status === 'installed' ? 'Instalado' :
                            item.status === 'used' ? 'Usado' : (item.status || '---'),
                item.quantity.toString()
            ];
        }
    });

    autoTable(doc, {
        startY: 100,
        head: [tableColumn],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: isEvening ? {
            0: { cellWidth: 'auto' }, // Name
            1: { cellWidth: 40 },     // Serial
            2: { cellWidth: 20 },     // Status
            3: { cellWidth: 15, halign: 'center' }, // Initial
            4: { cellWidth: 15, halign: 'center', textColor: [41, 128, 185] }, // Spent
            5: { cellWidth: 15, halign: 'center', fontStyle: 'bold' }  // Physical
        } : {
            0: { cellWidth: 'auto' }, // Name
            1: { cellWidth: 50 },     // Serial
            2: { cellWidth: 30 },     // Status
            3: { cellWidth: 20, halign: 'center' } // Qty
        }
    });

    // --- Footer & Signature ---
    // @ts-ignore
    const finalY = doc.lastAutoTable.finalY + 10;

    if (data.notes) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Observaciones:', 14, finalY);
        doc.setFont('helvetica', 'normal');
        doc.text(data.notes, 14, finalY + 5, { maxWidth: pageWidth - 28 });
    }

    const signatureY = finalY + 40;

    // Add Signature Image
    if (data.signatureData) {
        try {
            doc.addImage(data.signatureData, 'PNG', pageWidth / 2 - 30, signatureY - 25, 60, 30);
        } catch (e) {
            console.error("Error adding signature to PDF", e);
        }
    }

    doc.line(pageWidth / 2 - 40, signatureY + 5, pageWidth / 2 + 40, signatureY + 5);
    doc.setFontSize(8);
    doc.text('Firma del Técnico Responsable', pageWidth / 2, signatureY + 10, { align: 'center' });
    doc.text(data.technicianName, pageWidth / 2, signatureY + 15, { align: 'center' });

    // --- Disclaimer ---
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text('Este documento valida la entrega y responsabilidad sobre los activos mencionados.', pageWidth / 2, 280, { align: 'center' });
    doc.text(`Generado el ${new Date().toLocaleString()}`, 14, 290);

    return doc.output('blob');
};
