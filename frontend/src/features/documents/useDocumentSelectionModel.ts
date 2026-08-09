import { useCallback, useEffect, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  isEditableKeyboardTarget,
  selectAllIds,
  selectRangeIds,
  toggleIdInSet,
} from "./documentSelection";

interface UseDocumentSelectionModelArgs {
  documentIds: string[];
  selectedIds: Set<string>;
  onSelect: (ids: Set<string>) => void;
  onOpen: (id: string) => void;
  /** Columns used for Left/Right navigation in grid mode. */
  gridColumns?: number;
}

/**
 * Focused-row selection model: arrows, Space, Enter, Ctrl/Cmd+A, Shift-range.
 */
export function useDocumentSelectionModel({
  documentIds,
  selectedIds,
  onSelect,
  onOpen,
  gridColumns = 1,
}: UseDocumentSelectionModelArgs) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [anchorIndex, setAnchorIndex] = useState(0);

  useEffect(() => {
    setFocusedIndex((i) =>
      documentIds.length === 0 ? 0 : Math.min(i, documentIds.length - 1),
    );
    setAnchorIndex((i) =>
      documentIds.length === 0 ? 0 : Math.min(i, documentIds.length - 1),
    );
  }, [documentIds]);

  const focusId = documentIds[focusedIndex];

  const selectExclusive = useCallback(
    (index: number) => {
      const id = documentIds[index];
      if (!id) return;
      onSelect(new Set([id]));
      setFocusedIndex(index);
      setAnchorIndex(index);
    },
    [documentIds, onSelect],
  );

  const toggleAt = useCallback(
    (index: number) => {
      const id = documentIds[index];
      if (!id) return;
      onSelect(toggleIdInSet(selectedIds, id, !selectedIds.has(id)));
      setFocusedIndex(index);
      setAnchorIndex(index);
    },
    [documentIds, onSelect, selectedIds],
  );

  const selectRangeTo = useCallback(
    (index: number) => {
      if (documentIds.length === 0) return;
      onSelect(selectRangeIds(documentIds, anchorIndex, index));
      setFocusedIndex(index);
    },
    [anchorIndex, documentIds, onSelect],
  );

  const handleItemPointer = useCallback(
    (
      index: number,
      event: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean },
    ): "select" | "open" => {
      if (event.shiftKey) {
        selectRangeTo(index);
        return "select";
      }
      if (event.metaKey || event.ctrlKey) {
        toggleAt(index);
        return "select";
      }
      setFocusedIndex(index);
      setAnchorIndex(index);
      return "open";
    },
    [selectRangeTo, toggleAt],
  );

  const handleCheckbox = useCallback(
    (index: number, checked: boolean) => {
      const id = documentIds[index];
      if (!id) return;
      onSelect(toggleIdInSet(selectedIds, id, checked));
      setFocusedIndex(index);
      setAnchorIndex(index);
    },
    [documentIds, onSelect, selectedIds],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent) => {
      if (isEditableKeyboardTarget(event.target)) return;
      if (documentIds.length === 0) return;

      const cols = Math.max(1, gridColumns);
      let nextIndex = focusedIndex;

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          nextIndex = Math.min(documentIds.length - 1, focusedIndex + cols);
          setFocusedIndex(nextIndex);
          if (event.shiftKey) selectRangeTo(nextIndex);
          break;
        case "ArrowUp":
          event.preventDefault();
          nextIndex = Math.max(0, focusedIndex - cols);
          setFocusedIndex(nextIndex);
          if (event.shiftKey) selectRangeTo(nextIndex);
          break;
        case "ArrowRight":
          if (cols <= 1) return;
          event.preventDefault();
          nextIndex = Math.min(documentIds.length - 1, focusedIndex + 1);
          setFocusedIndex(nextIndex);
          if (event.shiftKey) selectRangeTo(nextIndex);
          break;
        case "ArrowLeft":
          if (cols <= 1) return;
          event.preventDefault();
          nextIndex = Math.max(0, focusedIndex - 1);
          setFocusedIndex(nextIndex);
          if (event.shiftKey) selectRangeTo(nextIndex);
          break;
        case " ":
        case "Spacebar":
          event.preventDefault();
          toggleAt(focusedIndex);
          break;
        case "Enter": {
          const id = documentIds[focusedIndex];
          if (id) {
            event.preventDefault();
            onOpen(id);
          }
          break;
        }
        case "a":
        case "A":
          if (event.metaKey || event.ctrlKey) {
            event.preventDefault();
            onSelect(selectAllIds(documentIds));
            setAnchorIndex(0);
            setFocusedIndex(0);
          }
          break;
        case "Home":
          event.preventDefault();
          setFocusedIndex(0);
          if (event.shiftKey) selectRangeTo(0);
          break;
        case "End":
          event.preventDefault();
          nextIndex = documentIds.length - 1;
          setFocusedIndex(nextIndex);
          if (event.shiftKey) selectRangeTo(nextIndex);
          break;
        default:
          break;
      }
    },
    [
      documentIds,
      focusedIndex,
      gridColumns,
      onOpen,
      onSelect,
      selectRangeTo,
      toggleAt,
    ],
  );

  return {
    focusedIndex,
    focusId,
    setFocusedIndex,
    handleItemPointer,
    handleCheckbox,
    handleKeyDown,
    selectExclusive,
  };
}
