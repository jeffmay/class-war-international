import { encodeHostID, decodeHostID } from "./hostEncoding";

// ─── Round-trip helpers ───────────────────────────────────────────────────────

function roundTrip(server: string): string {
  return decodeHostID(encodeHostID(server));
}

// ─── IPv4 ─────────────────────────────────────────────────────────────────────

describe("IPv4 encoding", () => {
  test("encodes with '4' prefix", () => {
    expect(encodeHostID("http://192.168.1.5:8000")).toMatch(/^4/);
  });

  test("round-trips common LAN address", () => {
    expect(roundTrip("http://192.168.1.5:8000")).toBe("http://192.168.1.5:8000");
  });

  test("round-trips loopback", () => {
    expect(roundTrip("http://127.0.0.1:5173")).toBe("http://127.0.0.1:5173");
  });

  test("round-trips address with non-default port", () => {
    expect(roundTrip("http://10.0.0.1:9999")).toBe("http://10.0.0.1:9999");
  });

  test("round-trips max address 255.255.255.255", () => {
    expect(roundTrip("http://255.255.255.255:65535")).toBe("http://255.255.255.255:65535");
  });

  test("encoded form is shorter than the original server string", () => {
    const server = "http://192.168.1.100:8000";
    expect(encodeHostID(server).length).toBeLessThan(server.length);
  });

  test("encoded form contains no URL-unsafe base64 chars (+ or /)", () => {
    const encoded = encodeHostID("http://192.168.1.5:8000");
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
  });
});

// ─── IPv6 ─────────────────────────────────────────────────────────────────────

describe("IPv6 encoding", () => {
  test("encodes with '6' prefix", () => {
    expect(encodeHostID("http://[::1]:8000")).toMatch(/^6/);
  });

  test("round-trips loopback ::1", () => {
    expect(roundTrip("http://[::1]:8000")).toBe("http://[0:0:0:0:0:0:0:1]:8000");
  });

  test("round-trips full address", () => {
    expect(roundTrip("http://[2001:db8::1]:8080")).toBe(
      "http://[2001:db8:0:0:0:0:0:1]:8080",
    );
  });

  test("encoded form contains no URL-unsafe chars", () => {
    const encoded = encodeHostID("http://[::1]:8000");
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
  });
});

// ─── DNS / hostname ───────────────────────────────────────────────────────────

describe("DNS encoding", () => {
  test("encodes with '_' prefix", () => {
    expect(encodeHostID("http://localhost:8000")).toMatch(/^_/);
    expect(encodeHostID("http://mygame.example.com:8000")).toMatch(/^_/);
  });

  test("round-trips localhost", () => {
    expect(roundTrip("http://localhost:8000")).toBe("http://localhost:8000");
  });

  test("round-trips a domain name", () => {
    expect(roundTrip("http://mygame.example.com:9001")).toBe(
      "http://mygame.example.com:9001",
    );
  });

  test("localhost:8000 is human-readable in the encoded form", () => {
    const encoded = encodeHostID("http://localhost:8000");
    expect(encoded).toBe("_localhost:8000");
  });
});

// ─── decodeHostID error cases ─────────────────────────────────────────────────

describe("decodeHostID error handling", () => {
  test("throws on unknown type prefix", () => {
    expect(() => decodeHostID("Xabc")).toThrow();
  });

  test("throws on truncated IPv4 payload", () => {
    // Only 3 base64url chars → fewer than 6 bytes
    expect(() => decodeHostID("4abc")).toThrow();
  });

  test("throws on truncated IPv6 payload", () => {
    expect(() => decodeHostID("6abc")).toThrow();
  });
});
