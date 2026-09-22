// The dialog layer's state and its imperative API, the single place a message box or a toast is opened from.
// Module level single source, shaped like the session and theme stores: the host subscribes, callers push.
// A body is plain text or a React node, so nothing is ever injected as raw markup.

import { useSyncExternalStore } from "react";

const TOAST_MS = 4000;

const listeners = new Set();

// Dialogs queue rather than replace each other: a failure raised while a confirmation is open would otherwise
// take the answer with it.
let dialogState = { queue: [], toasts: [] };
// Only toasts are identified: several are on screen at once, the list needs a stable key and the timer has to
// remove the one it was started for. The queued dialog is a single element and needs neither.
let nextToastId = 1;

// The single write path. Memory and subscribers move together, and the untouched half is read back from the
// current state, so closing a dialog never drops a toast.
function commitState(queue, toasts) {
  dialogState = { queue, toasts };
  listeners.forEach((listener) => listener());
}

function addListener(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getDialogState = () => dialogState;

export const isDialogOpen = () => dialogState.queue.length > 0;

function openDialog(dialog) {
  return new Promise((resolve) => {
    commitState([...dialogState.queue, { ...dialog, resolve }], dialogState.toasts);
  });
}

// Called by the host alone: it resolves the waiting caller and lets the next dialog in the queue through.
export function closeDialog(result) {
  const [current, ...rest] = dialogState.queue;
  if (!current) return;
  commitState(rest, dialogState.toasts);
  current.resolve(result);
}

function dismissToast(id) {
  commitState(
    dialogState.queue,
    dialogState.toasts.filter((toast) => toast.id !== id),
  );
}

function pushToast(title, body) {
  const id = nextToastId;
  nextToastId += 1;
  commitState(dialogState.queue, [...dialogState.toasts, { id, title, body }]);
  setTimeout(() => dismissToast(id), TOAST_MS);
}

export const showDialog = {
  toast: (title, body) => pushToast(title, body),

  error: (title, body) => openDialog({ tone: "error", title, body }),

  warning: (title, body) => openDialog({ tone: "warning", title, body }),

  // Returns a boolean rather than a result object, so callers write `if (confirmed)`. The cancel label comes
  // third because the signature follows the order the two buttons are read on screen.
  confirm: (title, body, cancelText, confirmText) =>
    openDialog({ tone: "warning", title, body, cancelText, confirmText }),

  confirmDanger: (title, body, cancelText, confirmText) =>
    openDialog({ tone: "danger", title, body, cancelText, confirmText }),
};

export function useDialogState() {
  return useSyncExternalStore(addListener, getDialogState);
}
