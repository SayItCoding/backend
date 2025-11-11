export function parseToSeconds(
  input: string | undefined,
  fallbackSec: number,
): number {
  if (!input) return fallbackSec;
  if (/^\d+$/.test(input)) return Number(input); // "3600"
  const m = input.match(/^(\d+)([smhd])$/); // "1h", "30m", ...
  if (!m) return fallbackSec;
  const n = Number(m[1]);
  const unit = m[2];
  const mult =
    unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
  return n * mult; // 초 단위로 변환
}
