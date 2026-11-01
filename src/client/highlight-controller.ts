export interface HighlightView {
  render(active: number | null, selected: number | null): void;
  scrollToSegment(segmentNumber: number): void;
}

export interface HighlightController {
  selectSegment(segmentNumber: number, source?: "map" | "table"): void;
  previewSegment(segmentNumber: number | null): void;
  clearSelection(): void;
  getSelected(): number | null;
  destroy(): void;
}

export function createHighlightController(
  segmentNumbers: readonly number[],
  view: HighlightView,
): HighlightController {
  const valid = new Set(segmentNumbers);
  let selected: number | null = null;
  let preview: number | null = null;
  let destroyed = false;

  function validate(segmentNumber: number) {
    if (!valid.has(segmentNumber)) {
      throw new RangeError(`Unknown segment: ${segmentNumber}`);
    }
  }

  function render() {
    view.render(selected ?? preview, selected);
  }

  render();
  return {
    selectSegment(segmentNumber, source = "table") {
      if (destroyed) return;
      validate(segmentNumber);
      selected = selected === segmentNumber ? null : segmentNumber;
      preview = null;
      render();
      if (selected !== null && source === "map") {
        view.scrollToSegment(selected);
      }
    },
    previewSegment(segmentNumber) {
      if (destroyed) return;
      if (segmentNumber !== null) validate(segmentNumber);
      preview = segmentNumber;
      render();
    },
    clearSelection() {
      if (destroyed) return;
      selected = null;
      preview = null;
      render();
    },
    getSelected: () => selected,
    destroy() {
      if (destroyed) return;
      selected = null;
      preview = null;
      render();
      destroyed = true;
    },
  };
}
