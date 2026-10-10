import {
  SCORING_RULES,
  TOKEN_COLORS,
  type HarmoniesView,
  type TokenColor,
} from '@bgp/game-harmonies';
import type { ReactNode } from 'react';
import scoringSideA from '../assets/scoring-side-a.webp';
import scoringSideB from '../assets/scoring-side-b.webp';
import type { DiagramToken } from '../layout';
import { useHarmoniesText } from '../useHarmoniesText';
import { TokenStack, tokenThickness } from './TokenStack';

/**
 * The illustrated reference card for each water scoring, shown beside the table below. The
 * table is the authority (it reads the engine's own numbers); the picture is the quick look.
 */
const REFERENCE_CARD: Record<HarmoniesView['waterScoring'], string> = {
  river: scoringSideA,
  islands: scoringSideB,
};

const SIZE = 15;
const GAP = SIZE * 1.9;

/** One or more stacks side by side, drawn the way they sit on the board. */
function Stacks({ stacks, label }: { stacks: DiagramToken[][]; label: string }) {
  const tallest = Math.max(...stacks.map((stack) => stack.length));
  const thickness = tokenThickness(SIZE);
  const width = SIZE * 2 + (stacks.length - 1) * GAP + 4;
  const height = SIZE * 2 + tallest * thickness + 4;
  const baseY = height - SIZE - thickness / 2 - 2;

  return (
    <svg className="guide-stacks" role="img" aria-label={label} width={width} height={height}>
      <title>{label}</title>
      {stacks.map((stack, index) => (
        <TokenStack
          key={index}
          x={SIZE + 2 + index * GAP}
          y={baseY}
          size={SIZE - 1}
          stack={stack}
        />
      ))}
    </svg>
  );
}

function Example({
  stacks,
  label,
  points,
  note,
}: {
  stacks: DiagramToken[][];
  label: string;
  points: string;
  note?: string;
}) {
  return (
    <li className="guide-example">
      <Stacks stacks={stacks} label={label} />
      <strong className="guide-points">{points}</strong>
      {note && <span className="muted">{note}</span>}
    </li>
  );
}

function Row({ title, count, children }: { title: string; count: string; children: ReactNode }) {
  return (
    <section className="guide-row">
      <h3>
        {title} <span className="muted">{count}</span>
      </h3>
      <ul className="guide-examples">{children}</ul>
    </section>
  );
}

const of = (token: DiagramToken, height: number): DiagramToken[] =>
  Array<DiagramToken>(height).fill(token);

/**
 * How each terrain is built and what it scores, for the map being played. Every number comes
 * from the engine's own scoring table and the match's token counts.
 */
export function ScoringGuide({ view }: { view: HarmoniesView }) {
  const text = useHarmoniesText();
  const guide = text.guide;
  const rules = SCORING_RULES;
  const count = (color: TokenColor) => `×${view.tokenCounts[color]}`;
  const byHeight = (height: number) => String(rules.pointsByHeight[height] ?? 0);
  const river = rules.riverPoints;
  const longestListed = river.length - 1;

  return (
    <details className="card guide">
      <summary>
        {guide.title} <span className="muted">· {view.map.name}</span>
      </summary>

      <div className="guide-body">
        <a
          className="guide-card"
          href={REFERENCE_CARD[view.waterScoring]}
          target="_blank"
          rel="noreferrer"
          title={guide.openCard}
        >
          <img
            src={REFERENCE_CARD[view.waterScoring]}
            alt={guide.cardAlt[view.waterScoring]}
            loading="lazy"
          />
        </a>
        <div className="guide-table">
          <Row title={guide.trees} count={guide.treeCount(count('leaf'), count('trunk'))}>
            <Example
              stacks={[of('trunk', 2)]}
              label={guide.trunksOnly}
              points="0"
              note={guide.trunksOnlyNote}
            />
            <Example stacks={[['leaf']]} label={guide.leavesAlone} points={byHeight(1)} />
            <Example stacks={[['trunk', 'leaf']]} label={guide.leavesOnOne} points={byHeight(2)} />
            <Example
              stacks={[['trunk', 'trunk', 'leaf']]}
              label={guide.leavesOnTwo}
              points={byHeight(3)}
            />
          </Row>

          <Row title={guide.mountains} count={count('mountain')}>
            <Example
              stacks={[of('mountain', 2)]}
              label={guide.mountainAlone}
              points="0"
              note={guide.mountainAloneNote}
            />
            {[1, 2, 3].map((height) => (
              <Example
                key={height}
                stacks={[of('mountain', height), ['mountain']]}
                label={guide.mountainNext(height)}
                points={byHeight(height)}
                note={height === 1 ? guide.mountainNextNote : undefined}
              />
            ))}
          </Row>

          <Row title={guide.fields} count={count('field')}>
            <Example
              stacks={[['field']]}
              label={guide.fieldAlone}
              points="0"
              note={guide.fieldAloneNote}
            />
            <Example
              stacks={[['field'], ['field']]}
              label={guide.fieldGroup}
              points={String(rules.fieldGroupPoints)}
              note={guide.fieldGroupNote}
            />
          </Row>

          <Row title={guide.buildings} count={count('building')}>
            <Example
              stacks={[['any', 'building']]}
              label={guide.buildingStack}
              points="0"
              note={guide.buildingFew(rules.buildingMinNeighbourColors)}
            />
            <Example
              stacks={[['any', 'building']]}
              label={guide.buildingSurrounded}
              points={String(rules.buildingPoints)}
              note={guide.buildingEnough(rules.buildingMinNeighbourColors)}
            />
            <li className="guide-note muted">{guide.buildingNote}</li>
          </Row>

          <Row title={guide.water} count={count('water')}>
            {view.waterScoring === 'river' ? (
              <>
                {river.slice(1).map((points, index) => (
                  <Example
                    key={index}
                    stacks={[['water']]}
                    label={guide.riverLong(index + 1)}
                    points={String(points)}
                    note={guide.riverLong(index + 1)}
                  />
                ))}
                <li className="guide-note muted">
                  {guide.riverNote(longestListed, rules.riverExtraPointsPerCell)}
                </li>
              </>
            ) : (
              <>
                <Example
                  stacks={[['any'], ['water'], ['any']]}
                  label={guide.island}
                  points={String(rules.islandPoints)}
                  note={guide.islandEach}
                />
                <li className="guide-note muted">{guide.islandNote}</li>
              </>
            )}
          </Row>
        </div>
      </div>

      <p className="guide-note muted">
        {guide.stacking(
          TOKEN_COLORS.map(
            (color) => `${view.tokenCounts[color]} ${text.token[color].toLowerCase()}`,
          ).join(', '),
        )}
      </p>
      {/* The icons' licence asks for this credit wherever they are shown: see art/CREDITS.md. */}
      <p className="guide-note muted">
        {guide.credit} ·{' '}
        <a href="https://game-icons.net" target="_blank" rel="noreferrer">
          game-icons.net
        </a>{' '}
        (CC BY 3.0)
      </p>
    </details>
  );
}
