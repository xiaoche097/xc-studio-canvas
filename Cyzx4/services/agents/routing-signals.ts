/** High-confidence local signals that do not require conversation context. */
export function isFashionTransferRequest(message: string): boolean {
  const lower = String(message || '').toLowerCase();
  const hasFashionSubject = /服装|衣服|上衣|裤子|裙|商品|产品|模特|人台|穿搭|outfit|garment|clothing|apparel|model/i.test(lower);
  const hasTransferIntent = /试穿|换装|换衣|上身|穿到|穿在|套到|换到.{0,16}(?:模特|人台|人物)|(?:产品|商品|服装|衣服).{0,16}(?:模特|人台).{0,8}(?:上|身)|virtual\s*try.?on|dress.{0,16}model|put.{0,16}(?:on|onto).{0,16}model/i.test(lower);
  return hasFashionSubject && hasTransferIntent;
}
