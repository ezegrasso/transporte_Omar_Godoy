import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { companyBrand } from '../config/brand';

// Genera un PDF con listado de viajes (mejorado con resumen financiero)
export function generarListadoViajesPDF(titulo, headers, rows, fileName = 'viajes.pdf', datosViajes = []) {
    const doc = new jsPDF({ orientation: 'landscape' });
    const { logoBase64, nombre, cuit, direccion, telefono, email } = companyBrand;

    // Encabezado con logo
    let logoWidth = 0;
    if (logoBase64) {
        try {
            doc.addImage(logoBase64, 'PNG', 14, 10, 30, 10);
            logoWidth = 50;
        } catch { /* ignore logo errors */ }
    }

    // Información de la empresa
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(nombre, 14 + logoWidth, 12);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(`CUIT: ${cuit}`, 14 + logoWidth, 17);
    doc.text(`${direccion} | Tel: ${telefono}`, 14 + logoWidth, 21);

    // Título
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(titulo, 14, 28);

    // Fecha exportación
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text(`Exportado: ${new Date().toLocaleString()}`, 14, 33);

    const body = rows.map(r => r.map(v => v == null ? '' : String(v)));

    // Tabla de viajes
    doc.autoTable({
        startY: 36,
        head: [headers],
        body,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [14, 165, 233], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [240, 240, 240] },
        margin: { bottom: 50 },
        didDrawPage: data => {
            const str = `Página ${doc.getNumberOfPages()}`;
            doc.setFontSize(8);
            doc.text(str, data.cursor.x + 170, 8, { align: 'right' });
        }
    });

    // Resumen financiero (si hay datos de viajes)
    if (datosViajes && datosViajes.length > 0) {
        const finalY = doc.lastAutoTable?.finalY || 36;
        const marginY = finalY + 5;

        // Calcular totales
        const totalKm = datosViajes.reduce((sum, v) => sum + (Number(v.km) || 0), 0);
        const totalCombustible = datosViajes.reduce((sum, v) => sum + (Number(v.combustible) || 0), 0);
        const totalToneladas = datosViajes.reduce((sum, v) => sum + (Number(v.kilosCargados) || 0), 0);
        const totalImporte = datosViajes.reduce((sum, v) => sum + (Number(v.importe) || 0), 0);
        const totalFinalizados = datosViajes.filter(v => v.estado === 'finalizado').length;
        const totalPendientes = datosViajes.filter(v => v.estado === 'pendiente').length;
        const totalEnCurso = datosViajes.filter(v => v.estado === 'en curso').length;

        // Caja de resumen
        doc.setDrawColor(14, 165, 233);
        doc.setLineWidth(0.5);
        doc.rect(14, marginY, 272, 12);

        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.text('RESUMEN FINANCIERO', 14.5, marginY + 3);

        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');

        const summaryText = [
            `Total viajes: ${datosViajes.length} | Finalizados: ${totalFinalizados} | En curso: ${totalEnCurso} | Pendientes: ${totalPendientes}`,
            `Km totales: ${totalKm} | Combustible: ${totalCombustible.toLocaleString('es-AR', { maximumFractionDigits: 2 })} L | Toneladas: ${totalToneladas.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`,
            `Importe total: $${totalImporte.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        ];

        let textY = marginY + 5;
        summaryText.forEach(line => {
            doc.text(line, 16, textY);
            textY += 3;
        });
    }

    doc.save(fileName);
}

// Genera detalle de viaje en PDF (mejorado)
export function generarDetalleViajePDF(viaje, fileName = `viaje_${viaje.id}.pdf`) {
    const doc = new jsPDF();
    const { logoBase64, nombre, cuit, direccion, telefono, email } = companyBrand;

    // Encabezado
    let logoWidth = 0;
    if (logoBase64) {
        try {
            doc.addImage(logoBase64, 'PNG', 14, 10, 30, 12);
            logoWidth = 50;
        } catch { /* ignore logo errors */ }
    }

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(nombre, 14 + logoWidth, 14);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(`CUIT: ${cuit}`, 14 + logoWidth, 19);
    doc.text(`${direccion}`, 14 + logoWidth, 23);
    doc.text(`Tel: ${telefono} | Email: ${email}`, 14 + logoWidth, 27);

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(`DETALLE DE VIAJE #${viaje.id}`, 14, 35);

    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text(`Exportado: ${new Date().toLocaleString()}`, 14, 40);

    // Sección 1: Información General
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('INFORMACIÓN GENERAL', 14, 47);

    const infoGeneral = [
        ['Fecha', new Date(viaje.fecha).toLocaleDateString('es-AR')],
        ['Estado', (viaje.estado || '-').toUpperCase()],
        ['Origen', viaje.origen || '-'],
        ['Destino', viaje.destino || '-'],
        ['Cliente', viaje.cliente || '-'],
        ['Tipo Mercadería', viaje.tipoMercaderia || '-']
    ];

    doc.autoTable({
        startY: 50,
        body: infoGeneral,
        styles: { fontSize: 9, cellPadding: 2 },
        theme: 'grid',
        columnStyles: { 0: { fontStyle: 'bold', fillColor: [230, 240, 250], cellWidth: 50 } },
        headStyles: { fillColor: [14, 165, 233] },
        margin: { left: 14, right: 14 }
    });

    // Sección 2: Datos del Vehículo y Operario
    const tableHeight = doc.lastAutoTable?.finalY || 50;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('VEHÍCULO Y OPERARIO', 14, tableHeight + 10);

    const infoVehiculo = [
        ['Camión', viaje.camion ? `${viaje.camion.patente} ${viaje.camion.marca} ${viaje.camion.modelo} (${viaje.camion.anio})` : (viaje.camionId || '-')],
        ['Acoplado', viaje.acopladoPatente || '-'],
        ['Camionero', viaje.camionero?.nombre || viaje.camioneroNombre || '-'],
        ['Email Camionero', viaje.camionero?.email || viaje.camioneroEmail || '-']
    ];

    doc.autoTable({
        startY: tableHeight + 13,
        body: infoVehiculo,
        styles: { fontSize: 9, cellPadding: 2 },
        theme: 'grid',
        columnStyles: { 0: { fontStyle: 'bold', fillColor: [230, 240, 250], cellWidth: 50 } },
        headStyles: { fillColor: [14, 165, 233] },
        margin: { left: 14, right: 14 }
    });

    // Sección 3: Datos Operacionales
    const tableHeight2 = doc.lastAutoTable?.finalY || tableHeight + 13;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('DATOS OPERACIONALES', 14, tableHeight2 + 10);

    const infoOperacional = [
        ['Kilómetros', viaje.km ?? '-'],
        ['Combustible (Litros)', viaje.combustible ?? '-'],
        ['Kilos Cargados', viaje.kilosCargados ?? '-'],
        ['Precio por Tonelada', `$${(viaje.precioTonelada ?? '-')}`],
    ];

    doc.autoTable({
        startY: tableHeight2 + 13,
        body: infoOperacional,
        styles: { fontSize: 9, cellPadding: 2 },
        theme: 'grid',
        columnStyles: { 0: { fontStyle: 'bold', fillColor: [230, 240, 250], cellWidth: 50 } },
        headStyles: { fillColor: [14, 165, 233] },
        margin: { left: 14, right: 14 }
    });

    // Sección 4: Datos Financieros
    const tableHeight3 = doc.lastAutoTable?.finalY || tableHeight2 + 13;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('DATOS FINANCIEROS', 14, tableHeight3 + 10);

    const infoFinanciera = [
        ['Importe', `$${(viaje.importe ?? '0').toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
        ['Estado Factura', viaje.facturaEstado || '-'],
        ['Fecha Factura', viaje.fechaFactura ? new Date(viaje.fechaFactura).toLocaleDateString('es-AR') : '-'],
        ['Factura URL', viaje.facturaUrl ? 'Cargada' : 'Pendiente'],
        ['Remitos', (() => { try { return (JSON.parse(viaje.remitosJson || '[]') || []).length; } catch { return 0; } })()]
    ];

    doc.autoTable({
        startY: tableHeight3 + 13,
        body: infoFinanciera,
        styles: { fontSize: 9, cellPadding: 2 },
        theme: 'grid',
        columnStyles: { 0: { fontStyle: 'bold', fillColor: [230, 240, 250], cellWidth: 50 } },
        headStyles: { fillColor: [14, 165, 233] },
        margin: { left: 14, right: 14 }
    });

    // Pie de página
    doc.setFontSize(8);
    doc.setFont(undefined, 'italic');
    doc.text('Este documento ha sido generado automáticamente por el sistema de gestión de viajes.', 14, doc.internal.pageSize.getHeight() - 10);

    doc.save(fileName);
}

// Genera una factura profesional del viaje finalizado
export function generarFacturaViajePDF(viaje, fileName = `factura_viaje_${viaje.id}.pdf`) {
    const doc = new jsPDF();
    const numero = `FAC-${viaje.id}-${new Date(viaje.fecha).getFullYear()}`;
    const { nombre, cuit, direccion, telefono, email, logoBase64, tarifaKm, tarifaCombustibleLitro, moneda } = companyBrand;

    // Encabezado profesional con logo
    let logoWidth = 0;
    if (logoBase64) {
        try {
            doc.addImage(logoBase64, 'PNG', 14, 10, 35, 15);
            logoWidth = 55;
        } catch { /* ignore logo errors */ }
    }

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('FACTURA / COMPROBANTE', 14 + logoWidth, 15);

    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text(nombre, 14 + logoWidth, 22);

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(`CUIT: ${cuit}`, 14 + logoWidth, 27);
    doc.text(`${direccion}`, 14 + logoWidth, 31);
    doc.text(`Tel: ${telefono} | Email: ${email}`, 14 + logoWidth, 35);

    // Datos básicos de la factura
    doc.setDrawColor(14, 165, 233);
    doc.setLineWidth(0.5);
    doc.rect(14, 40, 182, 18);

    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    let y = 44;
    doc.text(`Número: ${numero}`, 16, y);
    y += 5;
    doc.text(`Fecha emisión: ${new Date().toLocaleDateString('es-AR')}`, 16, y);
    y += 5;
    doc.text(`Fecha del servicio: ${new Date(viaje.fecha).toLocaleDateString('es-AR')}`, 16, y);

    // Datos del cliente
    y = 62;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('DATOS DEL CLIENTE', 14, y);

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    y += 5;
    doc.text(`Cliente: ${viaje.cliente || 'N/D'}`, 16, y);
    y += 4;
    doc.text(`Ruta: ${viaje.origen} → ${viaje.destino}`, 16, y);
    y += 4;
    doc.text(`Tipo Mercadería: ${viaje.tipoMercaderia || 'N/D'}`, 16, y);

    // Tabla de servicios
    y += 8;
    const kmNum = Number(viaje.km) || 0;
    const combNum = Number(viaje.combustible) || 0;
    const tonNum = Number(viaje.kilosCargados) || 0;
    const importeKm = kmNum * tarifaKm;
    const importeComb = combNum * tarifaCombustibleLitro;
    const subtotal = viaje.importe || (importeKm + importeComb);
    const iva = subtotal * (Number(viaje.ivaPercentaje || 21) / 100);
    const total = subtotal + iva;

    const serviceData = [
        {
            desc: `Transporte de mercadería (${viaje.origen} a ${viaje.destino})`,
            detalles: `${kmNum} km a ${tarifaKm}/km + ${combNum}L combustible a ${tarifaCombustibleLitro}/L`,
            cantidad: 1,
            unitario: subtotal,
            total: subtotal
        }
    ];

    doc.autoTable({
        startY: y,
        head: [['Descripción', 'Detalles', 'Cantidad', `Unitario (${moneda})`, `Total (${moneda})`]],
        body: serviceData.map(s => [
            s.desc,
            s.detalles,
            s.cantidad,
            s.unitario.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            s.total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        ]),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [14, 165, 233], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [240, 240, 240] }
    });

    // Totales
    const afterTableY = doc.lastAutoTable?.finalY || y + 20;
    const totalBoxHeight = 20;

    // Caja de totales
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.rect(100, afterTableY + 5, 96, totalBoxHeight);

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    let totalY = afterTableY + 9;

    doc.text(`Subtotal: ${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moneda}`, 102, totalY);
    totalY += 5;

    doc.text(`IVA (${viaje.ivaPercentaje || 21}%): ${iva.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moneda}`, 102, totalY);
    totalY += 5;

    doc.setFont(undefined, 'bold');
    doc.setFontSize(11);
    doc.text(`TOTAL: ${total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moneda}`, 102, totalY + 2);

    // Tabla de datos del viaje (opcional pero detallada)
    const viajeDatos = [
        ['Camión', viaje.camion ? `${viaje.camion.patente} ${viaje.camion.marca} ${viaje.camion.modelo}` : viaje.camionId],
        ['Conductor', viaje.camionero?.nombre || viaje.camioneroNombre || 'N/D'],
        ['Kilómetros', `${kmNum} km`],
        ['Combustible', `${combNum} L`],
        ['Kilos Cargados', `${tonNum} kg`],
        ['Estado', (viaje.estado || 'N/D').toUpperCase()]
    ];

    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    const datoViajeY = afterTableY + totalBoxHeight + 8;
    doc.text('DATOS DEL VIAJE', 14, datoViajeY);

    doc.autoTable({
        startY: datoViajeY + 3,
        body: viajeDatos,
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold', fillColor: [230, 240, 250], cellWidth: 40 } },
        theme: 'grid'
    });

    // Observaciones y firma
    const obsY = doc.lastAutoTable?.finalY || datoViajeY + 30;
    doc.setFontSize(8);
    doc.setFont(undefined, 'italic');
    doc.text('Documento generado automáticamente. Precios según tarifa vigente. Gracias por confiar en nuestro servicio.', 14, obsY + 8);
    doc.text('Condiciones: Válido como comprobante de servicio. Todos los derechos reservados.', 14, obsY + 12);

    doc.save(fileName);
}
