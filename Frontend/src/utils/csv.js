export function toCSVString(headers, rows) {
    const escape = (val) => {
        if (val == null) return '';
        const s = String(val);
        if (/[",\n]/.test(s)) {
            return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    };
    const headerLine = headers.map(h => escape(h)).join(',');
    const dataLines = rows.map(r => r.map(c => escape(c)).join(','));
    return [headerLine, ...dataLines].join('\n');
}

export function downloadCSV(filename, headers, rows) {
    const csv = toCSVString(headers, rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    if (a.parentNode) {
        a.parentNode.removeChild(a);
    }
    URL.revokeObjectURL(url);
}
