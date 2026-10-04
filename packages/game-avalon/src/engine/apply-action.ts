import { GameRuleError, type GameActionContext } from '@bgp/game-core';
import type { AvalonAction } from '../domain/actions.js';
import type { AvalonState, InFlight } from '../domain/state.js';
import { isLadyDue } from '../rules/lady.rules.js';
import { getQuestVerdict } from '../rules/quest.rules.js';
import { getLeaderId, getQuestIndex, getRejections, inSeatOrder } from '../rules/table.rules.js';
import { isApproved } from '../rules/vote.rules.js';
import { validateAction } from './validate-action.js';

const NOTHING_IN_FLIGHT: InFlight = { team: null, votes: {}, cards: {} };

function applyProposeTeam(state: AvalonState, team: readonly string[]): AvalonState {
  return {
    ...state,
    phase: 'TEAM_VOTE',
    // Seat order, so the same team is the same state however the leader listed it.
    current: {
      team: state.seatOrder.filter((playerId) => team.includes(playerId)),
      votes: {},
      cards: {},
    },
  };
}

function applyVote(state: AvalonState, playerId: string, approve: boolean): AvalonState {
  const votes = inSeatOrder(state.seatOrder, { ...state.current.votes, [playerId]: approve });
  const team = state.current.team;
  if (!team) throw new Error('No team to vote on');
  if (state.seatOrder.some((id) => votes[id] === undefined)) {
    return { ...state, current: { ...state.current, votes } };
  }

  const approved = isApproved(state.seatOrder, votes);
  const settled: AvalonState = {
    ...state,
    proposals: [
      ...state.proposals,
      { quest: getQuestIndex(state), leaderId: getLeaderId(state), team, votes, approved },
    ],
  };
  if (approved) return { ...settled, phase: 'QUEST', current: { team, votes: {}, cards: {} } };

  const outOfProposals = getRejections(settled) >= state.rules.maxRejections;
  return {
    ...settled,
    phase: outOfProposals ? 'FINISHED' : 'TEAM_PROPOSAL',
    current: NOTHING_IN_FLIGHT,
  };
}

function applyPlayQuestCard(state: AvalonState, playerId: string, success: boolean): AvalonState {
  const cards = inSeatOrder(state.seatOrder, { ...state.current.cards, [playerId]: success });
  const team = state.current.team;
  const proposal = state.proposals.at(-1);
  if (!team || !proposal) throw new Error('No quest in progress');
  if (team.some((id) => cards[id] === undefined)) {
    return { ...state, current: { ...state.current, cards } };
  }

  const completed: AvalonState = {
    ...state,
    quests: [...state.quests, { leaderId: proposal.leaderId, team, cards }],
    current: NOTHING_IN_FLIGHT,
  };
  const verdict = getQuestVerdict(completed);
  if (verdict === 'EVIL') return { ...completed, phase: 'FINISHED' };
  // Good has its quests, but evil gets one last chance: naming Merlin.
  if (verdict === 'GOOD') return { ...completed, phase: 'ASSASSINATION' };
  return { ...completed, phase: isLadyDue(completed) ? 'LADY' : 'TEAM_PROPOSAL' };
}

/** The holder learns the target's side from the view; the token moves on to the target. */
function applyUseLady(state: AvalonState, holderId: string, targetId: string): AvalonState {
  if (!state.lady) throw new Error('The Lady of the Lake is not in play');
  return {
    ...state,
    phase: 'TEAM_PROPOSAL',
    lady: {
      holderId: targetId,
      inspections: [...state.lady.inspections, { holderId, targetId }],
    },
  };
}

export function applyAction(
  state: AvalonState,
  action: AvalonAction,
  context: GameActionContext,
): AvalonState {
  const validation = validateAction(state, action, context);
  if (!validation.valid) throw new GameRuleError(validation.code, validation.message);

  const playerId = context.actorPlayerId;
  switch (action.type) {
    case 'PROPOSE_TEAM':
      return applyProposeTeam(state, action.team);
    case 'VOTE':
      return applyVote(state, playerId, action.approve);
    case 'PLAY_QUEST_CARD':
      return applyPlayQuestCard(state, playerId, action.success);
    case 'USE_LADY':
      return applyUseLady(state, playerId, action.targetId);
    case 'ASSASSINATE':
      return { ...state, phase: 'FINISHED', assassinTargetId: action.targetId };
  }
}
