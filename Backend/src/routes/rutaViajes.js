
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { body, param, query, validationResult } from 'express-validator';
import sequelize from '../config/db.js';
import { Op } from 'sequelize';
import Viaje from '../models/Viajes.js';
import Usuario from '../models/Usuario.js';
import Camion from '../models/Camion.js';
import { getAll as getAllAcoplados, getById as getAcopladoById } from '../models/Acoplado.js';
import { authMiddleware, roleMiddleware } from '../middlewares/authMiddleware.js';
import Notificacion from '../models/Notificacion.js';
import { sendEmailToCEO, sendEmailToCamioneros, sendEmail } from '../services/emailService.js';
// (Se eliminó soporte WhatsApp)

const router = Router();

// Configuración de subida de archivos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const id = req.params.id || 'general';
        const dir = path.resolve('uploads', 'viajes', String(id));
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const base = file.fieldname === 'file' ? 'factura' : 'remito';
        cb(null, `${base}_${Date.now()}${ext}`);
    }
});
const upload = multer({ storage });

// Obtener viajes (ceo/administracion ven todos; camionero ve disponibles/asignados)
router.get('/', authMiddleware, [
    query('estado').optional().isString(),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('sortBy').optional().isIn(['id', 'fecha', 'estado']),
    query('order').optional().isIn(['ASC', 'DESC'])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || '10', 10);
        const offset = (page - 1) * limit;
        const sortBy = req.query.sortBy || 'id';
        const order = (req.query.order || 'ASC').toUpperCase();
        const estado = req.query.estado;
        const where = {};
        if (estado) where.estado = estado;
        // Restricción por rol
        if (req.user.rol !== 'ceo' && req.user.rol !== 'administracion') {
            if (estado === 'pendiente') {
                where.estado = 'pendiente';
            } else {
                where.camioneroId = req.user.id;
            }
        }
        // Filtro por fechas
        if (req.query.from || req.query.to) {
            where.fecha = {};
            if (req.query.from) where.fecha[Op.gte] = new Date(req.query.from);
            if (req.query.to) {
                // Incluir todo el día final añadiendo 23:59:59 para evitar excluir viajes del último día
                const endDate = new Date(req.query.to);
                endDate.setHours(23, 59, 59, 999);
                where.fecha[Op.lte] = endDate;
            }
        }
        const { rows, count } = await Viaje.findAndCountAll({
            where,
            limit,
            offset,
            order: [[sortBy, order]],
            include: [
                { model: Camion, as: 'camion', attributes: ['id', 'patente', 'marca', 'modelo', 'anio'] },
                { model: Usuario, as: 'camionero', attributes: ['id', 'nombre', 'email'] }
            ]
        });
        // Adjuntar patente de acoplado sin N+1: cargar todos y mapear
        let acopladoMap = new Map();
        try {
            const acs = await getAllAcoplados();
            acopladoMap = new Map(acs.map(a => [a.id, a.patente]));
        } catch { /* noop */ }
        const data = rows.map(v => ({
            ...v.toJSON?.() || v,
            acopladoPatente: v.acopladoId ? (acopladoMap.get(v.acopladoId) || null) : null,
        }));
        res.json({ data, page, limit, total: count });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener viajes' });
    }
});

// Eliminar TODOS los viajes (solo CEO) para limpiar historial
router.delete('/',
    authMiddleware,
    roleMiddleware(['ceo']),
    async (req, res) => {
        try {
            const eliminados = await Viaje.destroy({ where: {} });
            res.json({ ok: true, eliminados });
        } catch (error) {
            res.status(500).json({ error: 'Error al eliminar todos los viajes' });
        }
    }
);

