import type { CreateRoomRequest, GameDefinitionDto, RoomDto } from '@bgp/shared-types';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGameUi } from '../../games/registry';
import type { RoomSettings } from '../../games/types';
import { useGameConfig } from '../../games/useGameConfig';
import { api } from '../../shared/api/http';
import { errorText } from '../../shared/i18n/errors';
import { useT } from '../../shared/i18n/useT';
import { GameIcon } from './GameIcon';

/**
 * The choices made before a room exists: the game's own settings, and who may come in.
 * Mounted only while open; `onClose` is the cue to unmount it.
 */
export function CreateRoomDialog({ game, onClose }: { game: GameDefinitionDto; onClose(): void }) {
  const t = useT();
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);

  const SettingsForm = getGameUi(game.gameType)?.SettingsForm;
  const config = useGameConfig(game.gameType, SettingsForm !== undefined);
  const [settings, setSettings] = useState<RoomSettings>({});
  const [isPrivate, setIsPrivate] = useState(false);

  const create = useMutation({
    mutationFn: (body: CreateRoomRequest) => api<RoomDto>('POST', '/rooms', body),
    onSuccess: (room) => navigate(`/rooms/${room.id}`),
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    // StrictMode runs this twice, and showModal() throws on a dialog that is already open.
    if (!dialog || dialog.open) return;
    dialog.showModal();
    // Nothing to change is the common case: Enter creates the room.
    submitRef.current?.focus();
  }, []);

  // Through close(), not by unmounting, so the browser hands focus back to the card's button.
  const close = () => dialogRef.current?.close();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate({
      gameType: game.gameType,
      visibility: isPrivate ? 'private' : 'public',
      // Nothing picked: let the server apply the game's defaults.
      settings: Object.keys(settings).length > 0 ? settings : undefined,
    });
  };

  return (
    <dialog
      ref={dialogRef}
      className="create-dialog"
      aria-labelledby="create-room-title"
      onClose={onClose}
      onCancel={(event) => {
        // Escape while the room is being made would leave it made and unvisited.
        if (create.isPending) event.preventDefault();
      }}
      onClick={(event) => {
        // The dialog has no padding, so a click on it and not on its contents is on the backdrop.
        if (event.target === event.currentTarget && !create.isPending) close();
      }}
    >
      <form className="create-dialog-body" onSubmit={submit}>
        <div className="create-dialog-header">
          <GameIcon gameType={game.gameType} displayName={game.displayName} />
          <h2 id="create-room-title">{t('create.title', { game: game.displayName })}</h2>
        </div>

        {SettingsForm &&
          (config.data ? (
            <SettingsForm config={config.data.config} value={settings} onChange={setSettings} />
          ) : config.isError ? (
            // The room can still be made: the server fills in the defaults.
            <p className="muted">{t('create.defaultsOnly')}</p>
          ) : (
            <span className="skeleton skeleton-line" />
          ))}

        <fieldset className="create-visibility">
          <legend>{t('create.visibility')}</legend>
          <label>
            <input
              type="radio"
              name="visibility"
              checked={!isPrivate}
              onChange={() => setIsPrivate(false)}
            />
            <span className="create-visibility-text">
              <strong>{t('create.public')}</strong>
              <span className="muted">{t('create.publicHint')}</span>
            </span>
          </label>
          <label>
            <input
              type="radio"
              name="visibility"
              checked={isPrivate}
              onChange={() => setIsPrivate(true)}
            />
            <span className="create-visibility-text">
              <strong>{t('create.private')}</strong>
              <span className="muted">{t('create.privateHint')}</span>
            </span>
          </label>
        </fieldset>

        {create.isError && (
          <p className="error" role="alert">
            {errorText(t, create.error)}
          </p>
        )}

        <div className="create-dialog-actions">
          <button type="button" className="secondary" disabled={create.isPending} onClick={close}>
            {t('create.cancel')}
          </button>
          <button ref={submitRef} type="submit" disabled={create.isPending}>
            {create.isPending ? t('create.pending') : t('create.submit')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
