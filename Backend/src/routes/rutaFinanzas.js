import express from 'express';
import { query, validationResult } from 'express-validator';
import { Op } from 'sequelize';
import Viaje from '../models/Viajes.js';
import Usuario from '../models/Usuario.js';
import Comisionista from '../models/Comisionista.js';
import Adelanto from '../models/Adelanto.js';
import Estadia from '../models/Estadia.js';
import CombustibleMovimiento from '../models/CombustibleMovimiento.js';
import { authMiddleware, roleMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

const toNum = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

const isValidCamioneroId = (value) => {
    const n = Number(value);
    return Number.isInteger(n) && n > 0;
};

const toDateOnlyRange = (mesYYYYMM) => {
    const [yearStr, monthStr] = String(mesYYYYMM || '').split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const fromDate = new Date(year, month - 1, 1);
    const toDate = new Date(year, month, 0);
    const from = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}-${String(fromDate.getDate()).padStart(2, '0')}`;
    const to = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, '0')}-${String(toDate.getDate()).padStart(2, '0')}`;
    return { from, to, year, month };
};

const calcularIngresoViaje = (viaje) => {
    const precioFactura = toNum(viaje?.precioUnitarioFactura);
    const iva = toNum(viaje?.ivaPercentaje);
    const precioNegro = toNum(viaje?.precioUnitarioNegro);
    const notasCreditoTotal = toNum(viaje?.notasCreditoTotal);
    const facturable = precioFactura > 0 ? ((precioFactura * (1 + (iva / 100))) - notasCreditoTotal) : 0;
    const total = facturable + precioNegro;
    return total > 0 ? total : toNum(viaje?.importe);
};