// Crear viaje (solo ceo)
router.post('/',
    authMiddleware,
    roleMiddleware(['ceo']),
    [
        body('origen').isString().notEmpty(),
        body('destino').isString().notEmpty(),
        body('fecha').isISO8601(),
        body('camionId').isInt(),
        body('acopladoId').optional().isInt(),
        body('tipoMercaderia').optional().isString().isLength({ min: 2, max: 120 }),
        body('cliente').optional().isString().isLength({ min: 2, max: 120 }),
        body('precioTonelada').optional().isFloat({ min: 0 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const payload = { ...req.body, estado: 'pendiente' };
            const nuevoViaje = await Viaje.create(payload);

            // (Eliminado: antes se disparaba broadcast WhatsApp y notificación resumen)
            res.status(201).json(nuevoViaje);

            // Aviso por email solo al camionero asignado al camión
            try {
                let camPatente = '';
                let camioneroEmail = '';
                let camioneroNombre = '';
                try {
                    const cam = await Camion.findByPk(nuevoViaje.camionId);
                    camPatente = cam?.patente || '';
                    // Buscar camionero asignado al camión
                    if (cam && cam.id) {
                        const camionero = await Usuario.findOne({ where: { rol: 'camionero', id: cam.camioneroId } });
                        camioneroEmail = camionero?.email || '';
                        camioneroNombre = camionero?.nombre || '';
                    }
                } catch { }
                if (camioneroEmail) {
                    const subject = `Nuevo viaje asignado a tu camión #${nuevoViaje.id} ${nuevoViaje.origen} -> ${nuevoViaje.destino}`;
                    const partes = [
                        `Hola ${camioneroNombre || 'Camionero'}, se publicó un nuevo viaje para tu camión.`,
                        `Ruta: ${nuevoViaje.origen} -> ${nuevoViaje.destino}`,
                        `Fecha: ${new Date(nuevoViaje.fecha).toLocaleDateString()}`,
                    ];
                    if (camPatente) partes.push(`Camión: ${camPatente}`);
                    if (nuevoViaje.cliente) partes.push(`Cliente: ${nuevoViaje.cliente}`);
                    if (nuevoViaje.tipoMercaderia) partes.push(`Tipo: ${nuevoViaje.tipoMercaderia}`);
                    partes.push('Ingresá al panel para tomarlo.');
                    const text = partes.join('\n');
                    // Enviar email solo al camionero asignado
                    const result = await sendEmail({ to: camioneroEmail, subject, text });
                    console.log('[viajes] Email a camionero:', {
                        to: camioneroEmail,
                        subject,
                        simulated: !!result?.simulated,
                        messageId: result?.messageId || null,
                        error: result?.error || null
                    });
                }
            } catch { }
        } catch (error) {
            res.status(500).json({ error: 'Error al crear viaje' });
        }
    });

// Tomar viaje (camionero lo asigna y cambia estado a "en curso")
router.patch('/:id/tomar',
    authMiddleware,
    roleMiddleware(['camionero']),
    [param('id').isInt()],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        let viajeFinal = null;
        let camioneroInfo = null;
        try {
            await sequelize.transaction(async (t) => {
                const viaje = await Viaje.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
                if (!viaje || viaje.estado !== 'pendiente') throw { status: 400, message: 'Viaje no disponible' };
                // Obtener datos reales del camionero (el token sólo trae id y rol)
                camioneroInfo = await Usuario.findByPk(req.user.id, { transaction: t, attributes: ['id', 'nombre', 'email'] });
                const camioneroNombre = camioneroInfo?.nombre || 'Camionero';
                const camioneroEmail = camioneroInfo?.email || '';
                viaje.estado = 'en curso';
                viaje.camioneroId = req.user.id;
                viaje.camioneroNombre = camioneroNombre;
                viaje.camioneroEmail = camioneroEmail;
                await viaje.save({ transaction: t });
                // Obtener datos del camión para enriquecer notificación
                let camPatente = '';
                try {
                    const cam = await Camion.findByPk(viaje.camionId, { transaction: t });
                    camPatente = cam?.patente || '';
                } catch { }
                const notifMsg = `Camionero ${camioneroNombre} tomó viaje #${viaje.id} ${viaje.origen} -> ${viaje.destino}`
                    + (camPatente ? ` | Camión: ${camPatente}` : '')
                    + (viaje.cliente ? ` | Cliente: ${viaje.cliente}` : '')
                    + (viaje.tipoMercaderia ? ` | Tipo: ${viaje.tipoMercaderia}` : '');
                await Notificacion.create({
                    tipo: 'viaje_tomado',
                    mensaje: notifMsg,
                }, { transaction: t });
                viajeFinal = viaje;
            });
        } catch (error) {
            if (error?.status === 400) return res.status(400).json({ error: error.message });
            return res.status(500).json({ error: 'Error al tomar viaje' });
        }
        // Envío de correo (fuera de la transacción para no bloquear commit si falla)
        if (viajeFinal) {
            let camPat = '';
            try { const cam = await Camion.findByPk(viajeFinal.camionId); camPat = cam?.patente || ''; } catch { }
            const camioneroNombre = camioneroInfo?.nombre || viajeFinal.camioneroNombre || 'Camionero';
            const partes = [
                `El camionero ${camioneroNombre} tomó el viaje #${viajeFinal.id}`,
                `Ruta: ${viajeFinal.origen} -> ${viajeFinal.destino}`,
                `Fecha: ${new Date(viajeFinal.fecha).toLocaleString()}`,
            ];
            if (camPat) partes.push(`Camión: ${camPat}`);
            if (viajeFinal.cliente) partes.push(`Cliente: ${viajeFinal.cliente}`);
            if (viajeFinal.tipoMercaderia) partes.push(`Tipo: ${viajeFinal.tipoMercaderia}`);
            const texto = partes.join('\n');
            const subject = `Viaje #${viajeFinal.id} tomado por ${camioneroNombre}`;
            sendEmailToCEO({ subject, text: texto }).catch(() => { /* silencioso */ });
        }
        res.json(viajeFinal);
    });

