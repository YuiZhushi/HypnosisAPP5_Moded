// 监听酒馆关键事件并桥接到 chat 变量（供 iframe 内 HypnoOS 读取）

function toFloor(messageId) {
  const n = Number(messageId);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.trunc(n));
}

function updateBridge(mutator) {
  updateVariablesWith(vars => {
    if (!vars.系统) vars.系统 = {};
    if (!vars.系统._hypnoos) vars.系统._hypnoos = {};
    if (!vars.系统._hypnoos.calendarCRUD) vars.系统._hypnoos.calendarCRUD = {};
    if (!vars.系统._hypnoos.calendarCRUD.bridge) {
      vars.系统._hypnoos.calendarCRUD.bridge = {
        deleteFloor: { triggered: false },
        deleteSwipe: { triggered: false },
        switchSwipe: { triggered: false },
      };
    }
    mutator(vars.系统._hypnoos.calendarCRUD.bridge);
    return vars;
  }, { type: 'chat' });
}

$(() => {
  console.info('[HypnoOS][Listener_Bridge] loaded');

  // 刪除樓層：event payload 為被刪樓層 id（最小刪除起點）
  eventOn(tavern_events.MESSAGE_DELETED, message_id => {
    try {
      const floor = toFloor(message_id);
      if (floor === null) return;

      console.info('[HypnoOS][Listener_Bridge] MESSAGE_DELETED', { message_id, floor });
      updateBridge(bridge => {
        bridge.deleteFloor = { triggered: true, deleteFrom: floor };
      });
    } catch (err) {
      console.error('[HypnoOS][Listener_Bridge] MESSAGE_DELETED failed', err);
    }
  });

  // 切換 swipe：event payload 為發生 swipe 的樓層 id（不含目標 swipe id）
  eventOn(tavern_events.MESSAGE_SWIPED, message_id => {
    try {
      const floor = toFloor(message_id);
      if (floor === null) return;

      console.info('[HypnoOS][Listener_Bridge] MESSAGE_SWIPED', { message_id, floor });
      updateBridge(bridge => {
        bridge.switchSwipe = { triggered: true, floor };
      });
    } catch (err) {
      console.error('[HypnoOS][Listener_Bridge] MESSAGE_SWIPED failed', err);
    }
  });

  // 刪除 swipe：event payload 為 { messageId, swipeId, newSwipeId }
  eventOn(tavern_events.MESSAGE_SWIPE_DELETED, event_data => {
    try {
      const floor = toFloor(event_data && event_data.messageId);
      const swipeId = toFloor(event_data && event_data.swipeId);
      const newSwipeId = toFloor(event_data && event_data.newSwipeId);
      if (floor === null || swipeId === null || newSwipeId === null) return;

      console.info('[HypnoOS][Listener_Bridge] MESSAGE_SWIPE_DELETED', {
        message_id: event_data && event_data.messageId,
        floor,
        swipeId,
        newSwipeId,
      });

      updateBridge(bridge => {
        bridge.deleteSwipe = {
          triggered: true,
          floor,
          swipeId,
          newSwipeId,
        };
      });
    } catch (err) {
      console.error('[HypnoOS][Listener_Bridge] MESSAGE_SWIPE_DELETED failed', err);
    }
  });
});
