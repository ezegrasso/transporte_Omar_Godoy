// Configuración de branding y tarifas para PDFs y aplicación
export const companyBrand = {
    nombre: 'Omar Godoy Transporte',
    cuit: '00-00000000-0',
    direccion: 'Rio Segundo, Córdoba, Argentina',
    telefono: '+54 3572 406715',
    email: 'info@omargodoy.com.ar',
    // Logo Omar Godoy (camión + texto) - SVG vectorial embebido
    logoSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 768 768" width="120" height="120">
        <rect fill="#f5f5f0" width="768" height="768"/>
        <path fill="#1a3a52" d="M120,280 L580,280 L580,380 L120,380 Z M320,250 L400,250 L450,280 L320,280 Z M450,250 L520,280 L580,260 L580,320 L520,300 L450,330 Z"/>
        <circle fill="#1a3a52" cx="200" cy="400" r="35"/>
        <circle fill="#1a3a52" cx="280" cy="400" r="35"/>
        <circle fill="#1a3a52" cx="420" cy="400" r="35"/>
        <circle fill="#1a3a52" cx="500" cy="400" r="35"/>
        <circle fill="#f5f5f0" cx="200" cy="400" r="18"/>
        <circle fill="#f5f5f0" cx="280" cy="400" r="18"/>
        <circle fill="#f5f5f0" cx="420" cy="400" r="18"/>
        <circle fill="#f5f5f0" cx="500" cy="400" r="18"/>
        <text fill="#1a3a52" font-family="Arial, sans-serif" font-size="88" font-weight="bold" x="150" y="520">OMAR</text>
        <text fill="#1a3a52" font-family="Arial, sans-serif" font-size="88" font-weight="bold" x="150" y="600">GODOY</text>
    </svg>`,
    // Versión base64 PNG para compatibilidad jsPDF (optimizada)
    logoBase64: '../C:\Users\Eze\Desktop\Transporte Omar Godoy\Frontend\public\omar_godoy_logo_1mb.jpg',
    // Tarifas ajustables (actualiza según tus precios reales)
    tarifaKm: 250, // ARS por km
    tarifaCombustibleLitro: 1200, // ARS por litro
    moneda: 'ARS'
};
