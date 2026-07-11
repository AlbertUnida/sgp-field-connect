import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// esErrorDeRed no usa supabase, pero el módulo importa supabaseClient
// (que llama createClient con env vars ausentes en test) → lo mockeamos.
vi.mock("./supabaseClient", () => ({ supabase: {} }));

import { esErrorDeRed } from "./offline-queue";

function setOnline(valor: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: valor });
}

describe("esErrorDeRed", () => {
  const original = navigator.onLine;
  afterEach(() => setOnline(original));

  it("es true si el navegador está offline, sin importar el error", () => {
    setOnline(false);
    expect(esErrorDeRed(new Error("duplicate key value"))).toBe(true);
    expect(esErrorDeRed(null)).toBe(true);
  });

  describe("con navegador online", () => {
    beforeEach(() => setOnline(true));

    it("detecta errores de red típicos del fetch", () => {
      expect(esErrorDeRed(new Error("Failed to fetch"))).toBe(true);
      expect(esErrorDeRed(new Error("NetworkError when attempting to fetch"))).toBe(true);
      expect(esErrorDeRed(new Error("Load failed"))).toBe(true);
      expect(esErrorDeRed(new Error("fetch failed"))).toBe(true);
    });

    it("detecta la red también en strings y objetos con message", () => {
      expect(esErrorDeRed("Failed to fetch")).toBe(true);
      expect(esErrorDeRed({ message: "network error" })).toBe(true);
    });

    it("NO trata como red los errores de datos (Postgres, validación)", () => {
      expect(esErrorDeRed(new Error("duplicate key value violates unique constraint"))).toBe(false);
      expect(esErrorDeRed({ message: "invalid input syntax for type uuid" })).toBe(false);
      expect(esErrorDeRed(new Error("new row violates row-level security policy"))).toBe(false);
    });
  });
});
