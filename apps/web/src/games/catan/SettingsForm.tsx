import { BOARD_SETUPS, type BoardSetup, type CatanConfig } from '@bgp/game-catan';
import type { RoomSettings, SettingsFormProps } from '../types';

const SETUP_LABEL: Record<BoardSetup, string> = {
  variable: 'Variable setup (island dealt at random)',
  fixed: 'Fixed setup (first game, pieces already placed)',
};

function selectedSetup(settings: RoomSettings): BoardSetup {
  return BOARD_SETUPS.find((setup) => setup === settings.boardSetup) ?? 'variable';
}

/** The host picks the variable setup or the rulebook's fixed one for a first game. */
export function CatanSettingsForm({ value, onChange }: SettingsFormProps<CatanConfig>) {
  return (
    <label className="row wrap">
      <span>Board</span>
      <select
        value={selectedSetup(value)}
        onChange={(event) => onChange({ ...value, boardSetup: event.target.value })}
      >
        {BOARD_SETUPS.map((setup) => (
          <option key={setup} value={setup}>
            {SETUP_LABEL[setup]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function describeCatanSettings(settings: RoomSettings, config: CatanConfig): string | null {
  return `${SETUP_LABEL[selectedSetup(settings)]} · first to ${config.victoryPointsToWin} points`;
}
