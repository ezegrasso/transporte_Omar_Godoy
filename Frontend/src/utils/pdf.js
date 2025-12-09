import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { companyBrand } from '../config/brand';

// Genera un PDF con listado de viajes
export function generarListadoViajesPDF(titulo, headers, rows, fileName = 'viajes.pdf') {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(titulo, 14, 16);
    doc.setFontSize(10);
    doc.text(`Exportado: ${new Date().toLocaleString()}`, 14, 22);
    const body = rows.map(r => r.map(v => v == null ? '' : String(v)));
    doc.autoTable({
        startY: 26,
        head: [headers],
        body,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [14, 165, 233] },
        didDrawPage: data => {
            const str = `Página ${doc.getNumberOfPages()}`;
            doc.setFontSize(8);
            doc.text(str, data.cursor.x, 8, { align: 'right' });
        }
    });
    doc.save(fileName);
}

// Genera detalle de viaje en PDF
export function generarDetalleViajePDF(viaje, fileName = `viaje_${viaje.id}.pdf`) {
    const doc = new jsPDF();
    // Logo y branding
    const { logoBase64, nombre } = companyBrand;
    if (logoBase64) {
        try { doc.addImage(logoBase64, 'PNG', 14, 10, 36, 12); } catch { /* ignore logo errors */ }
    }
    doc.setFontSize(16);
    doc.text(`Detalle de viaje #${viaje.id}`, 54, 16);
    doc.setFontSize(10);
    doc.text(nombre, 54, 22);
    doc.text(`Fecha exportación: ${new Date().toLocaleString()}`, 14, 28);
    const info = [
        ['Fecha', new Date(viaje.fecha).toLocaleDateString()],
        ['Estado', viaje.estado || '-'],
        ['Origen', viaje.origen || '-'],
        ['Destino', viaje.destino || '-'],
        ['Camión', viaje.camion ? `${viaje.camion.patente} (${viaje.camion.marca} ${viaje.camion.modelo}, ${viaje.camion.anio})` : (viaje.camionId || '-')],
        ['Camionero', viaje.camionero?.nombre || '-'],
        ['Tipo mercadería', viaje.tipoMercaderia || '-'],
        ['Cliente', viaje.cliente || '-'],
        ['Kilómetros', viaje.km ?? '-'],
        ['Combustible', viaje.combustible ?? '-']
    ];
    doc.autoTable({
        startY: 34,
        body: info,
        styles: { fontSize: 10 },
        theme: 'grid',
        head: [['Campo', 'Valor']],
        headStyles: { fillColor: [14, 165, 233] }
    });
    doc.save(fileName);
}

// Genera una factura simple (proforma) del viaje finalizado
export function generarFacturaViajePDF(viaje, fileName = `factura_viaje_${viaje.id}.pdf`) {
    const doc = new jsPDF();
    const numero = `FAC-${viaje.id}-${new Date(viaje.fecha).getFullYear()}`;
    const { nombre, cuit, direccion, telefono, email, logoBase64, tarifaKm, tarifaCombustibleLitro, moneda } = companyBrand;

    // Encabezado con logo
    if (logoBase64) {
        try { doc.addImage(logoBase64, 'PNG', 14, 10, 36, 12); } catch { /* ignore logo errors */ }
    }
    doc.setFontSize(18);
    doc.text('Factura / Comprobante de Servicio', 54, 18);
    doc.setFontSize(9);
    doc.text(nombre, 54, 24);
    doc.text(`CUIT: ${cuit}`, 54, 29);
    doc.text(direccion, 54, 34);
    doc.text(`Tel: ${telefono}  Email: ${email}`, 54, 39);

    // Datos basicos
    doc.setFontSize(11);
    let y = 48;
    doc.text(`Número: ${numero}`, 14, y); y += 6;
    doc.text(`Fecha emisión: ${new Date().toLocaleDateString()}`, 14, y); y += 6;
    doc.text(`Cliente: ${viaje.cliente || 'N/D'}`, 14, y); y += 6;
    doc.text(`Viaje: ${viaje.origen} → ${viaje.destino}`, 14, y); y += 8;

    // Cálculos de importes
    const kmNum = Number(viaje.km) || 0;
    const combNum = Number(viaje.combustible) || 0;
    const importeKm = kmNum * tarifaKm;
    const importeComb = combNum * tarifaCombustibleLitro;
    const subtotal = importeKm + importeComb;
    const iva = subtotal * 0.21; // 21% IVA referencia
    const total = subtotal + iva;

    // Tabla de detalle (servicio + desglose)
    doc.autoTable({
        startY: y,
        head: [['Descripción', 'Km', `Tarifa Km (${moneda})`, 'Combustible', `Tarifa Comb (${moneda})`, `Subtotal (${moneda})`]],
        body: [[`Servicio de transporte (${viaje.origen} a ${viaje.destino})`, kmNum, tarifaKm.toLocaleString(), combNum, tarifaCombustibleLitro.toLocaleString(), subtotal.toLocaleString()]],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [14, 165, 233] }
    });
    const afterTableY = doc.lastAutoTable.finalY + 6;

    // Totales
    doc.setFontSize(10);
    doc.text(`Subtotal: ${subtotal.toLocaleString()} ${moneda}`, 14, afterTableY);
    doc.text(`IVA (21%): ${iva.toLocaleString()} ${moneda}`, 14, afterTableY + 5);
    doc.setFontSize(12);
    doc.text(`TOTAL: ${total.toLocaleString()} ${moneda}`, 14, afterTableY + 12);

    // Observaciones
    doc.setFontSize(8);
    doc.text('Documento generado automáticamente. Precios estimados; validar contra sistema contable.', 14, afterTableY + 20);
    doc.text('Gracias por confiar en nuestro servicio.', 14, afterTableY + 25);

    doc.save(fileName);
}
