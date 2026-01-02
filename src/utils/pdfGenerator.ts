import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { CRMInteraction } from '../types';

interface PDFReportData {
    agentName: string;
    date: Date;
    interactions: CRMInteraction[];
    stats: {
        total: number;
        effective: number;
        sales: number;
        conversion: number;
    };
}

export const generateDailyReportPDF = (data: PDFReportData) => {
    const doc = new jsPDF();
    const { agentName, date, interactions, stats } = data;

    // --- Header ---
    doc.setFillColor(31, 41, 55); // Dark grey header
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text("RAPILINK SAS", 14, 20);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text("Reporte de Gestión Diario", 14, 30);

    const dateStr = format(date, "d 'de' MMMM, yyyy", { locale: es });
    doc.text(dateStr, 196, 20, { align: 'right' });
    doc.text(`Agente: ${agentName || 'Usuario'}`, 196, 30, { align: 'right' });

    // --- KPI Summary ---
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("Resumen de Resultados", 14, 55);

    autoTable(doc, {
        startY: 60,
        head: [['Total Contactos', 'Contactos Efectivos', 'Ventas Realizadas', 'Efectividad']],
        body: [[
            stats.total,
            stats.effective,
            stats.sales,
            `${stats.conversion}%`
        ]],
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] }, // Indigo 600
        styles: { halign: 'center', fontSize: 12 }
    });

    // --- Detailed Interactions ---
    const finalY = (doc as any).lastAutoTable.finalY + 15;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("Detalle de Interacciones", 14, finalY);

    const tableRows = interactions.map(i => [
        i.created_at ? format(new Date(i.created_at), 'HH:mm') : '-',
        i.client_reference || '-',
        i.current_plan || '-',
        i.result || '-',
        i.objection || i.suggested_plan || '-'
    ]);

    autoTable(doc, {
        startY: finalY + 5,
        head: [['Hora', 'Cliente', 'Plan', 'Resultado', 'Observación']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [55, 65, 81] }, // Gray 700
        styles: { fontSize: 9 },
        columnStyles: {
            0: { cellWidth: 20 },
            3: { fontStyle: 'bold' }
        },
        didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 3) {
                const result = data.cell.raw as string;
                if (result === 'Aceptó Migración') {
                    data.cell.styles.textColor = [22, 163, 74]; // Green
                } else if (result.includes('Rechazó')) {
                    data.cell.styles.textColor = [220, 38, 38]; // Red
                }
            }
        }
    });

    // --- Footer ---
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
            `Generado el ${format(new Date(), 'dd/MM/yyyy HH:mm')} - Página ${i} de ${pageCount}`,
            105,
            290,
            { align: 'center' }
        );
    }

    doc.save(`reporte_diario_${format(date, 'yyyy-MM-dd')}.pdf`);
};
