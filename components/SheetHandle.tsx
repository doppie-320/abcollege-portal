"use client";

type Props = {
  onClick: () => void;
  label?: string;
};

/**
 * The grab bar at the top of a bottom sheet. Drag the bar it sits in (see useSheetDrag);
 * tapping it, or pressing Enter on it, closes the sheet — it replaces the X on phones.
 */
export default function SheetHandle({ onClick, label = "Close" }: Props) {
  return (
    <button type="button" className="sheetGrip" data-sheet-handle="" onClick={onClick} aria-label={label} title={label}>
      <span className="sheetGripBar" aria-hidden="true" />

      <style jsx>{`
        .sheetGrip {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          justify-content: center;
          width: 88px;
          height: 18px;
          padding: 7px 0 0;
          border: none;
          background: none;
          cursor: grab;
          touch-action: none;
        }

        .sheetGrip:active {
          cursor: grabbing;
        }

        .sheetGripBar {
          width: 40px;
          height: 4px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.5);
          transition: background 0.15s ease, width 0.2s ease;
        }

        .sheetGrip:hover .sheetGripBar,
        .sheetGrip:active .sheetGripBar {
          width: 48px;
          background: rgba(255, 255, 255, 0.8);
        }

        .sheetGrip:focus-visible {
          outline: none;
        }

        .sheetGrip:focus-visible .sheetGripBar {
          background: var(--white);
          box-shadow: 0 0 0 2px var(--grid);
        }

        /* Desktop dialogs close with their X instead. */
        @media (min-width: 820px) {
          .sheetGrip {
            display: none;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .sheetGripBar {
            transition: none;
          }
        }
      `}</style>
    </button>
  );
}
