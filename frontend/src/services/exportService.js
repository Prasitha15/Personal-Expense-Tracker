import api from './api';

/**
 * Download an export file from the backend.
 * Uses the Axios instance so the Authorization header is automatically included.
 *
 * @param {'expenses'|'incomes'} resource  – which API resource to export
 * @param {'csv'|'excel'|'pdf'}  format    – export format
 * @param {Object}               filters   – current filter params to forward
 */
export async function downloadExport(resource, format, filters = {}) {
  const endpoint = `/api/${resource}/export-${format}/`;

  // Strip empty / undefined values so they don't pollute the query string
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== '' && v !== undefined && v !== null)
  );

  const mimeTypes = {
    csv:   'text/csv',
    excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pdf:   'application/pdf',
  };

  const extensions = { csv: '.csv', excel: '.xlsx', pdf: '.pdf' };

  const response = await api.get(endpoint, {
    params,
    responseType: 'blob',
  });

  // Derive filename from Content-Disposition header or build a fallback
  const disposition = response.headers['content-disposition'] || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : `${resource}_export${extensions[format]}`;

  // Create an object URL and click-trigger the download
  const blob = new Blob([response.data], { type: mimeTypes[format] });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
