import XLSX from 'xlsx';
import fs from 'fs';

const FILE_PATH = './Producto.xlsx';
const OUTPUT_FILE = './scripts/inventory_data.json';

// Reglas de categorización inteligente
const CATEGORY_RULES = [
    { keywords: ['ONU', 'ONT', 'NOKIA', 'HUAWEI', 'V-SOL', 'V SOL'], category: 'EQUIPOS ONU/ONT' },
    { keywords: ['ROUTER', 'MIKROTIK', 'MERCUSYS', 'TP-LINK', 'TP LINK', 'TENDA', 'WIFI', 'LNB'], category: 'ROUTERS / WIFI' },
    { keywords: ['CABLE', 'DROP', 'UTP', 'CONECTO', 'FIBRA', 'MTS', 'METRO', 'PATCH', 'PIGTAIL'], category: 'CABLEADO Y PASIVOS' },
    { keywords: ['NAP', 'SPLITER', 'ENFRENTADOR', 'MUFA', 'ATENUADOR'], category: 'COMPONENTES RED (NAP/PASIVOS)' },
    { keywords: ['ABRAZADERA', 'AMARRE', 'GRAPA', 'CHAZO', 'CINTA', 'HEBILLA', 'HERRAJE', 'TENSOR', 'FLEJE', 'SOPORTE', 'TUERCA', 'TORNILLO', 'GANCHO'], category: 'FERRETERÍA Y HERRAJES' },
    { keywords: ['HERRAMIENTA', 'PINZA', 'PONCHADORA', 'PELADORA', 'VFL', 'POWER METER', 'FUSIONADORA', 'OTDR', 'ESCALERA', 'DESTORNILLADOR', 'MARTILLO', 'TALADRO', 'MULTIMETRO', 'CLAMP METER', 'CORTADORA'], category: 'HERRAMIENTAS Y EQUIPOS TÉCNICOS' },
    { keywords: ['ALCOHOL', 'KIMWIPES', 'PAÑOS', 'LIMPIADOR', 'GAFAS', 'GUANTE', 'ESLINGA', 'CASCO', 'BOTAS', 'CHALECO', 'PROTECCION'], category: 'SEGURIDAD Y ASEO' },
    { keywords: ['ACEITE', 'LIQUIDO', 'NEUMÁTICO', 'MOTO', 'FRENO', 'CARBURADOR', 'LLAVE', 'GATO HIDRAULICO', 'SOLDAR'], category: 'MANTENIMIENTO Y TALLER' }
];

function getCategory(name) {
    const upperName = name.toUpperCase();
    for (const rule of CATEGORY_RULES) {
        if (rule.keywords.some(k => upperName.includes(k))) {
            return rule.category;
        }
    }
    return 'OTROS / VARIOS';
}

function processExcel() {
    console.log(`📖 Leyendo ${FILE_PATH}...`);
    
    if (!fs.existsSync(FILE_PATH)) {
        console.error('❌ Archivo no encontrado.');
        return;
    }

    const workbook = XLSX.readFile(FILE_PATH);
    const sheetName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    console.log(`✅ ${data.length} filas encontradas.`);
    if (data.length > 0) {
        console.log('📌 Ejemplo de cabeceras detectadas:', Object.keys(data[0]));
        console.log('📌 Ejemplo de datos (Fila 1):', data[0]);
    }

    const processedData = data.map(row => {
        // Mapeo flexible
        const nombre = row.Nombre || row.PRODUCTO || row.DESCRIPCION || row.Name || row.Concepto || row.Articulo;
        const cantidad = parseInt(row['Cantidad disponible'] || row.Cantidad || row.CANTIDAD || row.STOCK || row.Quantity || row.Disponible || 0);
        
        return {
            Nombre: nombre,
            Cantidad: cantidad,
            Categoria: getCategory(nombre || '')
        };
    }).filter(item => item.Nombre && item.Cantidad > 0);

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(processedData, null, 2));
    console.log(`🚀 Datos procesados y guardados en ${OUTPUT_FILE}`);
    
    // Preview de categorías
    const summary = processedData.reduce((acc, curr) => {
        acc[curr.Categoria] = (acc[curr.Categoria] || 0) + 1;
        return acc;
    }, {});
    
    console.log('\n📊 Resumen de Categorización:');
    console.table(summary);
}

processExcel();