// Finalizar viaje (camionero actualiza km, combustible y estado)
router.patch('/:id/finalizar',
    authMiddleware,
    // Permitir que el camionero finalice su propio viaje y que el CEO/Administración pueda finalizar desde su panel
    roleMiddleware(['camionero', 'ceo', 'administracion']),
    [param('id').isInt(), body('km').isInt({ min: 0 }), body('combustible').isFloat({ min: 0 }), body('kilosCargados').optional().isFloat({ min: 0 })],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const viaje = await Viaje.findByPk(req.params.id);
            const isManager = req.user.rol === 'ceo' || req.user.rol === 'administracion';
            const estadoPermitido = isManager ? ['en curso', 'pendiente'] : ['en curso'];
            if (!viaje || !estadoPermitido.includes(viaje.estado)) {
                return res.status(400).json({ error: 'Viaje no válido o no está en curso/pendiente' });
            }
            // Si es camionero, solo puede finalizar su propio viaje
            if (req.user.rol === 'camionero' && viaje.camioneroId !== req.user.id) {
                return res.status(400).json({ error: 'No autorizado' });
            }
            viaje.estado = 'finalizado';
            viaje.km = req.body.km;
            viaje.combustible = req.body.combustible;
            if (req.body.kilosCargados !== undefined) viaje.kilosCargados = req.body.kilosCargados;
            // Calcular importe si hay precioTonelada y kilosCargados
            if (viaje.precioTonelada && viaje.kilosCargados) {
                const toneladas = Number(viaje.kilosCargados) / 1000;
                const total = toneladas * Number(viaje.precioTonelada);
                viaje.importe = Number(total.toFixed(2));
            }
            // Si por alguna razón no quedó seteado al tomar, persistimos los datos del camionero aquí
            if (!viaje.camioneroNombre) viaje.camioneroNombre = req.user?.nombre;
            if (!viaje.camioneroEmail) viaje.camioneroEmail = req.user?.email;
            // Registro de confirmación final
            viaje.finalizadoConfirmadoPor = req.user.id;
            viaje.finalizadoConfirmadoAt = new Date();
            await viaje.save();
            res.json(viaje);
        } catch (error) {
            res.status(500).json({ error: 'Error al finalizar viaje' });
        }
    });

