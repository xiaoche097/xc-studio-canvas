$baseDir = "c:\Users\xiaoc\Desktop\skysper-ai-studio"
$srcDir = "$baseDir\缩略图参考"
$dstDir = "$baseDir\public\thumbnails"

function Convert-Img {
    param ($src, $dst)
    Write-Host "Converting $src to $dst..."
    # Ensure npx doesn't mess up paths, we quote them inside the command string for npx
    npx -y sharp-cli -i "$src" -o "$dst" resize 80 60
}

Convert-Img "$srcDir\单品座椅角度-侧.svg" "$dstDir\thumb_s2.webp"
Convert-Img "$srcDir\单品座椅角度-背.svg" "$dstDir\thumb_s3.webp"
Convert-Img "$srcDir\整套座椅角度-侧1.svg" "$dstDir\thumb_set1.webp"
Convert-Img "$srcDir\整套座椅角度-侧2.svg" "$dstDir\thumb_set2.webp"
Convert-Img "$srcDir\车内前排角度-主图带方向盘.svg" "$dstDir\thumb_f1.webp"
Convert-Img "$srcDir\车内前排角度-主驾.svg" "$dstDir\thumb_f2.webp"
Convert-Img "$srcDir\车内前排角度-前半.svg" "$dstDir\thumb_f3.webp"
Convert-Img "$srcDir\车内前排角度-前排背面.svg" "$dstDir\thumb_f4.webp"
Convert-Img "$srcDir\车内后排角度-后排正面.svg" "$dstDir\thumb_r1.webp"
Convert-Img "$srcDir\车内后排角度-后排侧面1.svg" "$dstDir\thumb_r2.webp"
Convert-Img "$srcDir\车内后排角度-后排侧面2.svg" "$dstDir\thumb_r3.webp"
Convert-Img "$srcDir\车内后排角度-后排侧面3.svg" "$dstDir\thumb_r4.webp"
Convert-Img "$srcDir\车内后排角度-躺倒正面.svg" "$dstDir\thumb_r5.webp"
Convert-Img "$srcDir\车内后排角度-后半.svg" "$dstDir\thumb_r6.webp"
