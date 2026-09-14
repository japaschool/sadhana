interface ConfirmModalProps {
  id: string
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
}

export function ConfirmModal({ id, title, message, confirmLabel = 'Confirm', onConfirm }: ConfirmModalProps) {
  return (
    <dialog id={id} className="modal">
      <div className="modal-box">
        <h3 className="font-bold text-lg">{title}</h3>
        <p className="py-4">{message}</p>
        <div className="modal-action">
          <form method="dialog" className="flex gap-2">
            <button className="btn btn-ghost">Cancel</button>
            <button className="btn btn-error" onClick={onConfirm}>
              {confirmLabel}
            </button>
          </form>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button aria-label="Close">close</button>
      </form>
    </dialog>
  )
}
