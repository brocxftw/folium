import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { CSSProperties } from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export type StorageUnit = "MB" | "GB" | "TB";

const UNIT_BYTES: Record<StorageUnit, number> = {
  MB: 1024 ** 2,
  GB: 1024 ** 3,
  TB: 1024 ** 4,
};

export function bytesFromStorageAmount(amount: number, unit: StorageUnit): number {
  return Math.round(amount * UNIT_BYTES[unit]);
}

export function storageAmountFromBytes(bytes: number): { amount: number; unit: StorageUnit } {
  if (bytes >= UNIT_BYTES.TB && bytes % UNIT_BYTES.TB === 0) {
    return { amount: bytes / UNIT_BYTES.TB, unit: "TB" };
  }
  if (bytes >= UNIT_BYTES.GB && bytes % UNIT_BYTES.GB === 0) {
    return { amount: bytes / UNIT_BYTES.GB, unit: "GB" };
  }
  if (bytes >= UNIT_BYTES.MB) {
    const mb = bytes / UNIT_BYTES.MB;
    if (Number.isInteger(mb) || bytes % UNIT_BYTES.MB === 0) {
      return { amount: Math.round(mb * 100) / 100, unit: "MB" };
    }
  }
  // Prefer readable unit
  if (bytes >= UNIT_BYTES.TB) return { amount: Math.round((bytes / UNIT_BYTES.TB) * 100) / 100, unit: "TB" };
  if (bytes >= UNIT_BYTES.GB) return { amount: Math.round((bytes / UNIT_BYTES.GB) * 100) / 100, unit: "GB" };
  return { amount: Math.round((bytes / UNIT_BYTES.MB) * 100) / 100, unit: "MB" };
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function tagPillStyle(color: string): CSSProperties {
  const hex = color.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.12)`,
    color: color,
    borderColor: `rgba(${r}, ${g}, ${b}, 0.25)`,
  };
}
