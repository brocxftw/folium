import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function SettingsTable({
  children,
  className,
  minWidth,
}: {
  children: ReactNode;
  className?: string;
  minWidth?: string;
}) {
  return (
    <div className={cn("overflow-x-auto rounded-lg border border-surface-border bg-surface", className)}>
      <table className="w-full text-left" style={minWidth ? { minWidth } : undefined}>
        {children}
      </table>
    </div>
  );
}

export function SettingsTableHead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-surface-border">{children}</tr>
    </thead>
  );
}

export function SettingsTableHeaderCell({
  children,
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn("px-3 py-2 text-[11px] font-semibold leading-4 text-text-secondary", className)}
      {...props}
    >
      {children}
    </th>
  );
}

export function SettingsTableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function SettingsTableRow({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b border-surface-border last:border-0",
        props.onClick && "cursor-pointer hover:bg-surface-hover",
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function SettingsTableCell({
  children,
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-3 py-2.5 text-[12px] text-text-primary", className)} {...props}>
      {children}
    </td>
  );
}
