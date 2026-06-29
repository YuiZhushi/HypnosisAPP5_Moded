// ==========================================
// 身體改造系統整合測試腳本 (ts-node 運行)
// ==========================================

// 1. 模擬瀏覽器 global 環境，防止 DOM 依賴 crash
(globalThis as any).window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {},
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
};

import { MockApi } from '../src/催眠APP前端/shared/api/mockApi';
import { mockMvuVariables } from '../src/催眠APP前端/database/mockDatabase';
import { BODY_MODIFICATIONS_DICTIONARY } from '../src/催眠APP前端/staticData';

async function runTests() {
  console.log('🧪 ==================================================');
  console.log('🧪 身體改造系統 (Body Modification System) 整合測試開始');
  console.log('🧪 ==================================================\n');

  const npcName = '西园寺爱丽莎';

  // ==========================================
  // 測試 1：初始資料清空舊格式標記
  // ==========================================
  console.log('▶ [測試 1] 驗證角色初始 ownedBodyModifications 是否清空舊標記...');
  const charData = mockMvuVariables.chars[npcName];
  if (Object.keys(charData.ownedBodyModifications || {}).length === 0) {
    console.log('✅ 測試 1 通過：舊資料已成功廢除，初始化為空物件。');
  } else {
    throw new Error('❌ 測試 1 失敗：ownedBodyModifications 包含舊資料！');
  }

  // ==========================================
  // 測試 2：前置條件不足阻擋 (服從度不足)
  // ==========================================
  console.log('\n▶ [測試 2] 驗證前置屬性不足時 (如貓尾加裝服從度 >=45)，是否攔截...');
  charData.obedience = 10; // 設低服從度
  const resObedience = await MockApi.performBodyModification(npcName, 'mod_cat_tail');
  if (!resObedience.success && resObedience.errorMsg?.includes('未滿足改造的前置')) {
    console.log('✅ 測試 2 通過：服從度不足成功攔截。訊息: ' + resObedience.errorMsg);
  } else {
    throw new Error('❌ 測試 2 失敗：未阻擋低服從度改造！');
  }

  // ==========================================
  // 測試 3：資源/材料不足阻擋
  // ==========================================
  console.log('\n▶ [測試 3] 驗證手續費/材料不足時，是否攔截...');
  charData.obedience = 80; // 滿足服從度
  mockMvuVariables.user.money = 1000; // 設低金額 (所需 50000)
  const resMoney = await MockApi.performBodyModification(npcName, 'mod_cat_tail');
  if (!resMoney.success && resMoney.errorMsg?.includes('資金不足')) {
    console.log('✅ 測試 3-1 通過：資金不足成功攔截。');
  } else {
    throw new Error('❌ 測試 3-1 失敗：未阻擋資金不足！');
  }

  mockMvuVariables.user.money = 100000; // 補足資金
  mockMvuVariables.user.inventory = {}; // 清空背包，無仿生貓尾植入物
  const resItem = await MockApi.performBodyModification(npcName, 'mod_cat_tail');
  if (!resItem.success && resItem.errorMsg?.includes('材料不足')) {
    console.log('✅ 測試 3-2 通過：背包材料不足成功攔截。');
  } else {
    throw new Error('❌ 測試 3-2 失敗：未阻擋材料不足！');
  }

  // ==========================================
  // 測試 4：成功執行安裝與資源扣減
  // ==========================================
  console.log('\n▶ [測試 4] 補足資源，驗證是否能成功安裝改造並扣減資源...');
  mockMvuVariables.user.money = 100000;
  mockMvuVariables.user.mcPoints = 100;
  mockMvuVariables.user.mcEnergy = 30;
  // 給予材料
  mockMvuVariables.user.inventory = {
    item_hypno_serum: { quantity: 10 },
    item_cat_tail_implant: { quantity: 1 }
  };

  const initialMoney = mockMvuVariables.user.money;
  const initialSerum = mockMvuVariables.user.inventory['item_hypno_serum'].quantity;
  const initialImplant = mockMvuVariables.user.inventory['item_cat_tail_implant'].quantity;

  const resSuccess = await MockApi.performBodyModification(npcName, 'mod_cat_tail');
  if (resSuccess.success) {
    const cost = BODY_MODIFICATIONS_DICTIONARY['mod_cat_tail'].cost;
    const finalMoney = mockMvuVariables.user.money;
    const finalSerum = mockMvuVariables.user.inventory['item_hypno_serum']?.quantity ?? 0;
    const finalImplant = mockMvuVariables.user.inventory['item_cat_tail_implant']?.quantity ?? 0;

    if (finalMoney === initialMoney - (cost.money ?? 0) &&
        finalSerum === initialSerum - 3 &&
        finalImplant === initialImplant - 1) {
      console.log('✅ 測試 4 通過：安裝成功，且金錢與背包材料扣減正確。');
    } else {
      throw new Error(`❌ 測試 4 失敗：扣減資源數值不對！Money: ${finalMoney}, Serum: ${finalSerum}, Implant: ${finalImplant}`);
    }
  } else {
    throw new Error('❌ 測試 4 失敗：' + resSuccess.errorMsg);
  }

  // ==========================================
  // 測試 5：自訂部位動態生成
  // ==========================================
  console.log('\n▶ [測試 5] 驗證加裝尾巴改造後，是否自動在 NPC.bodyParts 實體化 tail...');
  const activeChar = mockMvuVariables.chars[npcName];
  if (activeChar.bodyParts && activeChar.bodyParts['tail']) {
    console.log('✅ 測試 5 通過：自訂部位 "tail" 已成功在 bodyParts 實體化！' + JSON.stringify(activeChar.bodyParts['tail']));
  } else {
    throw new Error('❌ 測試 5 失敗：自訂部位沒有實體化！');
  }

  // ==========================================
  // 測試 6：有效屬性加成與疊加 (getEffectiveNpcData)
  // ==========================================
  console.log('\n▶ [測試 6] 驗證 getEffectiveNpcData 屬性疊加是否生效 (尾巴敏感度 +30)...');
  const effectiveData = await MockApi.getNpc(npcName);
  const baseSensitivity = (activeChar.bodyParts as any)['tail']?.sensitivity ?? 0;
  const effectiveSensitivity = (effectiveData.bodyParts as any)['tail']?.sensitivity ?? 0;
  if (effectiveSensitivity === baseSensitivity + 30) {
    console.log(`✅ 測試 6 通過：有效尾巴敏感度為 ${effectiveSensitivity} (基礎 ${baseSensitivity} + 加成 30)。`);
  } else {
    throw new Error(`❌ 測試 6 失敗：有效敏感度計算錯誤！值為 ${effectiveSensitivity}`);
  }

  // ==========================================
  // 測試 7：適應期排異反應 (常駐 Affection -10)
  // ==========================================
  console.log('\n▶ [測試 7] 驗證適應期排異反應是否正確扣減 Affection -10...');
  activeChar.affection = 50; // 避免 0 邊界限制導致截斷
  const freshEffective = await MockApi.getNpc(npcName);
  const baseAffection = activeChar.affection;
  const effectiveAffection = freshEffective.affection;
  if (effectiveAffection === baseAffection - 10) {
    console.log(`✅ 測試 7 通過：有效好感度為 ${effectiveAffection} (基礎 ${baseAffection} - 排異 10)。`);
  } else {
    throw new Error(`❌ 測試 7 失敗：排異反應好感度計算錯誤！值為 ${effectiveAffection}`);
  }

  // ==========================================
  // 測試 8：虛擬時間前進與適應完成
  // ==========================================
  console.log('\n▶ [測試 8] 前進虛擬時間 49 小時，驗證適應期是否結束，排異反應是否移除...');
  mockMvuVariables.time = '2026-05-15 12:00:00'; // 設定基礎時間
  // 重新 perform 一次以覆蓋虛擬時間為新起點
  delete activeChar.ownedBodyModifications['mod_cat_tail'];
  mockMvuVariables.user.inventory = {
    item_hypno_serum: { quantity: 10 },
    item_cat_tail_implant: { quantity: 1 }
  };
  await MockApi.performBodyModification(npcName, 'mod_cat_tail');

  // 適應期結束時間應為 2026-05-17 12:00:00. 我們將系統時間更新為 2026-05-17 13:00:00
  await MockApi.updateSystemTime('2026-05-17 13:00:00');

  const postAdaptData = await MockApi.getNpc(npcName);
  if (!postAdaptData.ownedBodyModifications['mod_cat_tail'].adaptation) {
    if (postAdaptData.affection === baseAffection) {
      console.log('✅ 測試 8 通過：適應期順利結束，排異反應已完全移除，好感度恢復。');
    } else {
      throw new Error(`❌ 測試 8 失敗：適應期結束但好感度未恢復！有效值：${postAdaptData.affection}`);
    }
  } else {
    throw new Error('❌ 測試 8 失敗：適應期仍然存在，未被正常移除！');
  }

  // ==========================================
  // 測試 9：週期性物品產出 (雙乳泌乳化)
  // ==========================================
  console.log('\n▶ [測試 9] 安裝雙乳泌乳改造，推進時間 1 天，驗證是否有 item_milk 產出...');
  // 安裝泌乳
  mockMvuVariables.user.money = 100000;
  mockMvuVariables.user.mcPoints = 100;
  mockMvuVariables.user.mcEnergy = 30;
  mockMvuVariables.user.inventory = {
    item_hypno_serum: { quantity: 10 }
  };
  charData.lust = 50; // 滿足泌乳前置 lust >=30
  const resLact = await MockApi.performBodyModification(npcName, 'mod_breast_milk');
  if (!resLact.success) throw new Error('安裝泌乳改造失敗：' + resLact.errorMsg);

  // 推進一天 (從 5-17 13:00 到 5-18 14:00)
  activeChar.inventory = {}; // 清空 NPC 背包
  await MockApi.updateSystemTime('2026-05-18 14:00:00');

  if (activeChar.inventory['item_milk'] && activeChar.inventory['item_milk'].quantity > 0) {
    console.log(`✅ 測試 9 通過：成功產出【催眠母乳】 ${activeChar.inventory['item_milk'].quantity} 瓶！`);
  } else {
    throw new Error('❌ 測試 9 失敗：時間流逝後，NPC 背包中沒有產出母乳！');
  }

  // ==========================================
  // 測試 10：同類/同 Slot 改造互斥
  // ==========================================
  console.log('\n▶ [測試 10] 驗證 Slot 材質與形狀改造的互斥攔截 (mod_slime_body 與 mod_iron_body)...');
  // 先安裝史萊姆全身化
  mockMvuVariables.user.inventory = {
    item_hypno_serum: { quantity: 10 },
    item_slime_essence: { quantity: 1 }
  };
  charData.obedience = 80;
  charData.lust = 80;
  const slimeRes = await MockApi.performBodyModification(npcName, 'mod_slime_body');
  if (!slimeRes.success) throw new Error('安裝史萊姆化失敗: ' + slimeRes.errorMsg);

  // 嘗試安裝機械化改裝 (兩者同屬 material，應互斥)
  const ironRes = await MockApi.performBodyModification(npcName, 'mod_iron_body');
  if (!ironRes.success && ironRes.errorMsg?.includes('無法共存')) {
    console.log('✅ 測試 10 通過：互斥改造成功被阻擋。訊息: ' + ironRes.errorMsg);
  } else {
    throw new Error('❌ 測試 10 失敗：未成功攔截材質互斥改造！');
  }

  // ==========================================
  // 測試 11：肉體負荷上限與超載
  // ==========================================
  console.log('\n▶ [測試 11] 驗證負荷超載攔截...');
  // 貓尾巴 (3) + 泌乳化 (4) + 史萊姆 (8) = 15 load. 
  // 自訂部位只有 tail (+1 部位)，maxLoad = 14 + 1*2 = 16. 當前未超載。
  // 我們再嘗試安裝乳環 (1 load)，15+1 = 16. 剛好滿載。
  mockMvuVariables.user.inventory = {
    item_hypno_serum: { quantity: 10 }
  };
  const ringRes = await MockApi.performBodyModification(npcName, 'mod_breast_ring');
  if (!ringRes.success) throw new Error('安裝乳環失敗: ' + ringRes.errorMsg);

  // 再嘗試安裝桃心型乳房 (3 load)，總 load 16+3 = 19 > 16. 應被超載阻擋！
  const shapeRes = await MockApi.performBodyModification(npcName, 'mod_heart_breast');
  if (!shapeRes.success && shapeRes.errorMsg?.includes('肉體負荷超載')) {
    console.log('✅ 測試 11 通過：負荷超載成功攔截。訊息: ' + shapeRes.errorMsg);
  } else {
    throw new Error('❌ 測試 11 失敗：未成功攔截負荷超載！');
  }

  // ==========================================
  // 測試 12：解除安裝與部位清理
  // ==========================================
  console.log('\n▶ [測試 12] 移除貓尾巴改造，驗證自訂部位 tail 是否被清理出 bodyParts...');
  const removeRes = await MockApi.removeBodyModification(npcName, 'mod_cat_tail');
  if (removeRes.success) {
    if (!activeChar.bodyParts['tail']) {
      console.log('✅ 測試 12 通過：貓尾已移除，且由於無其餘改造佔用，部位 "tail" 已被成功清理。');
    } else {
      throw new Error('❌ 測試 12 失敗：已移除貓尾改造，但 tail 部位仍然存留在 bodyParts 中！');
    }
  } else {
    throw new Error('❌ 測試 12 失敗：' + removeRes.errorMsg);
  }

  console.log('\n🎉 ==================================================');
  console.log('🎉 恭喜！所有身體改造系統整合測試案例全部通過 (12/12)！');
  console.log('🎉 ==================================================');
}

runTests().catch(e => {
  console.error('\n❌ 測試中途遭遇失敗:');
  console.error(e);
});