// Liquidación mensual del camionero (autenticado)
router.get('/liquidacion',
    authMiddleware,
    roleMiddleware(['camionero']),
    [query('mes').isString().matches(/^\d{4}-\d{2}$/), query('adelanto').optional().isFloat({ min: 0 })],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const { mes } = req.query; // YYYY-MM
            const adelanto = Number(req.query.adelanto || 0);
            const [year, month] = mes.split('-').map(n => parseInt(n, 10));
            const desde = new Date(year, month - 1, 1);
            const hasta = new Date(year, month, 0); // último día del mes
            // DATEONLY strings
            const desdeStr = `${desde.getFullYear()}-${String(desde.getMonth() + 1).padStart(2, '0')}-${String(desde.getDate()).padStart(2, '0')}`;
            const hastaStr = `${hasta.getFullYear()}-${String(hasta.getMonth() + 1).padStart(2, '0')}-${String(hasta.getDate()).padStart(2, '0')}`;

            const viajes = await Viaje.findAll({
                where: {
                    camioneroId: req.user.id,
                    estado: 'finalizado',
                    fecha: { [Op.between]: [desdeStr, hastaStr] }
                },
                attributes: ['id', 'fecha', 'origen', 'destino', 'kilosCargados', 'precioTonelada', 'importe']
            });
            const bruto = viajes.reduce((sum, v) => sum + Number(v.importe || 0), 0);
            const sueldo = Number((bruto * 0.16).toFixed(2));
            const neto = Number((sueldo - adelanto).toFixed(2));
            res.json({ mes, camioneroId: req.user.id, bruto, porcentaje: 0.16, sueldo, adelanto, neto, viajes });
        } catch (e) {
            res.status(500).json({ error: 'Error al calcular liquidación' });
        }
    }
);

// Cancelar viaje tomado (camionero devuelve a pendiente)
router.patch('/:id/cancelar',
    authMiddleware,
    roleMiddleware(['camionero']),
    [param('id').isInt()],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const viaje = await Viaje.findByPk(req.params.id);
            if (!viaje || viaje.estado !== 'en curso' || viaje.camioneroId !== req.user.id) return res.status(400).json({ error: 'No autorizado o viaje no válido' });
            viaje.estado = 'pendiente';
            viaje.camioneroId = null;
            await viaje.save();
            res.json(viaje);
        } catch (error) {
            res.status(500).json({ error: 'Error al cancelar viaje' });
        }
    });

// Reporte de viajes (solo ceo)
router.get('/reporte', authMiddleware, roleMiddleware(['ceo']), async (req, res) => {
    try {
        const viajes = await Viaje.findAll();
        res.json(viajes);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener reporte' });
    }
});

// Subir factura (ceo/administracion)
router.post('/:id/factura',
    authMiddleware,
    roleMiddleware(['ceo', 'administracion']),
    [param('id').isInt()],
    upload.single('file'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const viaje = await Viaje.findByPk(req.params.id);
            if (!viaje) return res.status(404).json({ error: 'Viaje no encontrado' });
            let url = viaje.facturaUrl;
            if (req.file) {
                const rel = `viajes/${req.params.id}/${req.file.filename}`;
                url = rel;
            }
            viaje.facturaUrl = url;
            if (req.body.fechaFactura) viaje.fechaFactura = new Date(req.body.fechaFactura);
            if (req.body.facturaEstado) viaje.facturaEstado = req.body.facturaEstado;
            // Calcular y persistir importe a partir de precioUnitario (+ IVA opcional)
            if (req.body.precioUnitario !== undefined) {
                const precioUnitario = parseFloat(String(req.body.precioUnitario));
                const conIVA = String(req.body.conIVA || '').toLowerCase() === 'true';
                if (!isNaN(precioUnitario) && precioUnitario >= 0) {
                    const factorIVA = conIVA ? 1.21 : 1.0;
                    const total = Number((precioUnitario * factorIVA).toFixed(2));
                    viaje.importe = total;
                }
            }
            await viaje.save();
            res.json(viaje);
        } catch (e) {
            res.status(500).json({ error: 'Error al subir factura' });
        }
    }
);

// Subir remitos (múltiples)
router.post('/:id/remitos',
    authMiddleware,
    roleMiddleware(['ceo', 'administracion']),
    [param('id').isInt()],
    upload.array('files', 10),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const viaje = await Viaje.findByPk(req.params.id);
            if (!viaje) return res.status(404).json({ error: 'Viaje no encontrado' });
            const existing = viaje.remitosJson ? JSON.parse(viaje.remitosJson) : [];
            const added = (req.files || []).map(f => `/uploads/viajes/${req.params.id}/${f.filename}`);
            viaje.remitosJson = JSON.stringify([...existing, ...added]);
            await viaje.save();
            res.json(viaje);
        } catch (e) {
            res.status(500).json({ error: 'Error al subir remitos' });
        }
    }
);

