export function formatDateLocal(d: Date): string {
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 0~11 이라 +1
  const day = d.getDate();

  const mm = month < 10 ? `0${month}` : `${month}`;
  const dd = day < 10 ? `0${day}` : `${day}`;

  return `${year}-${mm}-${dd}`; // YYYY-MM-DD (로컬 기준)
}
