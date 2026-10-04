import type { GameViewer } from '@bgp/game-core';
import { ROLES, type Alignment, type Role } from '../domain/roles.js';
import type { AvalonPhase, AvalonState } from '../domain/state.js';
import { getAssassinId } from '../rules/assassination.rules.js';
import { getKnowledge, type Knowledge } from '../rules/knowledge.rules.js';
import { NO_LEGAL_MOVES, getLegalMoves, type LegalMoves } from '../rules/legal-moves.js';
import { getOutcome, getWinners, type Outcome } from '../rules/outcome.rules.js';
import { getFailCount, hasPlayed, isQuestSuccess } from '../rules/quest.rules.js';
import {
  getAlignment,
  getLeaderId,
  getRejections,
  getRole,
  inSeatOrder,
  isPlayer,
} from '../rules/table.rules.js';
import { hasVoted } from '../rules/vote.rules.js';

export interface QuestResultView {
  leaderId: string;
  team: string[];
  fails: number;
  success: boolean;
  /** Who played what. Null until the game is over. */
  cards: Record<string, boolean> | null;
}

export interface QuestView {
  teamSize: number;
  failsRequired: number;
  /** Null until the quest has been played. */
  result: QuestResultView | null;
}

/** A settled proposal. Votes are public once everyone has voted. */
export interface ProposalView {
  quest: number;
  leaderId: string;
  team: string[];
  votes: Record<string, boolean>;
  approved: boolean;
}

export interface LadyInspectionView {
  holderId: string;
  targetId: string;
  /** What the holder saw. Null for everyone else until the game is over. */
  alignment: Alignment | null;
}

export interface LadyView {
  holderId: string;
  inspections: LadyInspectionView[];
}

/** What a seated player knows that the table does not. */
export interface YouView {
  role: Role;
  alignment: Alignment;
  knowledge: Knowledge[];
  /** The viewer's own vote on the team being voted on, once cast. */
  vote: boolean | null;
  /** The viewer's own card on the quest in progress, once played. */
  questCard: boolean | null;
}

export interface AvalonView {
  id: string;
  phase: AvalonPhase;
  seatOrder: string[];
  /** Who leads the team being chosen, voted on or sent. Null once the quests are over. */
  leaderId: string | null;
  /** The roles dealt, without who holds them. */
  rolesInPlay: Role[];
  /** Every quest of the game, played or not. */
  quests: QuestView[];
  /** Index of the quest in progress. */
  questIndex: number;
  rejections: number;
  maxRejections: number;
  /** The team proposed or on the quest. */
  team: string[] | null;
  /** Who has voted on the team, not how. */
  voted: string[];
  /** Who has played a quest card, not which. */
  played: string[];
  proposals: ProposalView[];
  lady: LadyView | null;
  /** The Assassin steps forward once good has won its quests. */
  assassinId: string | null;
  assassinTargetId: string | null;
  /** Null for anyone not seated. */
  you: YouView | null;
  /** Everyone's role. Null until the game is over. */
  roles: Record<string, Role> | null;
  outcome: Outcome | null;
  winnerPlayerIds: string[];
  /** What the viewer may do right now. */
  legal: LegalMoves;
}

function getQuestViews(state: AvalonState, finished: boolean): QuestView[] {
  return state.rules.teamSizes.map((teamSize, index) => {
    const quest = state.quests[index];
    return {
      teamSize,
      failsRequired: state.rules.failsRequired[index] ?? 1,
      result: quest
        ? {
            leaderId: quest.leaderId,
            team: [...quest.team],
            fails: getFailCount(quest),
            success: isQuestSuccess(state, index),
            cards: finished ? inSeatOrder(state.seatOrder, quest.cards) : null,
          }
        : null,
    };
  });
}

function getShownLeaderId(state: AvalonState): string | null {
  switch (state.phase) {
    case 'TEAM_PROPOSAL':
    case 'TEAM_VOTE':
    case 'LADY':
      return getLeaderId(state);
    case 'QUEST':
      return state.proposals.at(-1)?.leaderId ?? null;
    case 'ASSASSINATION':
    case 'FINISHED':
      return null;
  }
}

function getYouView(state: AvalonState, playerId: string): YouView {
  return {
    role: getRole(state, playerId),
    alignment: getAlignment(state, playerId),
    knowledge: getKnowledge(state, playerId),
    vote: state.current.votes[playerId] ?? null,
    questCard: state.current.cards[playerId] ?? null,
  };
}

/**
 * Built field by field. Roles, votes still being cast, quest cards and what the Lady showed
 * never leave except to the player they belong to, until the game is over. Spectators and
 * admins see what the table sees.
 */
export function getPublicView(state: AvalonState, viewer: GameViewer): AvalonView {
  const viewerId =
    viewer.type === 'player' && isPlayer(state, viewer.playerId) ? viewer.playerId : null;
  const finished = state.phase === 'FINISHED';
  const assassinKnown = finished || state.phase === 'ASSASSINATION';

  return {
    id: state.id,
    phase: state.phase,
    seatOrder: [...state.seatOrder],
    leaderId: getShownLeaderId(state),
    rolesInPlay: ROLES.flatMap((role) =>
      state.seatOrder.filter((playerId) => state.roles[playerId] === role).map(() => role),
    ),
    quests: getQuestViews(state, finished),
    questIndex: state.quests.length,
    rejections: getRejections(state),
    maxRejections: state.rules.maxRejections,
    team: state.current.team ? [...state.current.team] : null,
    voted: state.seatOrder.filter((playerId) => hasVoted(state, playerId)),
    played: state.seatOrder.filter((playerId) => hasPlayed(state, playerId)),
    proposals: state.proposals.map((proposal) => ({
      quest: proposal.quest,
      leaderId: proposal.leaderId,
      team: [...proposal.team],
      votes: inSeatOrder(state.seatOrder, proposal.votes),
      approved: proposal.approved,
    })),
    lady: state.lady && {
      holderId: state.lady.holderId,
      inspections: state.lady.inspections.map(({ holderId, targetId }) => ({
        holderId,
        targetId,
        alignment: finished || holderId === viewerId ? getAlignment(state, targetId) : null,
      })),
    },
    assassinId: assassinKnown ? getAssassinId(state) : null,
    assassinTargetId: state.assassinTargetId,
    you: viewerId === null ? null : getYouView(state, viewerId),
    roles: finished ? inSeatOrder(state.seatOrder, state.roles) : null,
    outcome: getOutcome(state),
    winnerPlayerIds: getWinners(state),
    legal: viewerId === null ? NO_LEGAL_MOVES : getLegalMoves(state, viewerId),
  };
}