// Actualizar estado/fecha de factura
router.patch('/:id/factura',
    authMiddleware,
    roleMiddleware(['ceo', 'administracion']),
    [param('id').isInt(), body('facturaEstado').optional().isString(), body('fechaFactura').optional().isISO8601(), body('precioUnitario').optional().isFloat({ min: 0 }), body('conIVA').optional().isBoolean()],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const viaje = await Viaje.findByPk(req.params.id);
            if (!viaje) return res.status(404).json({ error: 'Viaje no encontrado' });
            if (req.body.facturaEstado) viaje.facturaEstado = req.body.facturaEstado;
            if (req.body.fechaFactura) viaje.fechaFactura = new Date(req.body.fechaFactura);
            // Calcular y persistir importe si se envía precioUnitario (con IVA opcional)
            if (req.body.precioUnitario !== undefined) {
                const precioUnitario = parseFloat(String(req.body.precioUnitario));
                const conIVA = (req.body.conIVA === true) || (String(req.body.conIVA).toLowerCase() === 'true');
                if (!isNaN(precioUnitario) && precioUnitario >= 0) {
                    const factorIVA = conIVA ? 1.21 : 1.0;
                    const total = Number((precioUnitario * factorIVA).toFixed(2));
                    viaje.importe = total;
                }
            }
            await viaje.save();
            res.json(viaje);
        } catch (e) {
            res.status(500).json({ error: 'Error al actualizar factura' });
        }
    }
);

// Chequear facturas vencidas (>30 días sin cobrar) y notificar (ceo/administracion)
router.post('/checkVencidas', authMiddleware, roleMiddleware(['ceo', 'administracion']), async (req, res) => {
    try {
        const all = await Viaje.findAll();
        const now = Date.now();
        let created = 0;
        let actualizadas = 0;
        for (const v of all) {
            const fechaBase = v.fechaFactura || v.fecha;
            const estado = (v.facturaEstado || 'pendiente').toLowerCase();
            if (fechaBase && estado !== 'cobrada') {
                const days = Math.floor((now - new Date(fechaBase).getTime()) / (1000 * 60 * 60 * 24));
                if (days > 30) {
                    if (estado !== 'vencida') { v.facturaEstado = 'vencida'; actualizadas++; }
                    if (!v.facturaNotificadaVencida) {
                        await Notificacion.create({
                            tipo: 'factura_vencida',
                            mensaje: `Factura vencida del viaje #${v.id} (${v.cliente || 'Cliente desconocido'})`,
                        });
                        v.facturaNotificadaVencida = true;
                        created++;
                    }
                    await v.save();
                }
            }
        }
        res.json({ notificacionesCreadas: created, facturasMarcadasVencidas: actualizadas });
    } catch (e) {
        res.status(500).json({ error: 'Error al chequear vencidas' });
    }
});

// Backfill de nombres de camionero en viajes históricos (ceo/administracion)
router.post('/backfillCamioneros', authMiddleware, roleMiddleware(['ceo', 'administracion']), async (req, res) => {
    try {
        const afectados = [];
        const viajes = await Viaje.findAll({ where: { camioneroId: { [Op.ne]: null } } });
        for (const v of viajes) {
            if (!v.camioneroNombre || !v.camioneroEmail) {
                const u = await Usuario.findByPk(v.camioneroId);
                if (u) {
                    v.camioneroNombre = v.camioneroNombre || u.nombre;
                    v.camioneroEmail = v.camioneroEmail || u.email;
                    await v.save();
                    afectados.push(v.id);
                }
            }
        }
        res.json({ actualizados: afectados.length, ids: afectados });
    } catch (e) {
        res.status(500).json({ error: 'Error al completar nombres de camionero' });
    }
});
// Detalle de viaje (solo ceo)
router.get('/:id',
    authMiddleware,
    roleMiddleware(['ceo']),
    [param('id').isInt()],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const viaje = await Viaje.findByPk(req.params.id, {
                include: [
                    { model: Camion, as: 'camion', attributes: ['id', 'patente', 'marca', 'modelo', 'anio'] },
                    { model: Usuario, as: 'camionero', attributes: ['id', 'nombre', 'email'] }
                ]
            });
            if (!viaje) return res.status(404).json({ error: 'Viaje no encontrado' });
            let acopladoPatente = null;
            try { if (viaje.acopladoId) { const ac = await getAcopladoById(viaje.acopladoId); acopladoPatente = ac?.patente || null; } } catch { }
            const json = viaje.toJSON?.() || viaje;
            res.json({ ...json, acopladoPatente });
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener detalle' });
        }
    });

