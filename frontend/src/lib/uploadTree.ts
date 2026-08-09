/** Collect files for flat or folder uploads, preserving relative paths. */

export interface UploadEntry {
  file: File;
  relativePath: string;
}

function joinPath(prefix: string, name: string): string {
  return prefix ? `${prefix}/${name}` : name;
}

async function readDirectoryEntry(
  entry: FileSystemDirectoryEntry,
  prefix: string,
  out: UploadEntry[],
): Promise<void> {
  const reader = entry.createReader();
  const readBatch = (): Promise<FileSystemEntry[]> =>
    new Promise((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });

  // readEntries may return partial batches until an empty array.
  while (true) {
    const batch = await readBatch();
    if (batch.length === 0) break;
    for (const child of batch) {
      const childPath = joinPath(prefix, child.name);
      if (child.isFile) {
        const file = await new Promise<File>((resolve, reject) => {
          (child as FileSystemFileEntry).file(resolve, reject);
        });
        out.push({ file, relativePath: childPath });
      } else if (child.isDirectory) {
        await readDirectoryEntry(child as FileSystemDirectoryEntry, childPath, out);
      }
    }
  }
}

type PendingItem =
  | { kind: "file"; file: File; relativePath: string }
  | { kind: "directory"; entry: FileSystemDirectoryEntry; prefix: string };

/**
 * Synchronously capture FileSystem entries from a drop event.
 * Must run during the drop handler before yielding — browsers clear DataTransfer after.
 */
export function captureDataTransferItems(dataTransfer: DataTransfer): PendingItem[] {
  const items = Array.from(dataTransfer.items ?? []);
  const pending: PendingItem[] = [];

  if (items.length && typeof items[0]?.webkitGetAsEntry === "function") {
    for (const item of items) {
      if (item.kind !== "file") continue;
      const entry = item.webkitGetAsEntry();
      if (!entry) continue;
      if (entry.isFile) {
        const file = item.getAsFile();
        if (file) {
          pending.push({
            kind: "file",
            file,
            relativePath:
              (file as File & { webkitRelativePath?: string }).webkitRelativePath?.trim() ||
              file.name,
          });
        }
      } else if (entry.isDirectory) {
        pending.push({
          kind: "directory",
          entry: entry as FileSystemDirectoryEntry,
          prefix: entry.name,
        });
      }
    }
  }

  if (pending.length === 0 && dataTransfer.files?.length) {
    for (const file of Array.from(dataTransfer.files)) {
      pending.push({
        kind: "file",
        file,
        relativePath:
          (file as File & { webkitRelativePath?: string }).webkitRelativePath?.trim() ||
          file.name,
      });
    }
  }

  return pending;
}

/** Resolve captured drop items (expands directories asynchronously). */
export async function resolvePendingItems(pending: PendingItem[]): Promise<UploadEntry[]> {
  const out: UploadEntry[] = [];
  for (const item of pending) {
    if (item.kind === "file") {
      out.push({
        file: item.file,
        relativePath: item.relativePath.replace(/\\/g, "/"),
      });
    } else {
      await readDirectoryEntry(item.entry, item.prefix, out);
    }
  }
  return out;
}

/** From a drag-and-drop DataTransfer, including dropped folders. */
export async function entriesFromDataTransfer(
  dataTransfer: DataTransfer,
): Promise<UploadEntry[]> {
  return resolvePendingItems(captureDataTransferItems(dataTransfer));
}

/** From an ``<input type="file" multiple>`` or ``webkitdirectory`` selection. */
export function entriesFromFileList(files: FileList | File[]): UploadEntry[] {
  return Array.from(files).map((file) => {
    const rel =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath?.trim() ||
      file.name;
    return { file, relativePath: rel.replace(/\\/g, "/") };
  });
}

export function isTreeUpload(entries: UploadEntry[]): boolean {
  return entries.some((e) => e.relativePath.includes("/"));
}

export function dataTransferHasFiles(dataTransfer: DataTransfer | null | undefined): boolean {
  if (!dataTransfer) return false;
  return Array.from(dataTransfer.types ?? []).includes("Files");
}
