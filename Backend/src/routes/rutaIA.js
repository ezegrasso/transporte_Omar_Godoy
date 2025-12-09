import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middlewares/authMiddleware.js';
import { generateCompletion, isClaudeSonnetEnabled, summarizeText } from '../services/aiClient.js';
import { body, param, validationResult } from 'express-validator';
import { Op } from 'sequelize';
import Viaje from '../models/Viajes.js';
import Camion from '../models/Camion.js';
import Usuario from '../models/Usuario.js';

const router = Router();

// Estado del modelo IA
router.get('/status', authMiddleware, (req, res) => {
    res.json({
        model: 'claude-sonnet-4.5',
        enabled: isClaudeSonnetEnabled()
    });
});

// Generar completion (todos los roles autenticados). Se puede restringir luego.
router.post('/completion',
    authMiddleware,
    body('prompt').isString().isLength({ min: 5, max: 5000 }),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const { prompt } = req.body;
            const out = await generateCompletion({ prompt });
            res.json(out);
        } catch (e) {
            res.status(400).json({ error: e.message });
        }
    }
);

// Resumen de un viaje por ID
router.post('/resumen/viaje/:id',
    authMiddleware,
    param('id').isInt(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const v = await Viaje.findByPk(req.params.id, {
                include: [
                    { model: Camion, as: 'camion', attributes: ['patente', 'marca', 'modelo', 'anio'] },
                    { model: Usuario, as: 'camionero', attributes: ['nombre', 'email'] }
                ]
            });
            if (!v) return res.status(404).json({ error: 'Viaje no encontrado' });
            const texto = `Resumen en español claro y conciso del viaje con campos destacados (origen, destino, fecha, cliente, tipo de mercadería, camión, camionero, estado, factura y remitos):\n` +
                `ID: ${v.id}\n` +
                `Fecha: ${new Date(v.fecha).toISOString()}\n` +
                `Origen: ${v.origen}\nDestino: ${v.destino}\n` +
                `Cliente: ${v.cliente || '-'}\nTipo mercadería: ${v.tipoMercaderia || '-'}\n` +
                `Camión: ${v.camion?.patente || v.camionId} ${v.camion?.marca || ''} ${v.camion?.modelo || ''} ${v.camion?.anio || ''}\n` +
                `Camionero: ${v.camionero?.nombre || v.camioneroNombre || '-'}\n` +
                `Estado: ${v.estado}\n` +
                `Factura: ${v.facturaUrl ? 'sí' : 'no'} | Estado factura: ${v.facturaEstado || '-'} | Fecha factura: ${v.fechaFactura ? new Date(v.fechaFactura).toISOString() : '-'}\n` +
                `Remitos: ${(function () { try { return (JSON.parse(v.remitosJson || '[]') || []).length } catch { return 0 } })()} items.`;
            const out = await summarizeText(texto);
            res.json(out);
        } catch (e) {
            res.status(400).json({ error: e.message });
        }
    }
);

// Resumen de un periodo por fechas
router.post('/resumen/periodo',
    authMiddleware,
    body('from').isISO8601(),
    body('to').isISO8601(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const from = new Date(req.body.from);
            const to = new Date(req.body.to);
            to.setHours(23, 59, 59, 999);
            const where = { fecha: { [Op.gte]: from, [Op.lte]: to } };
            const list = await Viaje.findAll({ where, include: [{ model: Camion, as: 'camion', attributes: ['patente'] }] });
            const header = `Resumir en español claro el siguiente conjunto de ${list.length} viajes (agrega totales por estado y observaciones relevantes):`;
            const lines = list.map(v => `#${v.id} ${new Date(v.fecha).toISOString()} ${v.origen} -> ${v.destino} | Estado: ${v.estado} | Cliente: ${v.cliente || '-'} | Tipo: ${v.tipoMercaderia || '-'} | Camión: ${v.camion?.patente || v.camionId}`);
            const prompt = `${header}\n${lines.join('\n')}`;
            const out = await summarizeText(prompt);
            res.json(out);
        } catch (e) {
            res.status(400).json({ error: e.message });
        }
    }
);

// Normalizar texto libre a JSON de campos
router.post('/normalizar',
    authMiddleware,
    body('texto').isString().isLength({ min: 10 }),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const { texto } = req.body;
            const prompt = `A partir del siguiente texto de remito/factura, devuelve SOLO un JSON válido con estas claves si están presentes: {\n"cliente": string, "tipoMercaderia": string, "origen": string, "destino": string, "fechaISO": string (YYYY-MM-DD), "observaciones": string\n}\nTexto:\n${texto}`;
            const out = await generateCompletion({ prompt });
            let parsed = null;
            try { parsed = JSON.parse(out.output); } catch { }
            res.json({ raw: out.output, parsed });
        } catch (e) {
            res.status(400).json({ error: e.message });
        }
    }
);

export default router;