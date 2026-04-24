// 催眠APP - 每日结算脚本
// 目标：
// 1) 当“系统.当前时间”跨天但“系统.当前日期”未更新时，自动推进日期
// 2) 按跨越天数恢复“系统._MC能量”（每天恢复“系统._MC能量上限”的 50%）
// 3) 每天降低“系统.主角可疑度”10点，降低每个“角色.*.警戒度”10点
// 4) 每个角色每 5 点“警戒度”，每天会增加 1 点“主角可疑度”

import { applyDailySettlement } from './OS/dailySettlement';
import { getMessageVariableOption } from '../催眠APP前端/shared/mvu/mvuBridge';
import { logger } from '../催眠APP共用/debug/loggerService';

$(() => {
  (async () => {
    logger.info('腳本入口初始化');

    try {
      await waitGlobalInitialized('Mvu');
    } catch (err) {
      logger.error('Mvu 未就緒，腳本不生效', err);
      return;
    }

    let isSettling = false;

    eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, async (after: Mvu.MvuData, before: Mvu.MvuData) => {
      if (isSettling) return;

      isSettling = true;
      try {
        const changed = await applyDailySettlement(after, before);
        if (changed) {
          await Mvu.replaceMvuData(after, getMessageVariableOption());
        }
      } catch (err) {
        logger.error('每日結算失敗', err);
      } finally {
        isSettling = false;
      }
    });
  })();
});
