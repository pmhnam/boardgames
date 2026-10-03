import {
  SCORING_RULES,
  TOKEN_COLORS,
  type HarmoniesView,
  type TokenColor,
} from '@bgp/game-harmonies';
import type { ReactNode } from 'react';
import scoringSideA from '../assets/scoring-side-a.webp';
import scoringSideB from '../assets/scoring-side-b.webp';
import { TOKEN_FILL, TOKEN_LABEL, hexPoints } from '../layout';

/**
 * The illustrated reference card for each water scoring, shown beside the table below. The
 * table is the authority (it reads the engine's own numbers); the picture is the quick look.
 */
const REFERENCE_CARD: Record<HarmoniesView['waterScoring'], { src: string; alt: string }> = {
  river: {
    src: scoringSideA,
    alt: 'Illustrated scoring card for the river side: the same rules as the table beside it.',
  },
  islands: {
    src: scoringSideB,
    alt: 'Illustrated scoring card for the island side: the same rules as the table beside it.',
  },
};

const SIZE = 15;
const LIFT = 6;
const GAP = SIZE * 1.9;

/** A token in a diagram; `any` stands for a cell whose colour does not matter. */
type GuideToken = TokenColor | 'any';

/** One or more stacks side by side, drawn the way they sit on the board. */
function Stacks({ stacks, label }: { stacks: GuideToken[][]; label: string }) {
  const tallest = Math.max(...stacks.map((stack) => stack.length));
  const width = SIZE * 2 + (stacks.length - 1) * GAP + 4;
  const height = SIZE * 2 + (tallest - 1) * LIFT + 4;
  const baseY = height - SIZE - 2;

  return (
    <svg className="guide-stacks" role="img" aria-label={label} width={width} height={height}>
      <title>{label}</title>
      {stacks.map((stack, index) =>
        stack.map((token, level) => (
          <polygon
            key={`${index}-${level}`}
            className={token === 'any' ? 'hex-token hex-any-base' : 'hex-token'}
            points={hexPoints(SIZE + 2 + index * GAP, baseY - level * LIFT, SIZE - 1)}
            fill={token === 'any' ? undefined : TOKEN_FILL[token]}
          />
        )),
      )}
    </svg>
  );
}

function Example({
  stacks,
  label,
  points,
  note,
}: {
  stacks: GuideToken[][];
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

const of = (token: GuideToken, height: number): GuideToken[] =>
  Array<GuideToken>(height).fill(token);

/**
 * How each terrain is built and what it scores, for the map being played. Every number comes
 * from the engine's own scoring table and the match's token counts.
 */
export function ScoringGuide({ view }: { view: HarmoniesView }) {
  const rules = SCORING_RULES;
  const count = (color: TokenColor) => `×${view.tokenCounts[color]}`;
  const byHeight = (height: number) => String(rules.pointsByHeight[height] ?? 0);
  const river = rules.riverPoints;
  const longestListed = river.length - 1;

  return (
    <details className="card guide">
      <summary>
        Scoring guide <span className="muted">· {view.map.name}</span>
      </summary>

      <div className="guide-body">
        <a
          className="guide-card"
          href={REFERENCE_CARD[view.waterScoring].src}
          target="_blank"
          rel="noreferrer"
          title="Open the card at full size"
        >
          <img
            src={REFERENCE_CARD[view.waterScoring].src}
            alt={REFERENCE_CARD[view.waterScoring].alt}
            loading="lazy"
          />
        </a>
        <div className="guide-table">
          <Row title="Trees" count={`${count('leaf')} leaves, ${count('trunk')} trunks`}>
            <Example
              stacks={[of('trunk', 2)]}
              label="Trunks with no leaves"
              points="0"
              note="no leaves yet"
            />
            <Example stacks={[['leaf']]} label="Leaves alone" points={byHeight(1)} />
            <Example
              stacks={[['trunk', 'leaf']]}
              label="Leaves on one trunk"
              points={byHeight(2)}
            />
            <Example
              stacks={[['trunk', 'trunk', 'leaf']]}
              label="Leaves on two trunks"
              points={byHeight(3)}
            />
          </Row>

          <Row title="Mountains" count={count('mountain')}>
            <Example
              stacks={[of('mountain', 2)]}
              label="A mountain with no mountain next to it"
              points="0"
              note="standing alone"
            />
            {[1, 2, 3].map((height) => (
              <Example
                key={height}
                stacks={[of('mountain', height), ['mountain']]}
                label={`A mountain ${height} high next to another mountain`}
                points={byHeight(height)}
                note={height === 1 ? 'each, when next to another' : undefined}
              />
            ))}
          </Row>

          <Row title="Fields" count={count('field')}>
            <Example stacks={[['field']]} label="A single field" points="0" note="standing alone" />
            <Example
              stacks={[['field'], ['field']]}
              label="Two or more fields touching"
              points={String(rules.fieldGroupPoints)}
              note="per group of 2 or more"
            />
          </Row>

          <Row title="Buildings" count={count('building')}>
            <Example
              stacks={[['any', 'building']]}
              label="A red token on a grey, brown or red token"
              points="0"
              note={`fewer than ${rules.buildingMinNeighbourColors} colours around it`}
            />
            <Example
              stacks={[['any', 'building']]}
              label="A building surrounded by three or more colours"
              points={String(rules.buildingPoints)}
              note={`${rules.buildingMinNeighbourColors}+ different colours around it`}
            />
            <li className="guide-note muted">
              A building is a red token on top of a grey, brown or red one. A red token on the
              ground is not a building yet.
            </li>
          </Row>

          <Row title="Water" count={count('water')}>
            {view.waterScoring === 'river' ? (
              <>
                {river.slice(1).map((points, index) => (
                  <Example
                    key={index}
                    stacks={[['water']]}
                    label={`A river ${index + 1} long`}
                    points={String(points)}
                    note={`${index + 1} long`}
                  />
                ))}
                <li className="guide-note muted">
                  Only your longest river scores, measured between its two furthest ends. Each cell
                  beyond {longestListed} adds {rules.riverExtraPointsPerCell}.
                </li>
              </>
            ) : (
              <>
                <Example
                  stacks={[['any'], ['water'], ['any']]}
                  label="Two areas of land with water between them"
                  points={String(rules.islandPoints)}
                  note="per island"
                />
                <li className="guide-note muted">
                  An island is an area of cells, built on or empty, that water and the edge of the
                  board cut off from the rest. A board with no water is one island.
                </li>
              </>
            )}
          </Row>
        </div>
      </div>

      <p className="guide-note muted">
        Stacking: water and fields stay flat. Mountains go up to 3. Trunks go up to 2 and are closed
        by leaves. Nothing can be placed on a cell that holds an animal. The pouch started with{' '}
        {TOKEN_COLORS.map(
          (color) => `${view.tokenCounts[color]} ${TOKEN_LABEL[color].toLowerCase()}`,
        ).join(', ')}
        .
      </p>
    </details>
  );
}
