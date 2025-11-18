// Servicio de IA centralizado.
// Actualmente implementa un flag para habilitar el modelo "Claude Sonnet 4.5".
// Reemplazar stubs con llamadas reales al proveedor (Anthropic) cuando se disponga de API Key.

import dotenv from 'dotenv';
dotenv.config();

const ENABLED = String(process.env.ENABLE_CLAUDE_SONNET_4_5 || '').toLowerCase() === 'true';

// Config básica del modelo
const MODEL_CONFIG = {
    name: 'claude-sonnet-4.5',
    maxTokens: 4096,
    temperature: 0.2
};

export function isClaudeSonnetEnabled() {
    return ENABLED;
}

export async function generateCompletion({ prompt }) {
    if (!ENABLED) {
        throw new Error('Claude Sonnet 4.5 no está habilitado (ENABLE_CLAUDE_SONNET_4_5=false).');
    }
    // Stub de respuesta simulada. Sustituir por llamada HTTP real.
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
