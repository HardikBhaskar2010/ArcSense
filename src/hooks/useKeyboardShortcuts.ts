import { useEffect } from 'react';
import { FaultMode } from '../types/arcsense';

interface KeyboardShortcutHandlers {
  onTogglePause?: () => void;
  onReset?: () => void;
  onInjectMode?: (mode: FaultMode) => void;
  onOpenSettings?: () => void;
  onExportCsv?: () => void;
  onToggleSimulator?: () => void;
  onToggleAudio?: () => void;
  onToggleShortcutsModal?: () => void;
}

export function useKeyboardShortcuts({
  onTogglePause,
  onReset,
  onInjectMode,
  onOpenSettings,
  onExportCsv,
  onToggleSimulator,
  onToggleAudio,
  onToggleShortcutsModal,
}: KeyboardShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not trigger shortcuts when user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      // Space: Toggle Pause/Resume
      if (e.code === 'Space') {
        e.preventDefault();
        onTogglePause?.();
      }

      // 'R' / 'r': Reset Circuit
      else if (e.key === 'r' || e.key === 'R') {
        onReset?.();
      }

      // '0', '1', '2', '3': Select Fault Mode
      else if (['0', '1', '2', '3'].includes(e.key)) {
        const mode = parseInt(e.key, 10) as FaultMode;
        onInjectMode?.(mode);
      }

      // 'S' / 's': Open Settings
      else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        onOpenSettings?.();
      }

      // 'C' / 'c': Export CSV
      else if (e.key === 'c' || e.key === 'C') {
        onExportCsv?.();
      }

      // 'M' / 'm': Toggle Mode (Sim vs Live)
      else if (e.key === 'm' || e.key === 'M') {
        onToggleSimulator?.();
      }

      // 'A' / 'a': Toggle Audio
      else if (e.key === 'a' || e.key === 'A') {
        onToggleAudio?.();
      }

      // '?' or '/': Help modal
      else if (e.key === '?' || (e.key === '/' && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault();
        onToggleShortcutsModal?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    onTogglePause,
    onReset,
    onInjectMode,
    onOpenSettings,
    onExportCsv,
    onToggleSimulator,
    onToggleAudio,
    onToggleShortcutsModal,
  ]);
}
