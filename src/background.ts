const BADGE_BG = '#1f6feb';

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeBackgroundColor({ color: BADGE_BG });
  chrome.action.setBadgeText({ text: '' });
});

chrome.runtime.onMessage.addListener((msg: any, sender, sendResponse) => {
  try {
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'OBN_PAGE_ENTITY_COUNT') {
      const count = Number(msg.count || 0);
      const text = count <= 0 ? '' : count > 99 ? '99+' : String(count);
      if (sender?.tab?.id) chrome.action.setBadgeText({ tabId: sender.tab.id, text });
      sendResponse?.({ ok: true });
      return true;
    }

    if (msg.type === 'OBN_OPEN_BASKET_PAGE') {
      chrome.tabs.create({ url: chrome.runtime.getURL('basket.html') });
      sendResponse?.({ ok: true });
      return true;
    }

    return;
  } catch (err) {
    console.warn('OBN background error', err);
    sendResponse?.({ ok: false, error: String(err) });
    return true;
  }
});

