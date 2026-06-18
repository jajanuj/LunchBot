// 測試：菜單 Flex Message（Carousel）組裝邏輯
// 用法：npm run test:e2e:line-flex-message
//
// 這個檔案測的是純資料組裝函式（不發任何網路請求、不需要啟動 dev server），
// 所以不是 Puppeteer/HTTP E2E，而是直接 import 函式呼叫驗證輸出結構。
// 推播功能「真的送到 LINE 群組」那一段，因為每次執行都會在真實群組裡發訊息
// （會洗版、消耗額度），不適合放進可重複執行的自動化測試，已改為人工觸發一次
// 驗證過（見 docs/PROGRESS.md），這裡只驗證訊息「組裝出來的格式」是否正確。
import { assert } from "./utils.mjs";
import { buildMenuCarouselMessage } from "../src/lib/line/flexMessage.ts";

const LIFF_ID = "1234567890-AbCdEfGh";

function makeMenu(overrides = {}) {
  return {
    id: "menu-1",
    menuDate: "2026-06-17",
    sessionName: "午餐",
    storeName: "阿明便當",
    cutoffTime: "2026-06-17T12:00:00+08:00",
    status: "open",
    items: [{ id: "item-1", itemName: "雞腿飯", price: 90 }],
    ...overrides,
  };
}

function main() {
  // 1. 單一菜單 -> 1 個 bubble
  const single = buildMenuCarouselMessage([makeMenu()], LIFF_ID);
  assert(single.type === "flex", "應為 flex 訊息");
  assert(single.contents.type === "carousel", "contents 應為 carousel");
  assert(single.contents.contents.length === 1, "單一菜單應只有 1 個 bubble");
  assert(single.altText.includes("06/17"), "altText 應包含日期");
  assert(single.altText.includes("午餐"), "altText 應包含場次名稱");
  console.log("[line-flex-message] ✅ 單一菜單組裝正確");

  // 2. 多場次同一天 -> 多個 bubble，且各自的按鈕網址帶對應 menuId
  const lunch = makeMenu({ id: "menu-lunch", sessionName: "午餐" });
  const drink = makeMenu({ id: "menu-drink", sessionName: "午餐飲料", storeName: "五十嵐" });
  const multi = buildMenuCarouselMessage([lunch, drink], LIFF_ID);
  assert(multi.contents.contents.length === 2, "兩個場次應產生 2 個 bubble");

  const lunchButton = multi.contents.contents[0].footer.contents[0];
  const drinkButton = multi.contents.contents[1].footer.contents[0];
  const expectedLunchUri = `https://liff.line.me/${LIFF_ID}?liff.state=${encodeURIComponent("?menuId=menu-lunch")}`;
  const expectedDrinkUri = `https://liff.line.me/${LIFF_ID}?liff.state=${encodeURIComponent("?menuId=menu-drink")}`;
  assert(
    lunchButton.action.uri === expectedLunchUri,
    `午餐按鈕網址不正確：${lunchButton.action.uri}`
  );
  assert(
    drinkButton.action.uri === expectedDrinkUri,
    `飲料按鈕網址不正確：${drinkButton.action.uri}`
  );
  console.log("[line-flex-message] ✅ 多場次各自產生獨立 bubble 與正確的點餐網址");

  // 3. 場次 emoji 判斷
  const drinkBubbleTitle = multi.contents.contents[1].header.contents[0].text;
  assert(drinkBubbleTitle.startsWith("🥤"), `飲料場次應使用 🥤 emoji，實際：${drinkBubbleTitle}`);
  const lunchBubbleTitle = multi.contents.contents[0].header.contents[0].text;
  assert(lunchBubbleTitle.startsWith("🍱"), `午餐場次應使用 🍱 emoji，實際：${lunchBubbleTitle}`);
  console.log("[line-flex-message] ✅ 場次 emoji 判斷正確");

  // 4. 空陣列應該丟錯，避免推播出一個空的 carousel
  let threw = false;
  try {
    buildMenuCarouselMessage([], LIFF_ID);
  } catch {
    threw = true;
  }
  assert(threw, "空陣列應該丟出錯誤");
  console.log("[line-flex-message] ✅ 空陣列正確拋出錯誤");
}

main();
console.log("[line-flex-message] 全部通過");
