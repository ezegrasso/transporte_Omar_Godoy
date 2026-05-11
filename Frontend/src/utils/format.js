// Capitalizar: primera letra mayúscula, resto minúsculas
export function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Capitalizar palabras separadas por espacios o guiones
export function capitalizeWords(str) {
    if (!str) return '';
    return str.split(/[\s-]+/).map(word => capitalize(word)).join(' ');
}
