// utils/download.js
import axios from 'axios';

export async function downloadBatchExport(batchId, token) {
  const url = `http://localhost:5000/api/excelexports/batches/${batchId}/export`;
  const res = await axios.get(url, {
    headers: { Authorization: token ? `Bearer ${token}` : undefined },
    responseType: 'blob'
  });
  const blob = new Blob([res.data], { type: res.headers['content-type'] || 'application/octet-stream' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  // Attempt to extract filename from headers
  const disposition = (res.headers['content-disposition'] || '');
  const match = disposition.match(/filename="?(.+)"?/);
  const filename = match ? match[1] : `batch-${batchId}-submissions.xlsx`;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function downloadSubBatchExport(subbatchId, token) {
  const url = `http://localhost:5000/api/excelexports/subbatches/${subbatchId}/export`;
  const res = await axios.get(url, {
    headers: { Authorization: token ? `Bearer ${token}` : undefined },
    responseType: 'blob'
  });
  const blob = new Blob([res.data], { type: res.headers['content-type'] || 'application/octet-stream' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  const disposition = (res.headers['content-disposition'] || '');
  const match = disposition.match(/filename="?(.+)"?/);
  const filename = match ? match[1] : `subbatch-${subbatchId}-submissions.xlsx`;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
