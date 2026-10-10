import { useEffect, useId, useRef, type ReactNode } from 'react';
import { errorText } from '../../shared/i18n/errors';
import { useT } from '../../shared/i18n/useT';

interface Props {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  pending: boolean;
  error: unknown;
  /** Marks the confirm button as something that cannot be taken back. */
  danger?: boolean;
  onConfirm(): void;
  onClose(): void;
}

/** Asks before an admin action that other people will feel. */
export function ConfirmDialog(props: Props) {
  const t = useT();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    // StrictMode runs this twice, and showModal() throws on a dialog that is already open.
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // Through close(), not by unmounting, so the browser hands focus back to what opened it.
  const close = () => dialogRef.current?.close();

  return (
    <dialog
      ref={dialogRef}
      className="admin-dialog"
      aria-labelledby={titleId}
      onClose={props.onClose}
      onCancel={(event) => {
        if (props.pending) event.preventDefault();
      }}
      onClick={(event) => {
        // The dialog has no padding, so a click on it and not on its contents is on the backdrop.
        if (event.target === event.currentTarget && !props.pending) close();
      }}
    >
      <div className="admin-dialog-body">
        <h2 id={titleId}>{props.title}</h2>
        {props.children}
        {props.error != null && (
          <p className="error" role="alert">
            {errorText(t, props.error)}
          </p>
        )}
        <div className="admin-dialog-actions">
          {/* First, so it is what Enter lands on: the safe choice. */}
          <button
            type="button"
            className="secondary"
            disabled={props.pending}
            autoFocus
            onClick={close}
          >
            {t('admin.cancel')}
          </button>
          <button
            type="button"
            className={props.danger ? 'admin-danger' : undefined}
            disabled={props.pending}
            onClick={props.onConfirm}
          >
            {props.pending ? props.pendingLabel : props.confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
