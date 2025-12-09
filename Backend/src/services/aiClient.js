// Servicio de IA centralizado.
// Actualmente implementa un flag para habilitar el modelo "Claude Sonnet 4.5".
// Reemplazar stubs con llamadas reales al proveedor (Anthropic) cuando se disponga de API Key.

import dotenv from 'dotenv';
dotenv.config();

// Forzado: habilitado para todos los clientes sin depender de variable de entorno.
// Si se desea volver al comportamiento anterior, reemplazar por:
// const ENABLED = String(process.env.ENABLE_CLAUDE_SONNET_4_5 || '').toLowerCase() === 'true';
const ENABLED = true;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL_ID = process.env.ANTHROPIC_MODEL_ID || 'claude-3-5-sonnet-20241022';

// Config básica del modelo
const MODEL_CONFIG = {
    name: 'claude-sonnet-4.5', // nombre "amigable" interno
    maxTokens: 4096,
    temperature: 0.2
};

// Cliente Anthropic opcional (sólo si hay API key y la lib está instalada)
let anthropicClient = null;
if (ENABLED && ANTHROPIC_API_KEY) {
    try {
        const { default: Anthropic } = await import('anthropic');
        anthropicClient = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    } catch (e) {
        console.warn('[aiClient] Anthropic no disponible (instala con: npm install anthropic) -> usando simulación');
    }
}

export function isClaudeSonnetEnabled() {
    // Siempre true por política actual de habilitación global
    return true;
}

export async function generateCompletion({ prompt }) {
    // Ya no se bloquea por flag; siempre disponible (simulado si no hay API real)
    // Si hay cliente real, intentar con Anthropic
    if (anthropicClient) {
        try {
            const resp = await anthropicClient.messages.create({
                model: ANTHROPIC_MODEL_ID,
                max_tokens: MODEL_CONFIG.maxTokens,
                temperature: MODEL_CONFIG.temperature,
                messages: [
                    { role: 'user', content: prompt }
                ]
            });
            let text = '';
            try {
                const first = Array.isArray(resp?.content) ? resp.content[0] : null;
                text = first?.text ?? first?.content ?? '';
            } catch { }
            return {
                model: MODEL_CONFIG.name,
                providerModelId: ANTHROPIC_MODEL_ID,
                prompt,
                output: text || '[VACÍO]',
                meta: {
                    provider: 'anthropic',
                    id: resp?.id,
                    usage: resp?.usage
                }
            };
        } catch (e) {
            console.warn('[aiClient] Error Anthropic, devolviendo simulación:', e?.message || e);
        }
    }
    // Simulación si no hay cliente o falló la llamada
    return {
        model: MODEL_CONFIG.name,
        prompt,
        output: `[SIMULADO] Respuesta generada para: ${prompt.slice(0, 80)}`,
        meta: {
            tokensEstimated: Math.min(Math.ceil(prompt.length / 4), MODEL_CONFIG.maxTokens),
            temperature: MODEL_CONFIG.temperature
        }
    };
}

// Ejemplo de función que podría integrarse en endpoints.
export async function summarizeText(text) {
    return generateCompletion({ prompt: `Resumir en español claro:\n${text}` });
}
