import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Status } from '../types';

/**
 * Pointer-based drag and drop for the board.
 *
 * Why custom instead of a library: the board only needs "move a card between
 * and within four lists", and owning it lets us keep the feel tight —
 * a floating card that follows the pointer 1:1, a placeholder that opens up
 * where the card will land, edge auto-scrolling, and long-press on touch so
 * the board still scrolls normally on phones.
 */

export interface DragState {
  taskId: string;
  fromStatus: Status;
  overStatus: Status;
  overIndex: number;
  width: number;
  height: number;
}

interface Pending {
  taskId: string;
  status: Status;
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  cardEl: HTMLElement;
  timer: number | null;
}

interface Options {
  onDrop: (taskId: string, status: Status, index: number) => void;
}

const MOUSE_SLOP = 4; // px of movement before a mouse press becomes a drag
const TOUCH_SLOP = 8; // movement that cancels a long-press (user is scrolling)
const TOUCH_DELAY = 220; // ms hold before a touch becomes a drag
const EDGE = 64; // px from an edge where auto-scroll kicks in
const MAX_SPEED = 18; // px per frame

const INTERACTIVE = 'button, a, input, textarea, select, label, [data-no-drag]';

export function useDragAndDrop({ onDrop }: Options) {
  const [drag, setDrag] = useState<DragState | null>(null);

  const dragRef = useRef<DragState | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const offset = useRef({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const columns = useRef(new Map<Status, HTMLElement>());
  const lists = useRef(new Map<Status, HTMLElement>());
  const rafRef = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  const update = (next: DragState | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  /* ------------------------- registration ------------------------- */

  const registerColumn = useCallback(
    (status: Status) => (el: HTMLElement | null) => {
      if (el) columns.current.set(status, el);
      else columns.current.delete(status);
    },
    [],
  );

  const registerList = useCallback(
    (status: Status) => (el: HTMLElement | null) => {
      if (el) lists.current.set(status, el);
      else lists.current.delete(status);
    },
    [],
  );

  /* ------------------------- hit testing -------------------------- */

  const computeTarget = useCallback((): { status: Status; index: number } | null => {
    const current = dragRef.current;
    if (!current) return null;
    const { x, y } = pointer.current;

    // 1. Which column? The one under the pointer, else the horizontally nearest.
    let best: Status | null = null;
    let bestDist = Infinity;
    for (const [status, el] of columns.current) {
      const r = el.getBoundingClientRect();
      const dist = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
      if (dist < bestDist) {
        bestDist = dist;
        best = status;
      }
    }
    if (!best) return null;

    // 2. Which slot? Count the cards whose (placeholder-independent) midpoint is above the pointer.
    const list = lists.current.get(best);
    if (!list) return { status: best, index: 0 };
    const cards = Array.from(list.querySelectorAll<HTMLElement>('[data-task-id]')).filter(
      (el) => el.dataset.taskId !== current.taskId,
    );
    const placeholder = list.querySelector<HTMLElement>('[data-placeholder]');
    const shift = placeholder ? placeholder.getBoundingClientRect().height + 8 : 0;
    const placeholderTop = placeholder ? placeholder.getBoundingClientRect().top : Infinity;

    let index = 0;
    for (const card of cards) {
      const r = card.getBoundingClientRect();
      const mid = r.top + r.height / 2 - (r.top > placeholderTop ? shift : 0);
      if (y > mid) index += 1;
      else break;
    }
    return { status: best, index };
  }, []);

  const retarget = useCallback(() => {
    const current = dragRef.current;
    const target = computeTarget();
    if (!current || !target) return;
    if (target.status !== current.overStatus || target.index !== current.overIndex) {
      update({ ...current, overStatus: target.status, overIndex: target.index });
    }
  }, [computeTarget]);

  /* -------------------------- auto-scroll -------------------------- */

  const autoScroll = useCallback(() => {
    if (!dragRef.current) {
      rafRef.current = null;
      return;
    }
    const { x, y } = pointer.current;
    let scrolled = false;

    const speed = (distance: number) => Math.ceil(MAX_SPEED * (1 - Math.max(0, distance) / EDGE));

    const board = boardRef.current;
    if (board) {
      const r = board.getBoundingClientRect();
      if (x < r.left + EDGE && board.scrollLeft > 0) {
        board.scrollLeft -= speed(x - r.left);
        scrolled = true;
      } else if (x > r.right - EDGE && board.scrollLeft < board.scrollWidth - board.clientWidth) {
        board.scrollLeft += speed(r.right - x);
        scrolled = true;
      }
    }

    const list = lists.current.get(dragRef.current.overStatus);
    if (list) {
      const r = list.getBoundingClientRect();
      if (x >= r.left && x <= r.right) {
        if (y < r.top + EDGE && list.scrollTop > 0) {
          list.scrollTop -= speed(y - r.top);
          scrolled = true;
        } else if (y > r.bottom - EDGE && list.scrollTop < list.scrollHeight - list.clientHeight) {
          list.scrollTop += speed(r.bottom - y);
          scrolled = true;
        }
      }
    }

    if (scrolled) retarget();
    rafRef.current = requestAnimationFrame(autoScroll);
  }, [retarget]);

  /* ---------------------------- overlay ---------------------------- */

  const positionOverlay = () => {
    const el = overlayRef.current;
    if (!el) return;
    const { x, y } = pointer.current;
    el.style.transform = `translate3d(${x - offset.current.x}px, ${y - offset.current.y}px, 0) rotate(2deg)`;
  };

  // Position the overlay as soon as it mounts.
  const setOverlay = useCallback((el: HTMLDivElement | null) => {
    overlayRef.current = el;
    if (el) positionOverlay();
  }, []);

  /* ---------------------------- lifecycle -------------------------- */

  const cleanupListeners = useRef<() => void>(() => {});

  const finish = useCallback((commit: boolean) => {
    const current = dragRef.current;
    const pending = pendingRef.current;
    if (pending?.timer) window.clearTimeout(pending.timer);
    pendingRef.current = null;
    cleanupListeners.current();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    document.body.classList.remove('is-dragging');

    if (current) {
      suppressClick.current = true;
      window.setTimeout(() => (suppressClick.current = false), 0);
      update(null);
      if (commit) onDropRef.current(current.taskId, current.overStatus, current.overIndex);
    }
  }, []);

  const activate = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    const rect = pending.cardEl.getBoundingClientRect();
    offset.current = { x: pending.startX - rect.left, y: pending.startY - rect.top };

    // The card starts in its own slot.
    const list = lists.current.get(pending.status);
    const siblings = list
      ? Array.from(list.querySelectorAll<HTMLElement>('[data-task-id]'))
      : [];
    const index = Math.max(0, siblings.findIndex((el) => el.dataset.taskId === pending.taskId));

    document.body.classList.add('is-dragging');
    if (pending.pointerType === 'touch' && 'vibrate' in navigator) navigator.vibrate?.(8);

    update({
      taskId: pending.taskId,
      fromStatus: pending.status,
      overStatus: pending.status,
      overIndex: index,
      width: rect.width,
      height: rect.height,
    });
    rafRef.current = requestAnimationFrame(autoScroll);
  }, [autoScroll]);

  const onPointerDown = useCallback(
    (taskId: string, status: Status) => (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 || dragRef.current || pendingRef.current) return;
      if ((event.target as HTMLElement).closest(INTERACTIVE)) return;

      const pending: Pending = {
        taskId,
        status,
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        startX: event.clientX,
        startY: event.clientY,
        cardEl: event.currentTarget,
        timer: null,
      };
      pendingRef.current = pending;
      pointer.current = { x: event.clientX, y: event.clientY };

      const isTouch = event.pointerType === 'touch';
      if (isTouch) {
        pending.timer = window.setTimeout(() => {
          pending.timer = null;
          if (pendingRef.current === pending) activate();
        }, TOUCH_DELAY);
      }

      const move = (e: PointerEvent) => {
        if (e.pointerId !== pending.pointerId) return;
        pointer.current = { x: e.clientX, y: e.clientY };
        if (!dragRef.current) {
          const moved = Math.hypot(e.clientX - pending.startX, e.clientY - pending.startY);
          if (isTouch) {
            if (moved > TOUCH_SLOP) finish(false); // it's a scroll, not a drag
          } else if (moved > MOUSE_SLOP) {
            activate();
          }
          return;
        }
        positionOverlay();
        retarget();
      };
      const up = (e: PointerEvent) => {
        if (e.pointerId === pending.pointerId) finish(true);
      };
      const cancel = (e: PointerEvent) => {
        if (e.pointerId === pending.pointerId) finish(false);
      };
      const key = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && dragRef.current) {
          e.preventDefault();
          finish(false);
        }
      };
      // Once a touch drag is active, stop the page from scrolling under the finger.
      const touchMove = (e: TouchEvent) => {
        if (dragRef.current) e.preventDefault();
      };

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', cancel);
      window.addEventListener('keydown', key);
      window.addEventListener('touchmove', touchMove, { passive: false });
      cleanupListeners.current = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', cancel);
        window.removeEventListener('keydown', key);
        window.removeEventListener('touchmove', touchMove);
        cleanupListeners.current = () => {};
      };
    },
    [activate, finish, retarget],
  );

  // Never leave listeners behind if the board unmounts mid-drag.
  useEffect(() => () => finish(false), [finish]);

  /** Cards call this in onClick so the click that ends a drag doesn't open the task. */
  const shouldSuppressClick = useCallback(() => suppressClick.current, []);

  return {
    drag,
    boardRef,
    setOverlay,
    registerColumn,
    registerList,
    onPointerDown,
    shouldSuppressClick,
  };
}
