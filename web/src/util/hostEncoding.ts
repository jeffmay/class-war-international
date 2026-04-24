/**
 * Encodes/decodes a server URL to/from a compact URL-safe host ID.
 *
 * The first character is a type prefix:
 *   '_' (0x5F) = DNS hostname — rest is encodeURI(host:port)
 *   '4' (0x34) = IPv4 address — rest is base64url([b0,b1,b2,b3,portHi,portLo])
 *   '6' (0x36) = IPv6 address — rest is base64url([...16 bytes, portHi, portLo])
 */

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const binary = atob(padded + "=".repeat(padLen));
  return new Uint8Array([...binary].map((c) => c.charCodeAt(0)));
}

function parseServerURL(server: string): { host: string; port: number } {
  const withoutScheme = server.replace(/^https?:\/\//, "");
  // IPv6 in brackets: [::1]:8000
  const ipv6M = /^\[([^\]]+)\]:(\d+)$/.exec(withoutScheme);
  if (ipv6M) return { host: ipv6M[1], port: parseInt(ipv6M[2], 10) };
  // IPv4 or DNS with port: host:port
  const lastColon = withoutScheme.lastIndexOf(":");
  if (lastColon >= 0) {
    const maybePort = parseInt(withoutScheme.slice(lastColon + 1), 10);
    if (!isNaN(maybePort)) {
      return { host: withoutScheme.slice(0, lastColon), port: maybePort };
    }
  }
  return { host: withoutScheme, port: 8000 };
}

function parseIPv4(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const bytes = parts.map(Number);
  if (bytes.some((b) => isNaN(b) || b < 0 || b > 255 || !Number.isInteger(b))) return null;
  return bytes;
}

function expandIPv6Groups(host: string): number[] | null {
  if (host.includes(":::")) return null;
  const halves = host.split("::");
  if (halves.length > 2) return null;

  const parseGroups = (s: string): number[] | null => {
    if (s === "") return [];
    const parts = s.split(":");
    const nums = parts.map((p) => parseInt(p, 16));
    if (nums.some((n) => isNaN(n) || n < 0 || n > 0xffff)) return null;
    return nums;
  };

  if (halves.length === 1) {
    const groups = parseGroups(halves[0]);
    if (!groups || groups.length !== 8) return null;
    return groups;
  }

  const left = parseGroups(halves[0]) ?? [];
  const right = parseGroups(halves[1]) ?? [];
  const missing = 8 - left.length - right.length;
  if (missing < 0) return null;
  return [...left, ...Array(missing).fill(0), ...right];
}

function parseIPv6(host: string): number[] | null {
  const groups = expandIPv6Groups(host);
  if (!groups) return null;
  const bytes: number[] = [];
  for (const g of groups) bytes.push((g >> 8) & 0xff, g & 0xff);
  return bytes;
}

export function encodeHostID(server: string): string {
  const { host, port } = parseServerURL(server);
  const portHi = (port >> 8) & 0xff;
  const portLo = port & 0xff;

  const ipv4 = parseIPv4(host);
  if (ipv4) {
    return "4" + toBase64Url(new Uint8Array([...ipv4, portHi, portLo]));
  }

  const ipv6 = parseIPv6(host);
  if (ipv6) {
    return "6" + toBase64Url(new Uint8Array([...ipv6, portHi, portLo]));
  }

  // DNS: encodeURI preserves colons and dots, making localhost:8000 readable
  return "_" + encodeURI(host + ":" + port);
}

export function decodeHostID(encoded: string): string {
  const type = encoded[0];
  const payload = encoded.slice(1);

  if (type === "4") {
    const bytes = fromBase64Url(payload);
    if (bytes.length < 6) throw new Error("Invalid IPv4 host ID");
    const ip = `${bytes[0]}.${bytes[1]}.${bytes[2]}.${bytes[3]}`;
    const port = (bytes[4] << 8) | bytes[5];
    return `http://${ip}:${port}`;
  }

  if (type === "6") {
    const bytes = fromBase64Url(payload);
    if (bytes.length < 18) throw new Error("Invalid IPv6 host ID");
    const groups: string[] = [];
    for (let i = 0; i < 16; i += 2) {
      groups.push(((bytes[i] << 8) | bytes[i + 1]).toString(16));
    }
    const port = (bytes[16] << 8) | bytes[17];
    return `http://[${groups.join(":")}]:${port}`;
  }

  if (type === "_") {
    return `http://${decodeURI(payload)}`;
  }

  throw new Error(`Unknown host ID type: ${JSON.stringify(type)}`);
}
