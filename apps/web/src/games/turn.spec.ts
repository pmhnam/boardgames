import type { AvalonView } from '@bgp/game-avalon';
import type { BangView } from '@bgp/game-bang';
import type { CatanView } from '@bgp/game-catan';
import type { GridClaimView } from '@bgp/game-demo';
import type { HarmoniesView } from '@bgp/game-harmonies';
import type { SplendorView } from '@bgp/game-splendor';
import type { WerewolfView } from '@bgp/game-werewolf';
import { describe, expect, it } from 'vitest';
import { awaitsAvalonViewer } from './avalon/turn';
import { awaitsBangViewer } from './bang/turn';
import { awaitsCatanViewer } from './catan/turn';
import { awaitsGridClaimViewer } from './grid-claim/turn';
import { awaitsHarmoniesViewer } from './harmonies/turn';
import { awaitsSplendorViewer } from './splendor/turn';
import { awaitsWerewolfViewer } from './werewolf/turn';

// Each function reads a few fields of a large view; only those are filled in here.
const view = <T>(fields: unknown) => fields as T;

describe('games that take turns', () => {
  const playing = { phase: 'PLAYING', turn: { activePlayerId: 'p1' } };
  const over = { phase: 'FINISHED', turn: { activePlayerId: 'p1' } };

  it('splendor waits on whoever holds the turn, until it is over', () => {
    expect(awaitsSplendorViewer(view<SplendorView>(playing), 'p1')).toBe(true);
    expect(awaitsSplendorViewer(view<SplendorView>(playing), 'p2')).toBe(false);
    expect(awaitsSplendorViewer(view<SplendorView>(over), 'p1')).toBe(false);
  });

  it('harmonies waits on whoever holds the turn, until it is over', () => {
    expect(awaitsHarmoniesViewer(view<HarmoniesView>(playing), 'p1')).toBe(true);
    expect(awaitsHarmoniesViewer(view<HarmoniesView>(playing), 'p2')).toBe(false);
    expect(awaitsHarmoniesViewer(view<HarmoniesView>(over), 'p1')).toBe(false);
  });

  it('grid claim waits on whoever holds the turn, until it is over', () => {
    expect(awaitsGridClaimViewer(view<GridClaimView>(playing), 'p1')).toBe(true);
    expect(awaitsGridClaimViewer(view<GridClaimView>(playing), 'p2')).toBe(false);
    expect(awaitsGridClaimViewer(view<GridClaimView>(over), 'p1')).toBe(false);
  });
});

describe('awaitsCatanViewer', () => {
  const idle = { mustDiscard: 0, canRespond: false };
  const catan = (fields: { phase?: string; step?: string; legal?: object }) =>
    view<CatanView>({
      phase: fields.phase ?? 'PLAYING',
      turn: { activePlayerId: 'p1', step: fields.step ?? 'MAIN' },
      legal: { ...idle, ...fields.legal },
    });

  it('waits on whoever holds the turn', () => {
    expect(awaitsCatanViewer(catan({}), 'p1')).toBe(true);
    expect(awaitsCatanViewer(catan({}), 'p2')).toBe(false);
  });

  it('waits on anyone who owes cards to a 7, and only on them', () => {
    const owing = catan({ step: 'DISCARD', legal: { mustDiscard: 4 } });
    expect(awaitsCatanViewer(owing, 'p2')).toBe(true);
    expect(awaitsCatanViewer(catan({ step: 'DISCARD' }), 'p1')).toBe(false);
  });

  it('waits on a player with an offer to answer', () => {
    expect(awaitsCatanViewer(catan({ legal: { canRespond: true } }), 'p2')).toBe(true);
  });

  it('waits on nobody once it is over', () => {
    expect(awaitsCatanViewer(catan({ phase: 'FINISHED' }), 'p1')).toBe(false);
  });
});

describe('games that ask each player what they owe', () => {
  it('bang waits on a player with a prompt', () => {
    const bang = (prompt: string | null, phase = 'PLAYING') =>
      view<BangView>({ phase, me: { legal: { prompt } } });
    expect(awaitsBangViewer(bang('PLAY'))).toBe(true);
    expect(awaitsBangViewer(bang(null))).toBe(false);
    expect(awaitsBangViewer(bang('PLAY', 'FINISHED'))).toBe(false);
    expect(awaitsBangViewer(view<BangView>({ phase: 'PLAYING', me: null }))).toBe(false);
  });

  it('werewolf waits on a player who owes an action', () => {
    const werewolf = (action: string | null, phase = 'NIGHT') =>
      view<WerewolfView>({ phase, me: { legal: { action } } });
    expect(awaitsWerewolfViewer(werewolf('VOTE'))).toBe(true);
    expect(awaitsWerewolfViewer(werewolf(null))).toBe(false);
    expect(awaitsWerewolfViewer(werewolf('VOTE', 'FINISHED'))).toBe(false);
    expect(awaitsWerewolfViewer(view<WerewolfView>({ phase: 'NIGHT', me: null }))).toBe(false);
  });

  it('avalon waits on a player with anything to do', () => {
    const nothing = {
      propose: null,
      vote: null,
      quest: null,
      ladyTargets: [],
      assassinTargets: [],
    };
    const avalon = (legal: object) => view<AvalonView>({ legal: { ...nothing, ...legal } });
    expect(awaitsAvalonViewer(avalon({}))).toBe(false);
    expect(awaitsAvalonViewer(avalon({ propose: { teamSize: 2 } }))).toBe(true);
    expect(awaitsAvalonViewer(avalon({ vote: { proposal: 1 } }))).toBe(true);
    expect(awaitsAvalonViewer(avalon({ quest: { quest: 1, canFail: false } }))).toBe(true);
    expect(awaitsAvalonViewer(avalon({ ladyTargets: ['p2'] }))).toBe(true);
    expect(awaitsAvalonViewer(avalon({ assassinTargets: ['p2'] }))).toBe(true);
  });
});