router.get('/resumen-mensual',
    authMiddleware,
    roleMiddleware(['ceo', 'administracion']),
    [query('mes').isString().matches(/^\d{4}-\d{2}$/)],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        try {
            const mes = String(req.query.mes);
            const { from, to, year, month } = toDateOnlyRange(mes);

            const [viajes, adelantos, estadias, movimientosCombustible] = await Promise.all([
                Viaje.findAll({
                    where: {
                        estado: 'finalizado',
                        fecha: { [Op.between]: [from, to] }
                    },
                    include: [
                        { model: Usuario, as: 'camionero', attributes: ['id', 'nombre', 'email'] },
                        { model: Comisionista, as: 'comisionista', attributes: ['id', 'nombre', 'porcentaje'] }
                    ],
                    attributes: [
                        'id', 'fecha', 'cliente', 'facturaEstado', 'importe', 'precioUnitarioFactura', 'precioUnitarioNegro',
                        'ivaPercentaje', 'camioneroId', 'camioneroNombre', 'comisionPorcentaje'
                    ]
                }),
                Adelanto.findAll({
                    where: { mes: month, anio: year },
                    attributes: ['id', 'camioneroId', 'monto']
                }),
                Estadia.findAll({
                    where: { mes: month, anio: year },
                    attributes: ['id', 'camioneroId', 'monto']
                }),
                CombustibleMovimiento.findAll({
                    where: {
                        mes: month,
                        anio: year,
                        tipoRegistro: 'carga',
                        origen: { [Op.in]: ['predio', 'externo'] }
                    },
                    attributes: ['id', 'camioneroId', 'litros', 'importeTotal'],
                    include: [{ model: Usuario, as: 'camionero', attributes: ['id', 'nombre'], required: false }]
                })
            ]);

            const facturacionPorCamioneroMap = new Map();
            const adelantosPorCamionero = new Map();
            const estadiasPorCamionero = new Map();
            const combustiblePorCamionero = new Map();
            const facturacionPorClienteMap = new Map();

            let ingresosTotales = 0;
            let ingresosCobrados = 0;
            let ingresosPendientes = 0;
            let comisionesIntermediarios = 0;

            for (const viaje of viajes) {
                const camioneroId = viaje.camioneroId || null;
                const nombreCamionero = viaje?.camionero?.nombre || viaje?.camioneroNombre || 'Sin camionero';
                const ingreso = calcularIngresoViaje(viaje);
                const estadoFactura = String(viaje?.facturaEstado || 'pendiente').toLowerCase();

                ingresosTotales += ingreso;
                if (estadoFactura === 'cobrada') ingresosCobrados += ingreso;
                else ingresosPendientes += ingreso;

                const cliente = String(viaje?.cliente || 'Sin cliente');
                const clienteAcc = facturacionPorClienteMap.get(cliente) || { cliente, total: 0, cobradas: 0, pendientes: 0, viajes: 0 };
                clienteAcc.total += ingreso;
                clienteAcc.viajes += 1;
                if (estadoFactura === 'cobrada') clienteAcc.cobradas += ingreso;
                else clienteAcc.pendientes += ingreso;
                facturacionPorClienteMap.set(cliente, clienteAcc);

                const porcentajeComision = toNum(viaje?.comisionPorcentaje) || toNum(viaje?.comisionista?.porcentaje);
                const totalComisionViaje = ingreso * (porcentajeComision / 100);
                comisionesIntermediarios += totalComisionViaje;

                // Solo consolidar por camionero cuando hay un ID válido.
                if (!isValidCamioneroId(camioneroId)) continue;

                const acc = facturacionPorCamioneroMap.get(camioneroId) || {
                    camioneroId,
                    camioneroNombre: nombreCamionero,
                    viajes: 0,
                    bruto: 0,
                    brutoLiquidacion: 0,
                    sueldo: 0,
                    adelantos: 0,
                    estadias: 0,
                    neto: 0,
                    combustibleLitros: 0,
                    combustibleImporte: 0,
                    cobrado: 0,
                    pendiente: 0
                };
                acc.viajes += 1;
                acc.bruto += ingreso;
                // La liquidación del camionero se basa en `importe` del viaje (misma regla que /viajes/liquidacion).
                acc.brutoLiquidacion += toNum(viaje?.importe);
                if (estadoFactura === 'cobrada') acc.cobrado += ingreso;
                else acc.pendiente += ingreso;
                facturacionPorCamioneroMap.set(camioneroId, acc);
            }

            for (const adelanto of adelantos) {
                const camioneroId = adelanto.camioneroId || null;
                if (!isValidCamioneroId(camioneroId)) continue;
                const actual = adelantosPorCamionero.get(camioneroId) || 0;
                adelantosPorCamionero.set(camioneroId, actual + toNum(adelanto.monto));

                if (!facturacionPorCamioneroMap.has(camioneroId)) {
                    facturacionPorCamioneroMap.set(camioneroId, {
                        camioneroId,
                        camioneroNombre: 'Sin camionero',
                        viajes: 0,
                        bruto: 0,
                        brutoLiquidacion: 0,
                        sueldo: 0,
                        adelantos: 0,
                        estadias: 0,
                        neto: 0,
                        combustibleLitros: 0,
                        combustibleImporte: 0,
                        cobrado: 0,
                        pendiente: 0
                    });
                }
            }

            for (const estadia of estadias) {
                const camioneroId = estadia.camioneroId || null;
                if (!isValidCamioneroId(camioneroId)) continue;
                const actual = estadiasPorCamionero.get(camioneroId) || 0;
                estadiasPorCamionero.set(camioneroId, actual + toNum(estadia.monto));

                if (!facturacionPorCamioneroMap.has(camioneroId)) {
                    facturacionPorCamioneroMap.set(camioneroId, {
                        camioneroId,
                        camioneroNombre: 'Sin camionero',
                        viajes: 0,
                        bruto: 0,
                        brutoLiquidacion: 0,
                        sueldo: 0,
                        adelantos: 0,
                        estadias: 0,
                        neto: 0,
                        combustibleLitros: 0,
                        combustibleImporte: 0,
                        cobrado: 0,
                        pendiente: 0
                    });
                }
            }

            for (const movimiento of movimientosCombustible) {
                const camioneroId = movimiento.camioneroId || null;
                if (!isValidCamioneroId(camioneroId)) continue;
                const actual = combustiblePorCamionero.get(camioneroId) || { litros: 0, importe: 0 };
                actual.litros += toNum(movimiento.litros);
                actual.importe += toNum(movimiento.importeTotal);
                combustiblePorCamionero.set(camioneroId, actual);

                if (!facturacionPorCamioneroMap.has(camioneroId)) {
                    facturacionPorCamioneroMap.set(camioneroId, {
                        camioneroId,
                        camioneroNombre: movimiento?.camionero?.nombre || 'Sin camionero',
                        viajes: 0,
                        bruto: 0,
                        brutoLiquidacion: 0,
                        sueldo: 0,
                        adelantos: 0,
                        estadias: 0,
                        neto: 0,
                        combustibleLitros: 0,
                        combustibleImporte: 0,
                        cobrado: 0,
                        pendiente: 0
                    });
                }
            }

            let sueldosCamioneros = 0;
            const facturacionPorCamionero = Array.from(facturacionPorCamioneroMap.values())
                .filter((item) => isValidCamioneroId(item.camioneroId))
                .map((item) => {
                    const sueldo = Number((toNum(item.brutoLiquidacion) * 0.16).toFixed(2));
                    const adelantosTotal = Number((adelantosPorCamionero.get(item.camioneroId) || 0).toFixed(2));
                    const estadiasTotal = Number((estadiasPorCamionero.get(item.camioneroId) || 0).toFixed(2));
                    const combustible = combustiblePorCamionero.get(item.camioneroId) || { litros: 0, importe: 0 };
                    const neto = Number((sueldo - adelantosTotal + estadiasTotal).toFixed(2));

                    sueldosCamioneros += neto;

                    return {
                        ...item,
                        bruto: Number(item.bruto.toFixed(2)),
                        brutoLiquidacion: Number(toNum(item.brutoLiquidacion).toFixed(2)),
                        sueldo,
                        adelantos: adelantosTotal,
                        estadias: estadiasTotal,
                        neto,
                        combustibleLitros: Number((combustible.litros || 0).toFixed(2)),
                        combustibleImporte: Number((combustible.importe || 0).toFixed(2)),
                        cobrado: Number(item.cobrado.toFixed(2)),
                        pendiente: Number(item.pendiente.toFixed(2))
                    };
                })
                .sort((a, b) => b.bruto - a.bruto);

            const combustibleTotal = Array.from(combustiblePorCamionero.values())
                .reduce((sum, v) => sum + toNum(v.importe), 0);

            const facturacionPorCliente = Array.from(facturacionPorClienteMap.values())
                .map((item) => ({
                    ...item,
                    total: Number(item.total.toFixed(2)),
                    cobradas: Number(item.cobradas.toFixed(2)),
                    pendientes: Number(item.pendientes.toFixed(2))
                }))
                .sort((a, b) => b.total - a.total);

            const gastosSistema = {
                sueldosCamioneros: Number(sueldosCamioneros.toFixed(2)),
                combustible: Number(combustibleTotal.toFixed(2)),
                comisionesIntermediarios: Number(comisionesIntermediarios.toFixed(2))
            };
            const totalGastosSistema = Number((gastosSistema.sueldosCamioneros + gastosSistema.combustible + gastosSistema.comisionesIntermediarios).toFixed(2));
            const utilidadOperativa = Number((ingresosTotales - totalGastosSistema).toFixed(2));

            res.json({
                mes,
                rango: { from, to },
                resumen: {
                    ingresosTotales: Number(ingresosTotales.toFixed(2)),
                    ingresosCobrados: Number(ingresosCobrados.toFixed(2)),
                    ingresosPendientes: Number(ingresosPendientes.toFixed(2)),
                    totalGastosSistema,
                    utilidadOperativa
                },
                gastosSistema,
                facturacionPorCamionero,
                facturacionPorCliente,
                indicadores: {
                    cantidadViajesFinalizados: viajes.length,
                    cantidadCamionerosConMovimiento: facturacionPorCamionero.length,
                    cantidadClientesFacturados: facturacionPorCliente.length
                }
            });
        } catch (e) {
            console.error('[finanzas/resumen-mensual] Error:', e?.message || e);
            res.status(500).json({ error: 'Error obteniendo resumen financiero mensual' });
        }
    }
);

export default router;