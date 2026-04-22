/*
此腳本為初次註冊變量結構使用。
*/

import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';

const HypnosisDetail = z.object({
  效果: z.string().prefault(''),
  结束时间: z.string().prefault(''),
});

const CharacterStats = z.intersection(
  z.object({
    警戒度: z.coerce
      .number()
      .prefault(0)
      .transform(v => Math.max(0, v)),
    好感度: z.coerce
      .number()
      .prefault(0)
      .transform(v => Math.max(0, v)),
    服从度: z.coerce
      .number()
      .prefault(0)
      .transform(v => Math.max(0, v)),
    性欲: z.coerce.number().prefault(0),
    快感值: z.coerce.number().prefault(0),
    阴蒂敏感度: z.coerce.number().prefault(0),
    小穴敏感度: z.coerce.number().prefault(0),
    菊穴敏感度: z.coerce.number().prefault(0),
    尿道敏感度: z.coerce.number().prefault(0),
    乳头敏感度: z.coerce.number().prefault(0),
    临时催眠效果: z.record(z.string().describe('催眠名'), HypnosisDetail).prefault({}),
    永久催眠效果: z.record(z.string().describe('催眠名'), HypnosisDetail).prefault({}),
    阴蒂高潮次数: z.coerce.number().prefault(0),
    小穴高潮次数: z.coerce.number().prefault(0),
    菊穴高潮次数: z.coerce.number().prefault(0),
    尿道高潮次数: z.coerce.number().prefault(0),
    乳头高潮次数: z.coerce.number().prefault(0),
  }),
  z.record(z.string(), z.any()),
);

export const Schema = z.object({
  本轮APP操作: z.union([z.string(), z.record(z.string(), z.any()), z.array(z.any())]).prefault('无'),

  系统: z
    .object({
      当前日期: z.string().prefault(''),
      当前时间: z.string().prefault(''),
      当前日程: z.string().prefault(''),
      当前或下个事件: z.string().prefault(''),
      _催眠APP订阅等级: z.string().prefault(''),
      _MC能量上限: z.coerce.number().prefault(0),
      _MC能量: z.coerce.number().prefault(0),
      当前MC点: z.coerce.number().prefault(0),
      _累计消耗MC点: z.coerce.number().prefault(0),
      主角可疑度: z.coerce
        .number()
        .prefault(0)
        .transform(v => Math.max(0, v)),
      学校声望: z.coerce
        .number()
        .prefault(0)
        .transform(v => Math.max(0, v)),
      持有零花钱: z.coerce.number().prefault(0),
      持有物品: z
        .record(
          z.string().describe('物品名'),
          z
            .object({
              描述: z.string().prefault(''),
              数量: z.coerce.number().prefault(0),
            })
            .prefault({}),
        )
        .prefault({}),
    })
    .prefault({}),

  角色: z
    .record(z.string().describe('角色名'), CharacterStats.or(z.literal('待初始化')).prefault('待初始化'))
    .prefault({}),

  任务: z
    .record(
      z.string().describe('具体任务名'),
      z
        .object({
          完成条件: z.string().prefault(''),
          已完成: z.boolean().prefault(false),
        })
        .prefault({}),
    )
    .prefault({}),

  本轮日曆操作: z
    .array(
      z.object({
        操作: z.enum(['新增', '修改', '删除']).describe('操作类型'),
        月: z.coerce.number().describe('月份'),
        日: z.coerce.number().describe('日期'),
        标题: z.string().prefault('').describe('事件标题'),
        描述: z.string().prefault('').describe('事件描述(可选)'),
        目标事件: z.string().prefault('').describe('修改/删除时的目标事件名'),
      }),
    )
    .prefault([]),
});

$(() => {
  registerMvuSchema(Schema);
});
