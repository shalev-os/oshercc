export function downloadFile(content, type, filename) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const download = document.createElement("a");
  download.href = url;
  download.download = filename;
  download.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
