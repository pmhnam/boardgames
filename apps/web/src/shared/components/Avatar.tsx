import type { CSSProperties } from 'react';
import { avatarHue, avatarInitials } from './avatar-traits';

export interface AvatarPerson {
  userId: string;
  displayName: string;
  /** A computer player is drawn as one, not given letters it has no claim to. */
  isBot?: boolean;
}

/** A player's letters on their own colour. Decoration: the name is always written beside it. */
export function Avatar({
  person,
  size,
  style,
}: {
  person: AvatarPerson;
  size?: 'small' | 'large';
  style?: CSSProperties;
}) {
  const className = ['avatar', size, person.isBot ? 'bot' : null].filter(Boolean).join(' ');
  const hue = person.isBot
    ? undefined
    : ({ '--avatar-hue': avatarHue(person.userId) } as CSSProperties);
  return (
    <span className={className} style={{ ...hue, ...style }} aria-hidden="true">
      {person.isBot ? '🤖' : avatarInitials(person.displayName)}
    </span>
  );
}

/** Who is in a room at a glance: the first few faces, and how many more there are. */
export function AvatarStack({ people, max = 4 }: { people: AvatarPerson[]; max?: number }) {
  // One more face fits where the "+1" would have gone.
  const shown = people.length > max ? people.slice(0, max - 1) : people;
  const hidden = people.length - shown.length;
  return (
    <span className="avatar-stack" aria-hidden="true">
      {shown.map((person, index) => (
        // Each face lies over the edge of the next, so the first one is whole.
        <Avatar
          key={person.userId}
          person={person}
          size="small"
          style={{ zIndex: shown.length - index }}
        />
      ))}
      {hidden > 0 && <span className="avatar small more">+{hidden}</span>}
    </span>
  );
}
