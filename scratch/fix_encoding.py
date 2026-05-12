import sys
import os

path = r'c:\Users\xiaoc\Desktop\xc work\Cyzx4\services\geminiService.ts'
if not os.path.exists(path):
    print(f"File not found: {path}")
    sys.exit(1)

with open(path, 'rb') as f:
    content = f.read()

# Try to decode as UTF-8, ignoring errors to avoid crash
text = content.decode('utf-8', 'ignore')
lines = text.splitlines()

# Ensure we don't go out of bounds
if len(lines) > 65:
    lines[54] = "    const vPos = cy < 0.33 ? '顶部' : cy < 0.66 ? '中部' : '底部';"
    lines[55] = "    const hPos = cx < 0.33 ? '左侧' : cx < 0.66 ? '中央' : '右侧';"
    lines[56] = "    const sizeDesc = (w * h) > 0.25 ? '大面积' : (w * h) > 0.1 ? '中等面积' : '小面积';"
    lines[57] = "    return `${vPos}${hPos}区域 (${sizeDesc}, 约 ${(w * 100).toFixed(0)}%宽 x ${(h * 100).toFixed(0)}%高)`;"
    lines[62] = "    const colorCode = b.color === 'Red' ? '红色' : b.color === 'Yellow' ? '黄色' : '蓝色';"
    lines[63] = "    return `[区域 ${i+1}] (${colorCode}): 位于 ${spatialDesc}。精确坐标 (${(b.x*100).toFixed(1)}%, ${(b.y*100).toFixed(1)}%)。此区域的目标效果 *必须参考 Image ${i+2}*。`;"

    new_text = '\n'.join(lines)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_text)
    print("Successfully fixed geminiService.ts")
else:
    print(f"File too short: {len(lines)} lines")
