import { describe, it, expect, afterEach, vi } from "vitest";
import { parseMontoPYG, formatPYG, relativeDate, formatDate } from "./format";

describe("parseMontoPYG", () => {
  it("parsea enteros con separador de miles (punto)", () => {
    expect(parseMontoPYG("150.000")).toBe(150000);
    expect(parseMontoPYG("1.500.000")).toBe(1500000);
    expect(parseMontoPYG("1000000")).toBe(1000000);
  });

  it("ignora espacios", () => {
    expect(parseMontoPYG(" 150 000 ")).toBe(150000);
    expect(parseMontoPYG("2.500.000 ")).toBe(2500000);
  });

  it("rechaza decimales con coma (no válidos en PYG)", () => {
    expect(parseMontoPYG("150,5")).toBeNull();
    expect(parseMontoPYG("1.500,75")).toBeNull();
  });

  it("rechaza texto, vacío, null y undefined", () => {
    expect(parseMontoPYG("abc")).toBeNull();
    expect(parseMontoPYG("12ab")).toBeNull();
    expect(parseMontoPYG("")).toBeNull();
    expect(parseMontoPYG(null)).toBeNull();
    expect(parseMontoPYG(undefined)).toBeNull();
  });

  it("rechaza cero y negativos", () => {
    expect(parseMontoPYG("0")).toBeNull();
    expect(parseMontoPYG("-5000")).toBeNull();
  });
});

describe("formatPYG", () => {
  it("agrupa los miles con punto", () => {
    // El símbolo de moneda puede variar por entorno/ICU; verificamos el agrupado.
    expect(formatPYG(1500000)).toContain("1.500.000");
    expect(formatPYG(0)).toContain("0");
  });
});

describe("relativeDate", () => {
  afterEach(() => vi.useRealTimers());

  const isoHace = (dias: number, horas = 0) =>
    new Date(Date.now() - dias * 86_400_000 - horas * 3_600_000).toISOString();

  it("distingue Hoy / Ayer / días / semanas", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T12:00:00"));
    expect(relativeDate(isoHace(0, 2))).toBe("Hoy");
    expect(relativeDate(isoHace(1))).toBe("Ayer");
    expect(relativeDate(isoHace(3))).toBe("Hace 3 días");
    expect(relativeDate(isoHace(10))).toBe("Hace 1 sem.");
    expect(relativeDate(isoHace(20))).toBe("Hace 2 sem.");
  });

  it("para más de 30 días devuelve la fecha formateada", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T12:00:00"));
    const salida = relativeDate(isoHace(40));
    expect(salida).not.toMatch(/Hoy|Ayer|Hace/);
    expect(salida).toMatch(/2026/);
  });
});

describe("formatDate", () => {
  it("devuelve día, mes abreviado y año", () => {
    const salida = formatDate("2026-07-08T00:00:00");
    expect(salida).toMatch(/2026/);
    expect(salida).toMatch(/08|8/);
  });
});