// Liberar viaje (ceo fuerza que un viaje en curso vuelva a pendiente)
router.patch('/:id/liberar',
    authMiddleware,
    roleMiddleware(['ceo']),
    [param('id').isInt()],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const viaje = await Viaje.findByPk(req.params.id);
            if (!viaje || viaje.estado !== 'en curso') return res.status(400).json({ error: 'Viaje no está en curso' });
            viaje.estado = 'pendiente';
            viaje.camioneroId = null;
            await viaje.save();
            res.json(viaje);
        } catch (error) {
            res.status(500).json({ error: 'Error al liberar viaje' });
        }
    });

// Descargar factura subida
router.get('/:id/factura/download',
    authMiddleware,
    roleMiddleware(['ceo', 'administracion']),
    [param('id').isInt()],
    async (req, res) => {
        try {
            const viaje = await Viaje.findByPk(req.params.id);
            if (!viaje || !viaje.facturaUrl) return res.status(404).json({ error: 'Factura no encontrada' });

            const filePath = path.resolve(process.cwd(), 'uploads', viaje.facturaUrl);

            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'Archivo no existe en el servidor' });
            }

            res.download(filePath, `factura_${viaje.id}.pdf`);
        } catch (e) {
            res.status(500).json({ error: 'Error al descargar factura' });
        }
    }
);

export default router;
// Editar viaje (solo ceo; permitido solo si está pendiente)
router.patch('/:id',
    authMiddleware,
    roleMiddleware(['ceo']),
    [
        param('id').isInt(),
        body('origen').optional().isString().isLength({ min: 2, max: 120 }),
        body('destino').optional().isString().isLength({ min: 2, max: 120 }),
        body('fecha').optional().isISO8601(),
        body('camionId').optional().isInt(),
        body('acopladoId').optional({ nullable: true }).isInt(),
        body('tipoMercaderia').optional({ nullable: true }).isString().isLength({ min: 2, max: 120 }),
        body('cliente').optional({ nullable: true }).isString().isLength({ min: 2, max: 120 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const viaje = await Viaje.findByPk(req.params.id);
            if (!viaje) return res.status(404).json({ error: 'Viaje no encontrado' });
            if (viaje.estado !== 'pendiente') return res.status(400).json({ error: 'Solo se puede editar viajes pendientes' });
            const fields = ['origen', 'destino', 'fecha', 'camionId', 'acopladoId', 'tipoMercaderia', 'cliente'];
            for (const f of fields) {
                if (req.body.hasOwnProperty(f)) viaje[f] = req.body[f] ?? null;
            }
            await viaje.save();
            res.json(viaje);
        } catch (e) {
            res.status(500).json({ error: 'Error al editar viaje' });
        }
    }
);

// Eliminar viaje (solo ceo; permitido solo si está pendiente)
router.delete('/:id',
    authMiddleware,
    roleMiddleware(['ceo']),
    [param('id').isInt()],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const viaje = await Viaje.findByPk(req.params.id);
            if (!viaje) return res.status(404).json({ error: 'Viaje no encontrado' });
            if (viaje.estado !== 'pendiente') return res.status(400).json({ error: 'Solo se puede eliminar viajes pendientes' });
            await viaje.destroy();
            res.json({ ok: true });
        } catch (e) {
            res.status(500).json({ error: 'Error al eliminar viaje' });
        }
    }
);
